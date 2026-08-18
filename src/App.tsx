import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ToolType,
  BackgroundType,
  WhiteboardElement,
  Point,
  LaserPoint,
  CursorPosition,
  UserRole,
  Participant,
  ChatMessage,
  ImageElement,
  ToolSpecificSettings,
  DEFAULT_TOOL_SETTINGS,
  WhiteboardAction,
} from './types';
import { KeybindSettings, DEFAULT_KEYBINDS } from './types/extra';
import { getSocket, disconnectSocket, forceReconnectSocket } from './services/socket';
import { voiceManager } from './services/webrtc';
import { Canvas } from './components/Whiteboard/Canvas';
import { Toolbar } from './components/Whiteboard/Toolbar';
import { VoiceControls } from './components/Voice/VoiceControls';
import { RoomHeader } from './components/Room/RoomHeader';
import { JoinModal } from './components/Room/JoinModal';
import { ChatDrawer } from './components/Chat/ChatDrawer';
import { ParticipantsDrawer } from './components/Room/ParticipantsDrawer';
import { MathToolbar } from './components/MathToolbar';
import { SettingsModal } from './components/Room/SettingsModal';
import { CodeIDE } from './components/IDE/CodeIDE';
import { AvatarPicker } from './components/Common/AvatarPicker';
import confetti from 'canvas-confetti';
import { WifiOff, RefreshCw, Radio } from 'lucide-react';

const KEYBINDS_STORAGE_KEY = 'tutorboard_keybinds';
const STORAGE_KEY = 'tutorboard_user_session';
const ACTIVE_ROOM_KEY = 'tutorboard_active_room';

