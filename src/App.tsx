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
  ToolSpecificSettings,
  DEFAULT_TOOL_SETTINGS,
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

// Helper to compare two element arrays
const isSameElementList = (a: WhiteboardElement[], b: WhiteboardElement[]): boolean => {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  return a.every((el, idx) => el.id === b[idx]?.id && el.updatedAt === b[idx]?.updatedAt);
};

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

        // Only push to undo stack if elements actually changed
        if (!isSameElementList(currentList, newList)) {
          setUndoStack((prevUndo) => {
            const pageUndo = prevUndo[activePageIndex] || [];
            return {
              ...prevUndo,
              [activePageIndex]: [...pageUndo, currentList].slice(-30),
            };
          });
          setRedoStack((prevRedo) => ({ ...prevRedo, [activePageIndex]: [] }));
        }

        return {
          ...prevPages,
          [activePageIndex]: newList,
        };
      });
    },
    [activePageIndex]
  );

  // Undo / Redo handlers with stable single-click response
  const handleUndo = useCallback(() => {
    setUndoStack((prevUndo) => {
      const pageUndo = [...(prevUndo[activePageIndex] || [])];
      if (pageUndo.length === 0) return prevUndo;

      const currentList = pages[activePageIndex] || [];
      let previousState = pageUndo.pop();

      // Skip duplicate consecutive states to guarantee single-click undo
      while (previousState && isSameElementList(previousState, currentList) && pageUndo.length > 0) {
        previousState = pageUndo.pop();
      }

      if (!previousState || isSameElementList(previousState, currentList)) {
        return prevUndo;
      }

      setRedoStack((prevRedo) => {
        const pageRedo = prevRedo[activePageIndex] || [];
        return {
          ...prevRedo,
          [activePageIndex]: [...pageRedo, currentList],
        };
      });

      setPages((prevPages) => ({
        ...prevPages,
        [activePageIndex]: previousState!,
      }));

      const socket = getSocket();
      socket.emit('board:elements:replace', {
        pageIndex: activePageIndex,
        elements: previousState,
      });

      return {
        ...prevUndo,
        [activePageIndex]: pageUndo,
      };
    });
  }, [activePageIndex, pages]);

  const handleRedo = useCallback(() => {
    setRedoStack((prevRedo) => {
      const pageRedo = [...(prevRedo[activePageIndex] || [])];
      if (pageRedo.length === 0) return prevRedo;

      const currentList = pages[activePageIndex] || [];
      let nextState = pageRedo.pop();

      while (nextState && isSameElementList(nextState, currentList) && pageRedo.length > 0) {
        nextState = pageRedo.pop();
      }

      if (!nextState || isSameElementList(nextState, currentList)) {
        return prevRedo;
      }

      setUndoStack((prevUndo) => {
        const pageUndo = prevUndo[activePageIndex] || [];
        return {
          ...prevUndo,
          [activePageIndex]: [...pageUndo, currentList],
        };
      });

      setPages((prevPages) => ({
        ...prevPages,
        [activePageIndex]: nextState!,
      }));

      const socket = getSocket();
      socket.emit('board:elements:replace', {
        pageIndex: activePageIndex,
        elements: nextState,
      });

      return {
        ...prevRedo,
        [activePageIndex]: pageRedo,
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

    const socket = getSocket();

    socket.emit('room:join', {
      roomId: targetRoomId,
      userName: targetName,
      role: targetRole,
      color: targetColor,
      avatar: targetAvatar || '🎓',
      title: targetTitle,
      subject: targetSubject,
    });

    socket.on('room:error', (err: { error: string }) => {
      setIsInRoom(false);
      showToast(`❌ ${err.error || 'Ошибка подключения к комнате'}`);
    });

    socket.on('room:joined', (data) => {
      setMyUserId(data.userId || socket.id);
      setIsLocked(!!data.isLocked);
      if (data.title) setRoomTitle(data.title);
      if (data.subject) setSubject(data.subject);

      if (data.boardState) {
        setPages(data.boardState.pages || { 0: [] });
        setBackground(data.boardState.background || 'grid');
        setTotalPages(data.boardState.totalPages || 1);
        setActivePageIndex(data.boardState.activePageIndex || 0);
      }
    });

    socket.on('room:participants', (list: Participant[]) => {
      const map: Record<string, Participant> = {};
      list.forEach((p) => {
        map[p.id] = p;
      });
      setParticipants(map);
    });

    socket.on('room:userJoined', (p: Participant) => {
      setParticipants((prev) => ({ ...prev, [p.id]: p }));
      showToast(`${p.name} (${p.role === 'tutor' ? 'Преподаватель' : 'Ученик'}) присоединился к уроку`);
    });

    socket.on('room:userLeft', ({ userId, userName: leftName }) => {
      setParticipants((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
      if (leftName) {
        showToast(`${leftName} покинул занятие`);
      }
    });

    // Real-time Whiteboard socket events
    socket.on('board:element:created', ({ element, pageIndex: pIndex }) => {
      setPages((prev) => {
        const list = prev[pIndex] || [];
        if (list.some((el) => el.id === element.id)) return prev;
        return {
          ...prev,
          [pIndex]: [...list, element],
        };
      });
    });

    socket.on('board:element:updated', ({ element, pageIndex: pIndex }) => {
      setPages((prev) => {
        const list = prev[pIndex] || [];
        return {
          ...prev,
          [pIndex]: list.map((el) => (el.id === element.id ? element : el)),
        };
      });
    });

    socket.on('board:elements:deleted', ({ elementIds, pageIndex: pIndex }) => {
      const set = new Set(elementIds);
      setPages((prev) => ({
        ...prev,
        [pIndex]: (prev[pIndex] || []).filter((el) => !set.has(el.id)),
      }));
    });

    socket.on('board:elements:replaced', ({ elements: newElements, pageIndex: pIndex }) => {
      setPages((prev) => ({
        ...prev,
        [pIndex]: newElements,
      }));
    });

    socket.on('board:page:cleared', ({ pageIndex: pIndex }) => {
      setPages((prev) => ({
        ...prev,
        [pIndex]: [],
      }));
      showToast(`Страница ${pIndex + 1} очищена`);
    });

    socket.on('board:background:updated', ({ background: newBg }) => {
      setBackground(newBg);
    });

    socket.on('board:lock:updated', ({ isLocked: locked }) => {
      setIsLocked(locked);
      showToast(locked ? '🔒 Преподаватель заблокировал доску для учеников' : '🔓 Доска открыта для рисования');
    });

    // Ephemeral multiplayer sockets
    socket.on('cursor:moved', ({ userId, x, y, userName: cName, userColor: cColor, pageIndex: cPage }) => {
      if (cPage === activePageIndex) {
        setCursors((prev) => ({
          ...prev,
          [userId]: {
            x,
            y,
            userName: cName,
            userColor: cColor,
            lastActive: Date.now(),
          },
        }));
      }
    });

    socket.on('laser:pointer', (point: LaserPoint) => {
      setLaserPoints((prev) => [...prev.slice(-40), point]);
    });

    // Tutor superpower events
    socket.on('tutor:cheered', ({ message }) => {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.5 },
      });
      showToast(`🌟 ${message || 'Отличная работа!'}`);
    });

    socket.on('tutor:attentioned', ({ text }) => {
      showToast(`🔔 ${text || 'Внимание на доску!'}`);
    });

    // Chat socket
    socket.on('chat:message', (msg: ChatMessage) => {
      setChatMessages((prev) => [...prev, msg]);
      if (!isChatOpen) {
        setUnreadChatCount((prev) => prev + 1);
      }
    });
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

      // Undo / Redo
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
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
      setCurrentElements([]);
      getSocket().emit('board:page:clear', { pageIndex: activePageIndex });
    }
  };

  const handleImageUploaded = (imgEl: ImageElement) => {
    setCurrentElements((prev) => [...prev, imgEl]);
    getSocket().emit('board:element:create', { element: imgEl, pageIndex: activePageIndex });
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
      disconnectSocket();
      voiceManager.cleanup();
      setIsInRoom(false);
    }
  };

  const handleSaveKeybinds = (newBinds: KeybindSettings) => {
    setKeybinds(newBinds);
    localStorage.setItem(KEYBINDS_STORAGE_KEY, JSON.stringify(newBinds));
    showToast('Горячие клавиши успешно сохранены!');
  };

  const handleAvatarChange = (avatar: string, newColor?: string) => {
    setUserAvatar(avatar);
    if (newColor) setUserColor(newColor);

    try {
      const session = localStorage.getItem(STORAGE_KEY);
      if (session) {
        const parsed = JSON.parse(session);
        if (parsed.user) {
          parsed.user.avatar = avatar;
          localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
          fetch('/api/user/avatar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: parsed.user.username, avatar }),
          }).catch(() => {});
        }
      }
    } catch {}

    getSocket().emit('user:avatar:update', {
      avatar,
      color: newColor || userColor,
    });
    showToast('Аватар обновлен!');
  };

  // If not logged in or in room, show Auth / Join Modal
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
              toolSettings={toolSettings}
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
