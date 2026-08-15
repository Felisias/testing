import React, { useState, useEffect, useCallback } from 'react';
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
} from './types';
import { KeybindSettings, DEFAULT_KEYBINDS } from './types/extra';
import { getSocket, disconnectSocket } from './services/socket';
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

const KEYBINDS_STORAGE_KEY = 'tutorboard_keybinds';
const STORAGE_KEY = 'tutorboard_user_session';

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
  const [color, setColor] = useState('#1E293B');
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [background, setBackground] = useState<BackgroundType>('grid');
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [pages, setPages] = useState<{ [pageIndex: number]: WhiteboardElement[] }>({
    0: [],
  });
  const [isLocked, setIsLocked] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState<Point>({ x: 0, y: 0 });

  // Undo / Redo History for current user
  const [undoStack, setUndoStack] = useState<{ [pageIndex: number]: WhiteboardElement[][] }>({ 0: [] });
  const [redoStack, setRedoStack] = useState<{ [pageIndex: number]: WhiteboardElement[][] }>({ 0: [] });

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

        // Push to undo stack
        setUndoStack((prevUndo) => {
          const pageUndo = prevUndo[activePageIndex] || [];
          return {
            ...prevUndo,
            [activePageIndex]: [...pageUndo, currentList].slice(-30),
          };
        });
        setRedoStack((prevRedo) => ({ ...prevRedo, [activePageIndex]: [] }));

        return {
          ...prevPages,
          [activePageIndex]: newList,
        };
      });
    },
    [activePageIndex]
  );

  // Undo / Redo handlers with stable batch sync
  const handleUndo = useCallback(() => {
    setUndoStack((prevUndo) => {
      const pageUndo = prevUndo[activePageIndex] || [];
      if (pageUndo.length === 0) return prevUndo;

      const previousState = pageUndo[pageUndo.length - 1];
      const remainingUndo = pageUndo.slice(0, -1);
      const currentList = pages[activePageIndex] || [];

      setRedoStack((prevRedo) => {
        const pageRedo = prevRedo[activePageIndex] || [];
        return {
          ...prevRedo,
          [activePageIndex]: [...pageRedo, currentList],
        };
      });

      setPages((prevPages) => ({
        ...prevPages,
        [activePageIndex]: previousState,
      }));

      const socket = getSocket();
      socket.emit('board:elements:replace', {
        pageIndex: activePageIndex,
        elements: previousState,
      });

      return {
        ...prevUndo,
        [activePageIndex]: remainingUndo,
      };
    });
  }, [activePageIndex, pages]);

  const handleRedo = useCallback(() => {
    setRedoStack((prevRedo) => {
      const pageRedo = prevRedo[activePageIndex] || [];
      if (pageRedo.length === 0) return prevRedo;

      const nextState = pageRedo[pageRedo.length - 1];
      const remainingRedo = pageRedo.slice(0, -1);
      const currentList = pages[activePageIndex] || [];

      setUndoStack((prevUndo) => {
        const pageUndo = prevUndo[activePageIndex] || [];
        return {
          ...prevUndo,
          [activePageIndex]: [...pageUndo, currentList],
        };
      });

      setPages((prevPages) => ({
        ...prevPages,
        [activePageIndex]: nextState,
      }));

      const socket = getSocket();
      socket.emit('board:elements:replace', {
        pageIndex: activePageIndex,
        elements: nextState,
      });

      return {
        ...prevRedo,
        [activePageIndex]: remainingRedo,
      };
    });
  }, [activePageIndex, pages]);

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
  }) => {
    const socket = getSocket();
    if (!socket.connected) {
      socket.connect();
    }

    const av = targetAvatar || (targetRole === 'tutor' ? '👨‍🏫' : '🎓');
    setRoomId(targetRoomId);
    setUserName(targetName);
    setUserRole(targetRole);
    setUserColor(targetColor);
    setUserAvatar(av);

    socket.emit('room:join', {
      roomId: targetRoomId,
      userName: targetName,
      role: targetRole,
      color: targetColor,
      avatar: av,
      title: targetTitle,
      subject: targetSubject,
    });

    setIsInRoom(true);
  };

  // Live avatar selection
  const handleAvatarChange = (avatar: string, newColor?: string) => {
    setUserAvatar(avatar);
    if (newColor) setUserColor(newColor);

    const socket = getSocket();
    socket.emit('user:profile:update', {
      avatar,
      color: newColor || userColor,
    });

    // Update stored session if present
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.user) {
          parsed.user.avatar = avatar;
          localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
        }
      }
    } catch {}
  };

  // Socket event listeners
  useEffect(() => {
    if (!isInRoom) return;
    const socket = getSocket();

    socket.on('connect', () => {
      setMyUserId(socket.id || '');
    });

    socket.on('room:state', ({ room, self }: { room: any; self: Participant }) => {
      setMyUserId(self.id);
      setRoomTitle(room.title);
      setSubject(room.subject);
      setIsLocked(room.isLocked);
      setActivePageIndex(room.activePageIndex || 0);
      setTotalPages(room.totalPages || 1);
      setBackground(room.background || 'grid');
      setPages(room.pages || { 0: [] });
      setParticipants(room.participants || {});
      setChatMessages(room.chatMessages || []);

      // Automatically initiate WebRTC calls with all existing peers
      Object.keys(room.participants || {}).forEach((peerId) => {
        if (peerId !== self.id) {
          voiceManager.callPeer(peerId);
        }
      });
    });

    socket.on('participant:joined', (newParticipant: Participant) => {
      setParticipants((prev) => ({
        ...prev,
        [newParticipant.id]: newParticipant,
      }));
      // Call newly joined peer for voice
      voiceManager.callPeer(newParticipant.id);
    });

    socket.on('participant:left', ({ userId }: { userId: string }) => {
      setParticipants((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
      setCursors((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    });

    socket.on('participant:profile:updated', ({ userId, avatar, color }: { userId: string; avatar: string; color?: string }) => {
      setParticipants((prev) => {
        if (!prev[userId]) return prev;
        return {
          ...prev,
          [userId]: {
            ...prev[userId],
            avatar,
            color: color || prev[userId].color,
          },
        };
      });
    });

    // Whiteboard realtime synchronization
    socket.on(
      'board:element:created',
      ({ element, pageIndex }: { element: WhiteboardElement; pageIndex: number }) => {
        setPages((prev) => {
          const pageList = prev[pageIndex] || [];
          if (pageList.some((el) => el.id === element.id)) return prev;
          return {
            ...prev,
            [pageIndex]: [...pageList, element],
          };
        });
      }
    );

    socket.on(
      'board:element:updated',
      ({ element, pageIndex }: { element: WhiteboardElement; pageIndex: number }) => {
        setPages((prev) => {
          const pageList = prev[pageIndex] || [];
          const idx = pageList.findIndex((el) => el.id === element.id);
          if (idx === -1) {
            return { ...prev, [pageIndex]: [...pageList, element] };
          }
          const updated = [...pageList];
          updated[idx] = element;
          return { ...prev, [pageIndex]: updated };
        });
      }
    );

    socket.on(
      'board:element:deleted',
      ({ elementId, pageIndex }: { elementId: string; pageIndex: number }) => {
        setPages((prev) => {
          const pageList = prev[pageIndex] || [];
          return {
            ...prev,
            [pageIndex]: pageList.filter((el) => el.id !== elementId),
          };
        });
      }
    );

    socket.on(
      'board:elements:deletedBatch',
      ({ elementIds, pageIndex }: { elementIds: string[]; pageIndex: number }) => {
        const idsSet = new Set(elementIds);
        setPages((prev) => {
          const pageList = prev[pageIndex] || [];
          return {
            ...prev,
            [pageIndex]: pageList.filter((el) => !idsSet.has(el.id)),
          };
        });
      }
    );

    socket.on(
      'board:elements:replaced',
      ({ elements, pageIndex }: { elements: WhiteboardElement[]; pageIndex: number }) => {
        setPages((prev) => ({
          ...prev,
          [pageIndex]: elements || [],
        }));
      }
    );

    socket.on('board:cleared', ({ pageIndex }: { pageIndex: number }) => {
      setPages((prev) => ({
        ...prev,
        [pageIndex]: [],
      }));
    });

    socket.on('board:page:changed', ({ pageIndex }: { pageIndex: number }) => {
      setActivePageIndex(pageIndex);
    });

    socket.on(
      'board:page:added',
      ({ totalPages: newTotal, activePageIndex: newActive }: { totalPages: number; activePageIndex: number }) => {
        setTotalPages(newTotal);
        setActivePageIndex(newActive);
      }
    );

    socket.on('board:background:changed', ({ background: newBg }: { background: BackgroundType }) => {
      setBackground(newBg);
    });

    socket.on('board:lock:changed', ({ isLocked: newLock }: { isLocked: boolean }) => {
      setIsLocked(newLock);
      showToast(newLock ? 'Преподаватель заблокировал доску' : 'Преподаватель разрешил рисование');
    });

    socket.on('cursor:moved', (cursorData: CursorPosition & { pageIndex: number }) => {
      if (cursorData.pageIndex === activePageIndex) {
        setCursors((prev) => ({
          ...prev,
          [cursorData.userId]: cursorData,
        }));
      }
    });

    socket.on('board:lasered', (lp: LaserPoint & { pageIndex: number }) => {
      if (lp.pageIndex === activePageIndex) {
        setLaserPoints((prev) => [...prev.slice(-40), lp]);
      }
    });

    socket.on('chat:message', (msg: ChatMessage) => {
      setChatMessages((prev) => [...prev, msg]);
      if (!isChatOpen && msg.userId !== myUserId && msg.userId !== 'system') {
        setUnreadChatCount((count) => count + 1);
      }
    });

    socket.on(
      'participant:voice:updated',
      ({ userId, micMuted, isSpeaking }: { userId: string; micMuted: boolean; isSpeaking: boolean }) => {
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
      }
    );

    socket.on('tutor:cheered', ({ tutorName, message }: { tutorName: string; message: string }) => {
      confetti({
        particleCount: 120,
        spread: 90,
        origin: { y: 0.5 },
      });
      showToast(`🌟 ${tutorName}: ${message}`);
    });

    socket.on('tutor:attention:ping', ({ message }: { message: string }) => {
      showToast(`🔔 ${message}`);
    });

    return () => {
      socket.off('connect');
      socket.off('room:state');
      socket.off('participant:joined');
      socket.off('participant:left');
      socket.off('participant:profile:updated');
      socket.off('board:element:created');
      socket.off('board:element:updated');
      socket.off('board:element:deleted');
      socket.off('board:elements:deletedBatch');
      socket.off('board:elements:replaced');
      socket.off('board:cleared');
      socket.off('board:page:changed');
      socket.off('board:page:added');
      socket.off('board:background:changed');
      socket.off('board:lock:changed');
      socket.off('cursor:moved');
      socket.off('board:lasered');
      socket.off('chat:message');
      socket.off('participant:voice:updated');
      socket.off('tutor:cheered');
      socket.off('tutor:attention:ping');
    };
  }, [isInRoom, activePageIndex, isChatOpen, myUserId]);

  // Clean laser trails older than 1.5s
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setLaserPoints((prev) => prev.filter((p) => now - p.timestamp < 1500));
    }, 200);
    return () => clearInterval(timer);
  }, []);

  const showToast = (text: string) => {
    setNotificationToast(text);
    setTimeout(() => setNotificationToast(null), 4000);
  };

  const handlePageChange = (idx: number) => {
    if (idx >= 0 && idx < totalPages) {
      setActivePageIndex(idx);
      getSocket().emit('board:page:change', { pageIndex: idx });
    }
  };

  const handleAddPage = () => {
    getSocket().emit('board:page:add');
  };

  const handleClearPage = useCallback(() => {
    setCurrentElements([]);
    getSocket().emit('board:clear', { pageIndex: activePageIndex });
  }, [activePageIndex, setCurrentElements]);

  const handleImageUploaded = (imgElem: ImageElement) => {
    setCurrentElements((prev) => [...prev, imgElem]);
    getSocket().emit('board:element:create', {
      element: imgElem,
      pageIndex: activePageIndex,
    });
  };

  const handleLeaveRoom = () => {
    disconnectSocket();
    voiceManager.leave();
    setIsInRoom(false);
    setParticipants({});
    setCursors({});
    setPages({ 0: [] });
    setChatMessages([]);
  };

  const handleSaveKeybinds = (newKeybinds: KeybindSettings) => {
    setKeybinds(newKeybinds);
    localStorage.setItem(KEYBINDS_STORAGE_KEY, JSON.stringify(newKeybinds));
  };

  // Export board as PNG
  const handleExportPNG = () => {
    const canvas = document.querySelector('canvas') as HTMLCanvasElement;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `${roomTitle || 'tutorboard'}-page-${activePageIndex + 1}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement?.tagName?.toLowerCase();
      if (activeEl === 'input' || activeEl === 'textarea' || activeEl === 'select') {
        return;
      }

      const key = e.key.toLowerCase();
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;

      if (isCtrlOrCmd && key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }

      if (isCtrlOrCmd && (key === 'y' || (key === 'z' && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
        return;
      }

      if (key === keybinds.pen) setTool('pen');
      else if (key === keybinds.eraser) setTool('eraser');
      else if (key === keybinds.highlighter) setTool('highlighter');
      else if (key === keybinds.laser) setTool('laser');
      else if (key === keybinds.select) setTool('select');
      else if (key === keybinds.pan) setTool('pan');
      else if (key === keybinds.text) setTool('text');
      else if (key === keybinds.rectangle) setTool('rectangle');
      else if (key === keybinds.circle) setTool('circle');
      else if (key === keybinds.line) setTool('line');
      else if (key === keybinds.arrow) setTool('arrow');
      else if (key === keybinds.triangle) setTool('triangle');
      else if (key === keybinds.clear) handleClearPage();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [keybinds, handleUndo, handleRedo, handleClearPage]);

  if (!isInRoom) {
    return <JoinModal onJoinRoom={handleJoinRoom} />;
  }

  const canEdit = !isLocked || userRole === 'tutor';
  const canUndo = (undoStack[activePageIndex]?.length || 0) > 0;
  const canRedo = (redoStack[activePageIndex]?.length || 0) > 0;

  return (
    <div
      id="tutorboard-app"
      className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 text-slate-900 font-sans selection:bg-blue-600 selection:text-white"
    >
      {/* Top Header with Room Code, Timer, IDE toggle & Tutor Controls */}
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
        onToggleChat={() => {
          setIsChatOpen(!isChatOpen);
          if (!isChatOpen) setUnreadChatCount(0);
        }}
        onToggleParticipants={() => setIsParticipantsOpen(!isParticipantsOpen)}
        onLeaveRoom={handleLeaveRoom}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenIDE={() => setActiveView(activeView === 'ide' ? 'board' : 'ide')}
        onOpenAvatarPicker={() => setShowAvatarPicker(true)}
      />

      {/* Main Workspace Area (Whiteboard OR Collaborative IDE) */}
      <div className="flex-1 relative flex overflow-hidden">
        {activeView === 'ide' ? (
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
        ) : (
          /* Central Whiteboard Canvas */
          <div className="flex-1 relative h-full w-full">
            <Canvas
              tool={tool}
              color={color}
              strokeWidth={strokeWidth}
              background={background}
              elements={currentElements}
              setElements={setCurrentElements}
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
                color={color}
                setColor={setColor}
                strokeWidth={strokeWidth}
                setStrokeWidth={setStrokeWidth}
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
        )}

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

        {/* Avatar Picker Modal */}
        <AvatarPicker
          isOpen={showAvatarPicker}
          onClose={() => setShowAvatarPicker(false)}
          selectedAvatar={userAvatar}
          selectedColor={userColor}
          userName={userName}
          onSelectAvatar={handleAvatarChange}
        />
      </div>
    </div>
  );
}