export default function App() {
  // Session & User State
  const [isInRoom, setIsInRoom] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [roomTitle, setRoomTitle] = useState('Занятие с репетитором');
  const [subject, setSubject] = useState('Математика');
  const [userRole, setUserRole] = useState<UserRole>('student');
  const [userName, setUserName] = useState('');
  const [userColor, setUserColor] = useState('#2563EB');
  const [userAvatar, setUserAvatar] = useState('🎓');
  const [myUserId, setMyUserId] = useState('');
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [isOffline, setIsOffline] = useState(typeof navigator !== 'undefined' ? !navigator.onLine : false);

  // Mode View (Whiteboard vs Collaborative IDE)
  const [activeView, setActiveView] = useState<'board' | 'ide'>('board');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Keybinds state
  const [keybinds, setKeybinds] = useState<KeybindSettings>(() => {
    try {
      const saved = localStorage.getItem(KEYBINDS_STORAGE_KEY);
      if (saved) return { ...DEFAULT_KEYBINDS, ...JSON.parse(saved) };
    } catch {}
    return DEFAULT_KEYBINDS;
  });

  // Whiteboard State
  const [tool, setTool] = useState<ToolType>('pen');
  const [toolSettings, setToolSettings] = useState<ToolSpecificSettings>(() => {
    try {
      const saved = localStorage.getItem('tutorboard_tool_settings');
      if (saved) return { ...DEFAULT_TOOL_SETTINGS, ...JSON.parse(saved) };
    } catch {}
    return DEFAULT_TOOL_SETTINGS;
  });

  const updateToolSetting = useCallback(
    <K extends keyof ToolSpecificSettings>(
      toolKey: K,
      settings: Partial<ToolSpecificSettings[K]>
    ) => {
      setToolSettings((prev) => {
        const updated = {
          ...prev,
          [toolKey]: {
            ...prev[toolKey],
            ...settings,
          },
        };
        try {
          localStorage.setItem('tutorboard_tool_settings', JSON.stringify(updated));
        } catch {}
        return updated;
      });
    },
    []
  );

  const [background, setBackground] = useState<BackgroundType>('grid');
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [pages, setPages] = useState<{ [pageIndex: number]: WhiteboardElement[] }>({
    0: [],
  });
  const [isLocked, setIsLocked] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState<Point>({ x: 0, y: 0 });

  // User-Specific Action-Based Undo / Redo History
  const [undoActions, setUndoActions] = useState<{ [pageIndex: number]: WhiteboardAction[] }>({ 0: [] });
  const [redoActions, setRedoActions] = useState<{ [pageIndex: number]: WhiteboardAction[] }>({ 0: [] });

  // Multiplayer & Ephemeral State
  const [participants, setParticipants] = useState<{ [socketId: string]: Participant }>({});
  const [cursors, setCursors] = useState<{ [socketId: string]: CursorPosition }>({});
  const [laserPoints, setLaserPoints] = useState<LaserPoint[]>([]);

  // Drawers & Overlays
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isParticipantsOpen, setIsParticipantsOpen] = useState(false);
  const [isMathOpen, setIsMathOpen] = useState(false);
  const [activeMathInsert, setActiveMathInsert] = useState<string | undefined>(undefined);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [notificationToast, setNotificationToast] = useState<string | null>(null);

  // Active page elements
  const currentElements = pages[activePageIndex] || [];

  const setCurrentElements = useCallback(
    (action: React.SetStateAction<WhiteboardElement[]>) => {
      setPages((prevPages) => {
        const currentList = prevPages[activePageIndex] || [];
        const newList = typeof action === 'function' ? action(currentList) : action;
        return {
          ...prevPages,
          [activePageIndex]: newList,
        };
      });
    },
    [activePageIndex]
  );

  // Record a local action into the user's specific undo stack
  const handleRecordAction = useCallback(
    (action: WhiteboardAction) => {
      setUndoActions((prev) => {
        const list = prev[activePageIndex] || [];
        return {
          ...prev,
          [activePageIndex]: [...list, action].slice(-50),
        };
      });
      setRedoActions((prev) => ({
        ...prev,
        [activePageIndex]: [],
      }));
    },
    [activePageIndex]
  );

  // User-Specific Undo: Reverts ONLY this user's actions without affecting others' drawings
  const handleUndo = useCallback(() => {
    setUndoActions((prevUndo) => {
      const pageUndo = [...(prevUndo[activePageIndex] || [])];
      if (pageUndo.length === 0) return prevUndo;

      const actionToUndo = pageUndo.pop()!;
      const socket = getSocket();

      if (actionToUndo.type === 'create') {
        // User created elements; remove ONLY these element IDs
        const idsToRemove = new Set(actionToUndo.elements.map((el) => el.id));
        setPages((prevPages) => ({
          ...prevPages,
          [activePageIndex]: (prevPages[activePageIndex] || []).filter((el) => !idsToRemove.has(el.id)),
        }));
        socket.emit('board:elements:deleteBatch', {
          elementIds: Array.from(idsToRemove),
          pageIndex: activePageIndex,
        });
      } else if (actionToUndo.type === 'delete') {
        // User deleted elements; restore them
        const restored = actionToUndo.elements;
        setPages((prevPages) => {
          const existing = prevPages[activePageIndex] || [];
          const existingIds = new Set(existing.map((e) => e.id));
          const toAdd = restored.filter((e) => !existingIds.has(e.id));
          return {
            ...prevPages,
            [activePageIndex]: [...existing, ...toAdd],
          };
        });
        restored.forEach((el) => {
          socket.emit('board:element:create', { element: el, pageIndex: activePageIndex });
        });
      } else if (actionToUndo.type === 'update') {
        // User transformed elements; restore their "before" state
        const beforeMap = new Map(actionToUndo.before.map((el) => [el.id, el]));
        setPages((prevPages) => ({
          ...prevPages,
          [activePageIndex]: (prevPages[activePageIndex] || []).map((el) => beforeMap.get(el.id) || el),
        }));
        actionToUndo.before.forEach((el) => {
          socket.emit('board:element:update', { element: el, pageIndex: activePageIndex });
        });
      }

      setRedoActions((prevRedo) => {
        const pageRedo = prevRedo[activePageIndex] || [];
        return {
          ...prevRedo,
          [activePageIndex]: [...pageRedo, actionToUndo],
        };
      });

      return {
        ...prevUndo,
        [activePageIndex]: pageUndo,
      };
    });
  }, [activePageIndex]);

  // User-Specific Redo
  const handleRedo = useCallback(() => {
    setRedoActions((prevRedo) => {
      const pageRedo = [...(prevRedo[activePageIndex] || [])];
      if (pageRedo.length === 0) return prevRedo;

      const actionToRedo = pageRedo.pop()!;
      const socket = getSocket();

      if (actionToRedo.type === 'create') {
        const toRestore = actionToRedo.elements;
        setPages((prevPages) => {
          const existing = prevPages[activePageIndex] || [];
          const existingIds = new Set(existing.map((e) => e.id));
          const toAdd = toRestore.filter((e) => !existingIds.has(e.id));
          return {
            ...prevPages,
            [activePageIndex]: [...existing, ...toAdd],
          };
        });
        toRestore.forEach((el) => {
          socket.emit('board:element:create', { element: el, pageIndex: activePageIndex });
        });
      } else if (actionToRedo.type === 'delete') {
        const idsToRemove = new Set(actionToRedo.elements.map((el) => el.id));
        setPages((prevPages) => ({
          ...prevPages,
          [activePageIndex]: (prevPages[activePageIndex] || []).filter((el) => !idsToRemove.has(el.id)),
        }));
        socket.emit('board:elements:deleteBatch', {
          elementIds: Array.from(idsToRemove),
          pageIndex: activePageIndex,
        });
      } else if (actionToRedo.type === 'update') {
        const afterMap = new Map(actionToRedo.after.map((el) => [el.id, el]));
        setPages((prevPages) => ({
          ...prevPages,
          [activePageIndex]: (prevPages[activePageIndex] || []).map((el) => afterMap.get(el.id) || el),
        }));
        actionToRedo.after.forEach((el) => {
          socket.emit('board:element:update', { element: el, pageIndex: activePageIndex });
        });
      }

      setUndoActions((prevUndo) => {
        const pageUndo = prevUndo[activePageIndex] || [];
        return {
          ...prevUndo,
          [activePageIndex]: [...pageUndo, actionToRedo],
        };
      });

      return {
        ...prevRedo,
        [activePageIndex]: pageRedo,
      };
    });
  }, [activePageIndex]);

  // Connect & setup socket listeners
  const handleJoinRoom = ({
    roomId: targetRoomId,
    userName: targetName,
    role: targetRole,
    color: targetColor,
    avatar: targetAvatar,
    title: targetTitle,
    subject: targetSubject,
  }: {
    roomId: string;
    userName: string;
    role: UserRole;
    color: string;
    avatar?: string;
    title?: string;
    subject?: string;
    userId?: string;
  }) => {
    setRoomId(targetRoomId);
    setUserName(targetName);
    setUserRole(targetRole);
    setUserColor(targetColor);
    if (targetAvatar) setUserAvatar(targetAvatar);
    if (targetTitle) setRoomTitle(targetTitle);
    if (targetSubject) setSubject(targetSubject);
    setIsInRoom(true);

    // Initialize voice audio context and peer mesh cleanly for this room
    voiceManager.initializeForRoom(targetRoomId);
    voiceManager.setMicrophoneMuted(true);

    const socket = getSocket();

    // Join payload
    const joinPayload = {
      roomId: targetRoomId,
      userName: targetName,
      role: targetRole,
      color: targetColor,
      avatar: targetAvatar || '🎓',
      title: targetTitle,
      subject: targetSubject,
    };

    // Save active room to localStorage for seamless refresh recovery
    try {
      localStorage.setItem(
        ACTIVE_ROOM_KEY,
        JSON.stringify({
          roomId: targetRoomId,
          userName: targetName,
          role: targetRole,
          color: targetColor,
          avatar: targetAvatar || '🎓',
          title: targetTitle,
          subject: targetSubject,
        })
      );
      const url = new URL(window.location.href);
      url.searchParams.set('room', targetRoomId);
      window.history.replaceState(null, '', url.toString());
    } catch {}

    if (socket.connected) {
      socket.emit('room:join', joinPayload);
    } else {
      socket.connect();
      socket.once('connect', () => {
        socket.emit('room:join', joinPayload);
      });
    }

    // Clean any prior listeners before attaching new ones
    socket.off('room:error');
    socket.off('room:state');
    socket.off('room:joined');
    socket.off('room:participants');
    socket.off('room:userJoined');
    socket.off('room:userLeft');
    socket.off('room:kicked');
    socket.off('participant:left');
    socket.off('participant:voice:updated');
    socket.off('participant:updated');
    socket.off('board:element:created');
    socket.off('board:element:updated');
    socket.off('board:elements:deleted');
    socket.off('board:elements:deletedBatch');
    socket.off('board:elements:replaced');
    socket.off('board:page:cleared');
    socket.off('board:cleared');
    socket.off('board:page:changed');
    socket.off('board:page:added');
    socket.off('board:background:changed');
    socket.off('board:background:updated');
    socket.off('board:lock:changed');
    socket.off('board:lock:updated');
    socket.off('cursor:moved');
    socket.off('cursor:removed');
    socket.off('laser:pointer');
    socket.off('board:lasered');
    socket.off('tutor:cheered');
    socket.off('tutor:attentioned');
    socket.off('tutor:attention:ping');
    socket.off('chat:message');

    socket.on('room:error', (err: { error: string }) => {
      setIsInRoom(false);
      localStorage.removeItem(ACTIVE_ROOM_KEY);
      showToast(`❌ ${err.error || 'Ошибка подключения к комнате'}`);
    });

    socket.on('room:kicked', (data: { reason?: string }) => {
      localStorage.removeItem(ACTIVE_ROOM_KEY);
      disconnectSocket();
      voiceManager.cleanup();
      setIsInRoom(false);
      const url = new URL(window.location.href);
      url.searchParams.delete('room');
      window.history.replaceState(null, '', url.pathname + url.search);
      showToast(`⚠️ ${data?.reason || 'Вы были исключены из урока преподавателем'}`);
    });

    socket.on('room:state', (data: any) => {
      if (!data?.room) return;
      const r = data.room;
      if (r.id) setRoomId(r.id);
      if (r.title) setRoomTitle(r.title);
      if (r.subject) setSubject(r.subject);
      if (typeof r.isLocked === 'boolean') setIsLocked(r.isLocked);
      if (r.background) setBackground(r.background);
      if (typeof r.totalPages === 'number') setTotalPages(r.totalPages);
      if (typeof r.activePageIndex === 'number') setActivePageIndex(r.activePageIndex);
      if (r.pages) setPages(r.pages);

      if (r.participants) {
        setParticipants(r.participants);
        const activeIds = new Set(Object.keys(r.participants));
        setCursors((prev) => {
          const next: Record<string, CursorPosition> = {};
          for (const [uid, cur] of Object.entries(prev) as [string, CursorPosition][]) {
            if (uid === 'self' || activeIds.has(uid)) {
              next[uid] = cur;
            }
          }
          return next;
        });
      }
      if (Array.isArray(r.chatMessages)) {
        setChatMessages(r.chatMessages);
      }
    });

    socket.on('room:joined', (data) => {
      setMyUserId(data.userId || socket.id);
      if (typeof data.isLocked === 'boolean') setIsLocked(data.isLocked);
      if (data.title) setRoomTitle(data.title);
      if (data.subject) setSubject(data.subject);
      if (data.roomId) setRoomId(data.roomId);

      if (data.boardState) {
        if (data.boardState.pages) setPages(data.boardState.pages);
        if (data.boardState.background) setBackground(data.boardState.background);
        if (typeof data.boardState.totalPages === 'number') setTotalPages(data.boardState.totalPages);
        if (typeof data.boardState.activePageIndex === 'number') setActivePageIndex(data.boardState.activePageIndex);
      }
      if (Array.isArray(data.chatMessages)) {
        setChatMessages(data.chatMessages);
      }
    });

    socket.on('room:participants', (list: Participant[]) => {
      if (!Array.isArray(list)) return;
      const map: Record<string, Participant> = {};
      const activeIds = new Set<string>();
      list.forEach((p) => {
        if (p?.id) {
          map[p.id] = p;
          activeIds.add(p.id);
        }
      });
      setParticipants(map);

      // Clean up ghost cursors of participants no longer present in room
      setCursors((prev) => {
        let changed = false;
        const next: Record<string, CursorPosition> = {};
        for (const [uid, cur] of Object.entries(prev) as [string, CursorPosition][]) {
          if (uid === 'self' || activeIds.has(uid)) {
            next[uid] = cur;
          } else {
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    });

    socket.on('room:userJoined', (p: Participant) => {
      if (p?.id) {
        setParticipants((prev) => ({ ...prev, [p.id]: p }));
        // Clean up any stale cursor previously associated with this user's name
        setCursors((prev) => {
          const next = { ...prev };
          for (const [uid, cur] of Object.entries(next) as [string, CursorPosition][]) {
            if (uid !== p.id && uid !== 'self' && cur?.userName === p.name) {
              delete next[uid];
            }
          }
          return next;
        });
        showToast(`${p.name} (${p.role === 'tutor' ? 'Преподаватель' : 'Ученик'}) присоединился к уроку`);
      }
    });

    const handleUserLeave = ({ userId, userName: leftName }: { userId: string; userName?: string }) => {
      setParticipants((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
      setCursors((prev) => {
        const next = { ...prev };
        delete next[userId];
        if (leftName) {
          for (const [id, cur] of Object.entries(next) as [string, CursorPosition][]) {
            if (cur?.userName === leftName) {
              delete next[id];
            }
          }
        }
        return next;
      });
      if (leftName) {
        showToast(`${leftName} покинул занятие`);
      }
    };

    socket.on('room:userLeft', handleUserLeave);
    socket.on('participant:left', handleUserLeave);

    const handleCursorRemoved = ({ userId }: { userId: string }) => {
      if (!userId) return;
      setCursors((prev) => {
        if (!prev[userId]) return prev;
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    };
    socket.on('cursor:removed', handleCursorRemoved);

    socket.on('participant:voice:updated', ({ userId, micMuted, isSpeaking }: { userId: string; micMuted: boolean; isSpeaking: boolean }) => {
      setParticipants((prev) => {
        if (!prev[userId]) return prev;
        return {
          ...prev,
          [userId]: {
            ...prev[userId],
            micMuted,
            isSpeaking,
          },
        };
      });
    });

    socket.on('participant:updated', (updatedUser: Participant) => {
      if (updatedUser?.id) {
        setParticipants((prev) => ({
          ...prev,
          [updatedUser.id]: updatedUser,
        }));
      }
    });

    // Real-time Whiteboard socket events
    socket.on('board:element:created', ({ element, pageIndex: pIndex }: { element: any; pageIndex: number }) => {
      setPages((prev) => {
        const list = prev[pIndex] || [];
        if (list.some((el) => el.id === element.id)) return prev;
        return {
          ...prev,
          [pIndex]: [...list, element],
        };
      });
    });

    socket.on('board:element:updated', ({ element, pageIndex: pIndex }: { element: any; pageIndex: number }) => {
      setPages((prev) => {
        const list = prev[pIndex] || [];
        return {
          ...prev,
          [pIndex]: list.map((el) => (el.id === element.id ? element : el)),
        };
      });
    });

    socket.on('board:elements:deleted', ({ elementIds, pageIndex: pIndex }: { elementIds: string[]; pageIndex: number }) => {
      const set = new Set(elementIds || []);
      setPages((prev) => ({
        ...prev,
        [pIndex]: (prev[pIndex] || []).filter((el) => !set.has(el.id)),
      }));
    });

    socket.on('board:elements:deletedBatch', ({ elementIds, pageIndex: pIndex }: { elementIds: string[]; pageIndex: number }) => {
      const set = new Set(elementIds || []);
      setPages((prev) => ({
        ...prev,
        [pIndex]: (prev[pIndex] || []).filter((el) => !set.has(el.id)),
      }));
    });

    socket.on('board:elements:replaced', ({ elements: newElements, pageIndex: pIndex }: { elements: any[]; pageIndex: number }) => {
      setPages((prev) => ({
        ...prev,
        [pIndex]: newElements || [],
      }));
    });

    const handleClearPageEvent = ({ pageIndex: pIndex }: { pageIndex: number }) => {
      setPages((prev) => ({
        ...prev,
        [pIndex]: [],
      }));
      showToast(`Страница ${pIndex + 1} очищена`);
    };

    socket.on('board:page:cleared', handleClearPageEvent);
    socket.on('board:cleared', handleClearPageEvent);

    socket.on('board:page:changed', ({ pageIndex: newIdx }: { pageIndex: number }) => {
      if (typeof newIdx === 'number') {
        setActivePageIndex(newIdx);
      }
    });

    socket.on('board:page:added', ({ totalPages: tPages, activePageIndex: aIdx }: { totalPages: number; activePageIndex: number }) => {
      if (typeof tPages === 'number') setTotalPages(tPages);
      if (typeof aIdx === 'number') setActivePageIndex(aIdx);
    });

    const handleBackgroundUpdate = ({ background: newBg }: { background: any }) => {
      if (newBg) setBackground(newBg);
    };

    socket.on('board:background:updated', handleBackgroundUpdate);
    socket.on('board:background:changed', handleBackgroundUpdate);

    const handleLockUpdate = ({ isLocked: locked }: { isLocked: boolean }) => {
      setIsLocked(locked);
      showToast(locked ? '🔒 Преподаватель заблокировал доску для учеников' : '🔓 Доска открыта для рисования');
    };

    socket.on('board:lock:updated', handleLockUpdate);
    socket.on('board:lock:changed', handleLockUpdate);

    // Ephemeral multiplayer sockets
    socket.on('cursor:moved', (data: any) => {
      const cUserId = data.userId;
      if (!cUserId) return;
      const cName = data.userName || 'Пользователь';
      setCursors((prev) => {
        const next: Record<string, CursorPosition> = {};
        for (const [uid, cur] of Object.entries(prev) as [string, CursorPosition][]) {
          // Keep all active cursors, but deduplicate if this user previously had another socket ID
          if (uid === 'self' || (uid !== cUserId && cur?.userName !== cName)) {
            next[uid] = cur;
          }
        }
        next[cUserId] = {
          userId: cUserId,
          x: data.x,
          y: data.y,
          userName: cName,
          color: data.color || data.userColor || '#2563EB',
          role: data.role || data.userRole || 'student',
          avatar: data.avatar || data.userAvatar || '🎓',
          lastActive: Date.now(),
        };
        return next;
      });
    });

    const handleLaser = (point: LaserPoint) => {
      setLaserPoints((prev) => [...prev.slice(-40), point]);
    };

    socket.on('laser:pointer', handleLaser);
    socket.on('board:lasered', handleLaser);

    // Tutor superpower events
    socket.on('tutor:cheered', ({ message }) => {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.5 },
      });
      showToast(`🌟 ${message || 'Отличная работа!'}`);
    });

    const handleAttention = ({ message, text }: { message?: string; text?: string }) => {
      showToast(`🔔 ${message || text || 'Внимание на доску!'}`);
    };

    socket.on('tutor:attentioned', handleAttention);
    socket.on('tutor:attention:ping', handleAttention);

    // Chat socket
    socket.on('chat:message', (msg: ChatMessage) => {
      setChatMessages((prev) => [...prev, msg]);
      if (!isChatOpen) {
        setUnreadChatCount((prev) => prev + 1);
      }
    });

    // Connection lifecycle & Resync
    socket.on('disconnect', (reason) => {
      console.warn('[Socket] Disconnected from server:', reason);
      setIsReconnecting(true);
    });

    socket.on('connect', () => {
      console.log('[Socket] Connected / Reconnected. Resyncing room state...');
      setIsReconnecting(false);
      // Resend room:join and board:request_sync
      socket.emit('room:join', joinPayload);
      socket.emit('board:request_sync', { roomId: targetRoomId });
      // Reset voice WebRTC peers so audio reconnects cleanly
      voiceManager.resetPeers();
    });

    socket.on('reconnect', (attemptNumber) => {
      console.log('[Socket] Reconnect success after attempts:', attemptNumber);
      setIsReconnecting(false);
      socket.emit('room:join', joinPayload);
      socket.emit('board:request_sync', { roomId: targetRoomId });
      voiceManager.resetPeers();
      showToast('✅ Соединение с доской восстановлено');
    });
  };

  // Online / Offline Window Listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      setIsReconnecting(false);
      showToast('🌐 Интернет-соединение появилось');
      const socket = forceReconnectSocket();
      if (isInRoom && roomId) {
        socket.emit('board:request_sync', { roomId });
        voiceManager.resetPeers();
      }
    };

    const handleOffline = () => {
      setIsOffline(true);
      setIsReconnecting(true);
      showToast('📡 Интернет отключен. Ожидание сети...');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isInRoom, roomId]);

  // Keep cursors synchronized with active participants without dropping stationary/idle cursors
  useEffect(() => {
    const activeIds = new Set(Object.keys(participants));
    setCursors((prev) => {
      let changed = false;
      const next: Record<string, CursorPosition> = {};
      for (const [uid, cur] of Object.entries(prev) as [string, CursorPosition][]) {
        if (uid === 'self' || activeIds.has(uid)) {
          next[uid] = cur;
        } else {
          changed = true; // Dropped if user is no longer a room participant
        }
      }
      return changed ? next : prev;
    });
  }, [participants]);

  const handleManualReconnect = () => {
    setIsReconnecting(true);
    const socket = forceReconnectSocket();
    if (isInRoom && roomId) {
      const stored = localStorage.getItem(ACTIVE_ROOM_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          socket.emit('room:join', parsed);
        } catch {}
      }
      socket.emit('board:request_sync', { roomId });
      voiceManager.resetPeers();
    }
    setTimeout(() => {
      setIsReconnecting(false);
      showToast('🔄 Запрос на синхронизацию отправлен');
    }, 1200);
  };

  // Keyboard Shortcuts Handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return;
      }

      // Undo / Redo (supporting both English and Russian keyboard layouts)
      const isZ = e.code === 'KeyZ' || e.key.toLowerCase() === 'z' || e.key === 'я' || e.key === 'Я';
      const isY = e.code === 'KeyY' || e.key.toLowerCase() === 'y' || e.key === 'н' || e.key === 'Н';

      if ((e.ctrlKey || e.metaKey) && isZ) {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && isY) {
        e.preventDefault();
        handleRedo();
        return;
      }

      // Mute hotkey
      if (e.key.toLowerCase() === 'm' && !e.ctrlKey && !e.metaKey) {
        voiceManager.toggleMute();
        return;
      }

      // Custom tool keybinds
      const pressed = e.key.toLowerCase();
      if (pressed === keybinds.pen) setTool('pen');
      else if (pressed === keybinds.highlighter) setTool('highlighter');
      else if (pressed === keybinds.eraser) setTool('eraser');
      else if (pressed === keybinds.select) setTool('select');
      else if (pressed === keybinds.pan) setTool('pan');
      else if (pressed === keybinds.rect) setTool('rect');
      else if (pressed === keybinds.circle) setTool('circle');
      else if (pressed === keybinds.line) setTool('line');
      else if (pressed === keybinds.arrow) setTool('arrow');
      else if (pressed === keybinds.text) setTool('text');
      else if (pressed === keybinds.laser) setTool('laser');
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [keybinds, handleUndo, handleRedo]);

  const showToast = (msg: string) => {
    setNotificationToast(msg);
    setTimeout(() => {
      setNotificationToast(null);
    }, 4000);
  };

  const handlePageChange = (index: number) => {
    setActivePageIndex(index);
    getSocket().emit('board:page:change', { pageIndex: index });
  };

  const handleAddPage = () => {
    const nextIndex = totalPages;
    setTotalPages((prev) => prev + 1);
    setActivePageIndex(nextIndex);
    setPages((prev) => ({ ...prev, [nextIndex]: [] }));
    getSocket().emit('board:page:add', { pageIndex: nextIndex });
  };

  const handleClearPage = () => {
    if (window.confirm('Очистить всю текущую страницу доски?')) {
      const cleared = currentElements;
      if (cleared.length > 0) {
        handleRecordAction({ type: 'delete', elements: cleared });
      }
      setCurrentElements([]);
      getSocket().emit('board:page:clear', { pageIndex: activePageIndex });
    }
  };

  const handleImageUploaded = (imgEl: ImageElement) => {
    setCurrentElements((prev) => [...prev, imgEl]);
    getSocket().emit('board:element:create', { element: imgEl, pageIndex: activePageIndex });
    handleRecordAction({ type: 'create', elements: [imgEl] });
  };

  const handleExportPNG = () => {
    const canvas = document.querySelector('canvas') as HTMLCanvasElement;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `tutorboard-${roomTitle || roomId}-page${activePageIndex + 1}.png`;
    a.click();
  };

  const handleLeaveRoom = () => {
    if (window.confirm('Вы уверены, что хотите выйти из комнаты урока?')) {
      localStorage.removeItem(ACTIVE_ROOM_KEY);
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete('room');
        window.history.replaceState(null, '', url.pathname + url.search);
      } catch {}
      disconnectSocket();
      voiceManager.cleanup();
      setIsInRoom(false);
    }
  };

  // Restore active room session on page refresh
  useEffect(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const queryRoom = urlParams.get('room');
      const savedActiveRoom = localStorage.getItem(ACTIVE_ROOM_KEY);

      if (savedActiveRoom) {
        const parsed = JSON.parse(savedActiveRoom);
        if (parsed && (parsed.roomId || queryRoom)) {
          const targetRoom = queryRoom || parsed.roomId;
          const userSession = localStorage.getItem(STORAGE_KEY);
          let finalName = parsed.userName;
          let finalRole = parsed.role;
          let finalAvatar = parsed.avatar;
          let finalColor = parsed.color;

          if (userSession) {
            try {
              const u = JSON.parse(userSession)?.user;
              if (u) {
                if (u.name) finalName = u.name;
                if (u.role) finalRole = u.role;
                if (u.avatar) finalAvatar = u.avatar;
              }
            } catch {}
          }

          handleJoinRoom({
            roomId: targetRoom,
            userName: finalName || 'Пользователь',
            role: finalRole || 'student',
            color: finalColor || '#2563EB',
            avatar: finalAvatar || '🎓',
            title: parsed.title,
            subject: parsed.subject,
          });
        }
      }
    } catch (e) {
      console.error('Failed to auto-restore room session:', e);
    }
  }, []);

  const handleSaveKeybinds = (newBinds: KeybindSettings) => {
    setKeybinds(newBinds);
    localStorage.setItem(KEYBINDS_STORAGE_KEY, JSON.stringify(newBinds));
    showToast('Горячие клавиши успешно сохранены!');
  };

  const handleSaveProfile = ({
    userName: newName,
    avatar: newAvatar,
    color: newColor,
  }: {
    userName: string;
    avatar: string;
    color: string;
  }) => {
    if (newName) setUserName(newName);
    if (newAvatar) setUserAvatar(newAvatar);
    if (newColor) setUserColor(newColor);

    try {
      const session = localStorage.getItem(STORAGE_KEY);
      if (session) {
        const parsed = JSON.parse(session);
        if (parsed.user) {
          if (newName) parsed.user.name = newName;
          if (newAvatar) parsed.user.avatar = newAvatar;
          localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
          fetch('/api/user/avatar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: parsed.user.username, avatar: newAvatar, name: newName }),
          }).catch(() => {});
        }
      }
    } catch {}

    getSocket().emit('user:profile:update', {
      userName: newName,
      avatar: newAvatar,
      color: newColor,
    });
    showToast('✅ Профиль успешно обновлен!');
  };

  const handleAvatarChange = (avatar: string, newColor?: string) => {
    handleSaveProfile({
      userName,
      avatar,
      color: newColor || userColor,
    });
  };

  // If not logged in or in room, show Auth / Join Modal
  if (!isInRoom) {
    return <JoinModal onJoinRoom={handleJoinRoom} />;
  }

  const canEdit = !isLocked || userRole === 'tutor';
  const canUndo = (undoActions[activePageIndex]?.length || 0) > 0;
  const canRedo = (redoActions[activePageIndex]?.length || 0) > 0;

  return (
    <div
      id="tutorboard-app"
      className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 text-slate-900 font-sans selection:bg-blue-600 selection:text-white"
    >
      {/* Top Header with Room Code, 2-Button Toggle (Board/IDE), Timer & Tutor Superpowers */}
      <RoomHeader
        roomId={roomId}
        roomTitle={roomTitle}
        subject={subject}
        userRole={userRole}
        userName={userName}
        userColor={userColor}
        userAvatar={userAvatar}
        isLocked={isLocked}
        participants={participants}
        unreadChatCount={unreadChatCount}
        activeView={activeView}
        onToggleChat={() => {
          setIsChatOpen(!isChatOpen);
          if (!isChatOpen) setUnreadChatCount(0);
        }}
        onToggleParticipants={() => setIsParticipantsOpen(!isParticipantsOpen)}
        onLeaveRoom={handleLeaveRoom}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onSelectView={(view) => setActiveView(view)}
        onOpenAvatarPicker={() => setShowAvatarPicker(true)}
      />

      {/* Connection Drop & Reconnection Status Indicator Banner */}
      {(isReconnecting || isOffline) && (
        <div className="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-bold flex items-center justify-between shadow-md z-50 animate-pulse border-b border-amber-600">
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4 text-slate-950" />
            <span>
              {isOffline
                ? 'Отсутствует подключение к интернету. Доска перейдет в рабочий режим сразу при появлении сети.'
                : 'Связь с сервером прервалась. Выполняется автоматическое переподключение и восстановление данных...'}
            </span>
          </div>
          <button
            type="button"
            onClick={handleManualReconnect}
            className="flex items-center gap-1 px-3 py-1 bg-slate-900 text-white hover:bg-black rounded-lg text-xs font-semibold shadow-xs cursor-pointer transition"
          >
            <RefreshCw className={`w-3 h-3 ${isReconnecting ? 'animate-spin' : ''}`} />
            <span>Восстановить сейчас</span>
          </button>
        </div>
      )}

      {/* Main Workspace Area (Whiteboard OR Collaborative IDE) */}
      <div className="flex-1 relative flex overflow-hidden">
        {/* Collaborative Code IDE */}
        <div className={`flex-1 relative h-full w-full ${activeView === 'ide' ? 'flex flex-col' : 'hidden'}`}>
          <CodeIDE
            roomId={roomId}
            myUserId={myUserId}
            userName={userName}
            userRole={userRole}
            userColor={userColor}
            userAvatar={userAvatar}
            participants={participants}
            onBackToBoard={() => setActiveView('board')}
          />
        </div>

        {/* Central Whiteboard Canvas */}
        <div className={`flex-1 relative h-full w-full ${activeView === 'board' ? 'block' : 'hidden'}`}>
          <Canvas
            tool={tool}
            toolSettings={toolSettings}
            background={background}
            elements={currentElements}
            setElements={setCurrentElements}
            onRecordAction={handleRecordAction}
            pageIndex={activePageIndex}
            isLocked={isLocked}
            userRole={userRole}
            userName={userName}
            userColor={userColor}
            zoom={zoom}
            setZoom={setZoom}
            panOffset={panOffset}
            setPanOffset={setPanOffset}
            cursors={cursors}
            laserPoints={laserPoints}
            addLaserPoint={(lp) => setLaserPoints((prev) => [...prev.slice(-40), lp])}
            activeMathInsert={activeMathInsert}
            onMathInserted={() => setActiveMathInsert(undefined)}
          />

          {/* Vertical Toolbar Docked at Left Border */}
          <div className="absolute top-4 left-3 z-40">
            <Toolbar
              tool={tool}
              setTool={setTool}
              toolSettings={toolSettings}
              updateToolSetting={updateToolSetting}
              background={background}
              setBackground={setBackground}
              canEdit={canEdit}
              userRole={userRole}
              userName={userName}
              userColor={userColor}
              pageIndex={activePageIndex}
              totalPages={totalPages}
              onPageChange={handlePageChange}
              onAddPage={handleAddPage}
              onClearPage={handleClearPage}
              canUndo={canUndo}
              canRedo={canRedo}
              onUndo={handleUndo}
              onRedo={handleRedo}
              onImageUploaded={handleImageUploaded}
              onExport={handleExportPNG}
              onToggleMath={() => setIsMathOpen(!isMathOpen)}
              isMathOpen={isMathOpen}
            />
          </div>

          {/* Floating Math Symbols Drawer at Left (opens next to toolbar) */}
          {isMathOpen && (
            <div className="absolute top-4 left-16 z-40">
              <MathToolbar
                isOpen={isMathOpen}
                onToggle={() => setIsMathOpen(!isMathOpen)}
                onInsertSymbol={(sym) => {
                  setActiveMathInsert(sym);
                  setTool('text');
                  showToast(`Символ ${sym} готов к вставке в текст`);
                }}
              />
            </div>
          )}

          {/* Floating Bottom Voice Controls Bar */}
          <div className="absolute bottom-4 left-16 z-30 max-w-[calc(100%-160px)]">
            <VoiceControls
              participants={participants}
              currentUserId={myUserId}
              userRole={userRole}
              userName={userName}
            />
          </div>

          {/* Toast Notifications */}
          {notificationToast && (
            <div className="absolute top-4 right-4 z-50 bg-slate-900/90 backdrop-blur text-white px-4 py-2.5 rounded-2xl shadow-2xl text-xs font-semibold flex items-center gap-2 animate-in slide-in-from-top-4 border border-slate-700">
              <span>{notificationToast}</span>
            </div>
          )}
        </div>

        {/* Real-time Text Chat Drawer */}
        <ChatDrawer
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          messages={chatMessages}
          currentUserId={myUserId}
          userName={userName}
          userRole={userRole}
          userColor={userColor}
          userAvatar={userAvatar}
        />

        {/* Lesson Participants Drawer */}
        <ParticipantsDrawer
          isOpen={isParticipantsOpen}
          onClose={() => setIsParticipantsOpen(false)}
          participants={participants}
          currentUserId={myUserId}
          userRole={userRole}
          onChangeAvatar={() => setShowAvatarPicker(true)}
        />

        {/* Settings Modal (Keybinds) */}
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          keybinds={keybinds}
          onSaveKeybinds={handleSaveKeybinds}
        />

        {/* Profile & Avatar Customization Modal */}
        <AvatarPicker
          isOpen={showAvatarPicker}
          onClose={() => setShowAvatarPicker(false)}
          selectedAvatar={userAvatar}
          selectedColor={userColor}
          userName={userName}
          userRole={userRole}
          onSelectAvatar={handleAvatarChange}
          onSaveProfile={handleSaveProfile}
        />
      </div>
    </div>
  );
}
