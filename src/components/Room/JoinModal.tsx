import React, { useState, useEffect, useCallback } from 'react';
import { UserRole, UserAccount, SavedBoard } from '../../types';
import { UserAvatar } from '../Common/UserAvatar';
import { AvatarPicker } from '../Common/AvatarPicker';
import { UsersListModal } from './UsersListModal';
import {
  GraduationCap,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  KeyRound,
  LogOut,
  Clock,
  Trash2,
  Clipboard,
  RefreshCw,
  User,
  Lock,
  Eye,
  EyeOff,
  Plus,
  Compass,
  Check,
  Users,
  Layers,
  Copy,
  BookOpen,
} from 'lucide-react';

interface AuthModalProps {
  onJoinRoom: (params: {
    roomId: string;
    userName: string;
    role: UserRole;
    color: string;
    avatar?: string;
    title?: string;
    subject?: string;
    userId?: string;
  }) => void;
}

interface RoomStatusInfo {
  exists: boolean;
  id: string;
  title?: string;
  subject?: string;
  participantCount: number;
  totalPages?: number;
  activePageIndex?: number;
  isLocked?: boolean;
}

const AVATAR_COLORS = [
  '#2563EB', // Blue
  '#0D9488', // Teal
  '#16A34A', // Green
  '#D97706', // Amber
  '#DC2626', // Red
  '#9333EA', // Purple
  '#DB2777', // Pink
  '#4F46E5', // Indigo
];

const ROOM_ICONS = ['🎓', '📐', '💻', '🔬', '📚', '💡', '⚡', '🎨', '🚀', '✍️', '🎯', '🧪', '🧩', '🏆', '🌟', '🧠'];

const STORAGE_KEY = 'tutorboard_user_session';
const RECENT_ROOMS_KEY = 'tutorboard_recent_rooms';
const TUTOR_SECRET_KEY = 'JDH6188';

export function normalizeRoomCode(raw: string): string {
  if (!raw) return '';
  let id = String(raw).trim().toUpperCase();

  const cyrillicToLatinMap: Record<string, string> = {
    'А': 'A', 'В': 'B', 'С': 'C', 'Е': 'E', 'Н': 'H',
    'К': 'K', 'М': 'M', 'О': 'O', 'Р': 'P', 'Т': 'T',
    'Х': 'X', 'У': 'Y', 'а': 'A', 'в': 'B', 'с': 'C',
    'е': 'E', 'н': 'H', 'к': 'K', 'м': 'M', 'о': 'O',
    'р': 'P', 'т': 'T', 'х': 'X', 'у': 'Y',
  };
  id = id.split('').map((char) => cyrillicToLatinMap[char] || char).join('');
  id = id.replace(/\s+/g, '-').replace(/-+/g, '-');
  return id;
}

export const JoinModal: React.FC<AuthModalProps> = ({ onJoinRoom }) => {
  // Session & User
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [savedBoards, setSavedBoards] = useState<SavedBoard[]>([]);
  const [roomStatuses, setRoomStatuses] = useState<Record<string, RoomStatusInfo>>({});
  const [isRefreshingStatuses, setIsRefreshingStatuses] = useState(false);
  const [copiedCardId, setCopiedCardId] = useState<string | null>(null);

  // Auth Modes: 'login' | 'register' | 'guest'
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'guest'>('login');

  // Form Fields - Login
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Form Fields - Register
  const [regName, setRegName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regRole, setRegRole] = useState<UserRole>('student');
  const [regTutorCode, setRegTutorCode] = useState('');
  const [regAvatar, setRegAvatar] = useState('🎓');

  // Form Fields - Guest
  const [guestName, setGuestName] = useState('');
  const [guestInviteCode, setGuestInviteCode] = useState('');
  const [guestAvatar, setGuestAvatar] = useState('🎓');
  const [guestRole, setGuestRole] = useState<UserRole>('student');

  // Logged-in Room Action Tab: 'join' | 'create'
  const [roomTab, setRoomTab] = useState<'join' | 'create'>('join');
  const [inviteKeyInput, setInviteKeyInput] = useState('');
  const [roomIcon, setRoomIcon] = useState('🎓');
  const [lessonTitle, setLessonTitle] = useState('Урок с преподавателем');
  const [userColor, setUserColor] = useState(AVATAR_COLORS[0]);

  // Modals & UI States
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [showUsersModal, setShowUsersModal] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [copiedNotification, setCopiedNotification] = useState<string | null>(null);

  // Fetch status batch for saved boards
  const fetchRoomStatuses = useCallback(async (boards: SavedBoard[]) => {
    if (!boards || boards.length === 0) return;
    try {
      setIsRefreshingStatuses(true);
      const roomIds = boards.map((b) => b.id);
      const res = await fetch('/api/rooms/status-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomIds }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.statuses) {
          setRoomStatuses(data.statuses);
        }
      }
    } catch (e) {
      console.warn('Could not fetch room statuses:', e);
    } finally {
      setIsRefreshingStatuses(false);
    }
  }, []);

  // Poll room statuses periodically
  useEffect(() => {
    if (savedBoards.length > 0) {
      fetchRoomStatuses(savedBoards);
      const interval = setInterval(() => {
        fetchRoomStatuses(savedBoards);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [savedBoards, fetchRoomStatuses]);

  // Load session & history
  useEffect(() => {
    try {
      const storedSession = localStorage.getItem(STORAGE_KEY);
      let localRecent: SavedBoard[] = [];
      const storedRecent = localStorage.getItem(RECENT_ROOMS_KEY);
      if (storedRecent) {
        localRecent = JSON.parse(storedRecent);
      }

      if (storedSession) {
        const parsed = JSON.parse(storedSession);
        if (parsed?.user) {
          const user: UserAccount = parsed.user;
          setCurrentUser(user);
          if (user.avatar) setRegAvatar(user.avatar);
          setRoomTab(user.role === 'tutor' ? 'create' : 'join');

          const allBoards = [...(parsed.savedBoards || []), ...localRecent];
          const map = new Map<string, SavedBoard>();
          allBoards.forEach((b) => {
            if (b.id && !map.has(b.id)) map.set(b.id, b);
          });
          const merged = Array.from(map.values());
          setSavedBoards(merged);

          fetch(`/api/user/boards?username=${encodeURIComponent(user.username)}`)
            .then((r) => r.json())
            .then((data) => {
              if (data?.savedBoards) {
                const srvMap = new Map<string, SavedBoard>();
                data.savedBoards.forEach((b: SavedBoard) => srvMap.set(b.id, b));
                merged.forEach((b) => {
                  if (!srvMap.has(b.id)) srvMap.set(b.id, b);
                });
                const finalBoards = Array.from(srvMap.values());
                setSavedBoards(finalBoards);
                fetchRoomStatuses(finalBoards);
              }
            })
            .catch(() => {});
        }
      } else {
        if (localRecent.length > 0) {
          setSavedBoards(localRecent);
          fetchRoomStatuses(localRecent);
        }
      }
    } catch (err) {
      console.warn('Session init error:', err);
    }
  }, [fetchRoomStatuses]);

  // Check URL query param ?invite=CODE or legacy ?room=CODE
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlInvite = params.get('invite') || params.get('room');
    if (urlInvite) {
      const code = urlInvite.trim().toUpperCase();
      setInviteKeyInput(code);
      setGuestInviteCode(code);
      setRoomTab('join');
    }
  }, []);

  const saveRoomToHistory = (id: string, title: string, subject: string, role: UserRole) => {
    const entry: SavedBoard = {
      id,
      title,
      subject,
      role,
      lastVisited: Date.now(),
    };

    try {
      const existing = localStorage.getItem(RECENT_ROOMS_KEY);
      let list: SavedBoard[] = existing ? JSON.parse(existing) : [];
      list = list.filter((b) => b.id !== id);
      list.unshift(entry);
      localStorage.setItem(RECENT_ROOMS_KEY, JSON.stringify(list.slice(0, 30)));
      setSavedBoards(list);
      fetchRoomStatuses(list);
    } catch {}

    if (currentUser) {
      fetch('/api/user/boards/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: currentUser.username, board: entry }),
      }).catch(() => {});
    }
  };

  const handleDeleteSavedRoom = (idToDelete: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const filtered = savedBoards.filter((b) => b.id !== idToDelete);
    setSavedBoards(filtered);
    try {
      localStorage.setItem(RECENT_ROOMS_KEY, JSON.stringify(filtered));
    } catch {}
  };

  // Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: loginUsername.trim(),
          password: loginPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Неверный логин или пароль');
      }

      const user: UserAccount = data.user;
      const boards: SavedBoard[] = data.savedBoards || [];
      setCurrentUser(user);
      setSavedBoards(boards);
      if (user.avatar) setRegAvatar(user.avatar);
      setRoomTab(user.role === 'tutor' ? 'create' : 'join');
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ user, savedBoards: boards }));
    } catch (err: any) {
      setAuthError(err.message || 'Ошибка авторизации');
    } finally {
      setAuthLoading(false);
    }
  };

  // Handle Registration
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (!regName.trim() || !regUsername.trim() || !regPassword) {
      setAuthError('Заполните все обязательные поля');
      return;
    }

    if (regRole === 'tutor' && regTutorCode.trim() !== TUTOR_SECRET_KEY) {
      setAuthError('Неверный секретный ключ преподавателя');
      return;
    }

    setAuthLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: regUsername.trim(),
          name: regName.trim(),
          password: regPassword,
          tutorCode: regRole === 'tutor' ? regTutorCode.trim() : undefined,
          avatar: regAvatar,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Ошибка при создании аккаунта');
      }

      const user: UserAccount = data.user;
      setCurrentUser(user);
      setRoomTab(user.role === 'tutor' ? 'create' : 'join');
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ user, savedBoards: [] }));
    } catch (err: any) {
      setAuthError(err.message || 'Ошибка регистрации');
    } finally {
      setAuthLoading(false);
    }
  };

  // Helper function to redeem invite key or join existing active room
  const redeemOrJoin = async (key: string, name: string, username?: string, avatar?: string) => {
    const cleanKey = normalizeRoomCode(key);
    if (!cleanKey) {
      throw new Error('Введите одноразовый ключ доступа от преподавателя');
    }

    // 1. First try redeeming as one-time invite key
    try {
      const inviteRes = await fetch('/api/invite-code/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: cleanKey,
          username: username || 'guest',
          name,
        }),
      });

      const inviteData = await inviteRes.json();
      if (inviteRes.ok && inviteData?.roomId) {
        return {
          roomId: inviteData.roomId,
          title: inviteData.title || `Занятие ${inviteData.roomId}`,
          subject: inviteData.subject || 'Занятие',
        };
      } else if (!inviteRes.ok && inviteData?.error && !inviteData.error.includes('не найден')) {
        // If it's explicitly "already used", throw exact server error
        throw new Error(inviteData.error);
      }
    } catch (e: any) {
      if (e?.message && !e.message.includes('не найден')) {
        throw e;
      }
    }

    // 2. Fallback: check if it's an existing room (e.g. for restored links)
    const checkRes = await fetch(`/api/rooms/${encodeURIComponent(cleanKey)}`);
    if (checkRes.ok) {
      const roomData = await checkRes.json();
      if (roomData && roomData.exists) {
        return {
          roomId: roomData.id || cleanKey,
          title: roomData.title || `Занятие ${cleanKey}`,
          subject: roomData.subject || 'Занятие',
        };
      }
    }

    throw new Error(`Одноразовый ключ "${cleanKey}" не найден или уже был использован. Запросите новый ключ у преподавателя.`);
  };

  // Handle Quick Guest Entry
  const handleGuestEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    const name = guestName.trim();
    const key = guestInviteCode.trim();

    if (!name) {
      setAuthError('Укажите ваше имя');
      return;
    }

    if (!key) {
      setAuthError('Введите одноразовый ключ от преподавателя (например INV-XXXX)');
      return;
    }

    setAuthLoading(true);
    try {
      const roomInfo = await redeemOrJoin(key, name, undefined, guestAvatar);
      saveRoomToHistory(roomInfo.roomId, roomInfo.title, roomInfo.subject, 'student');

      onJoinRoom({
        roomId: roomInfo.roomId,
        userName: name,
        role: 'student',
        color: userColor,
        avatar: guestAvatar,
        title: roomInfo.title,
        subject: roomInfo.subject,
      });
    } catch (err: any) {
      setAuthError(err?.message || 'Не удалось активировать ключ доступа.');
    } finally {
      setAuthLoading(false);
    }
  };

  // Handle Logged-In User Join / Create
  const handleUserRoomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setAuthError(null);

    const isStudent = currentUser.role === 'student';

    // Students or tutor entering via key in 'join' tab
    if (isStudent || roomTab === 'join') {
      const key = inviteKeyInput.trim();
      if (!key) {
        setAuthError('Введите одноразовый ключ доступа от преподавателя (например INV-XXXX)');
        return;
      }

      setAuthLoading(true);
      try {
        const roomInfo = await redeemOrJoin(key, currentUser.name, currentUser.username, currentUser.avatar || regAvatar);
        saveRoomToHistory(roomInfo.roomId, roomInfo.title, roomInfo.subject, currentUser.role);

        onJoinRoom({
          roomId: roomInfo.roomId,
          userName: currentUser.name,
          role: currentUser.role,
          color: userColor,
          avatar: currentUser.avatar || regAvatar,
          userId: currentUser.id,
          title: roomInfo.title,
          subject: roomInfo.subject,
        });
      } catch (err: any) {
        setAuthError(err?.message || 'Не удалось активировать ключ.');
      } finally {
        setAuthLoading(false);
      }
      return;
    }

    // Tutor creating a brand new room (auto-assigned unique internal ID)
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const targetCode = `ROOM-${randomNum}`;
    const title = `${roomIcon} ${lessonTitle.trim() || 'Урок'}`;
    const subject = 'Занятие';

    saveRoomToHistory(targetCode, title, subject, currentUser.role);

    onJoinRoom({
      roomId: targetCode,
      userName: currentUser.name,
      role: 'tutor',
      color: userColor,
      avatar: currentUser.avatar || regAvatar,
      title,
      subject,
      userId: currentUser.id,
    });
  };

  // Join Saved Board
  const handleOpenSavedBoard = async (board: SavedBoard) => {
    const role = currentUser ? currentUser.role : board.role || 'student';
    const name = currentUser ? currentUser.name : 'Участник';
    const avatar = currentUser?.avatar || regAvatar;

    setAuthError(null);

    const normBoardId = normalizeRoomCode(board.id);
    saveRoomToHistory(normBoardId, board.title, board.subject, role);

    onJoinRoom({
      roomId: normBoardId,
      userName: name,
      role,
      color: userColor,
      avatar,
      title: board.title,
      subject: board.subject,
      userId: currentUser?.id,
    });
  };

  // Logout
  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setCurrentUser(null);
    setAuthMode('login');
    setAuthError(null);
  };

  // Paste from clipboard helper
  const handlePasteClipboard = async (setter: (val: string) => void) => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setter(text.trim().toUpperCase());
        showNotice('Вставлено из буфера');
      }
    } catch {
      showNotice('Разрешите доступ к буферу');
    }
  };

  const showNotice = (msg: string) => {
    setCopiedNotification(msg);
    setTimeout(() => setCopiedNotification(null), 2500);
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return `Сегодня в ${date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
    }
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  };

  return (
    <div
      id="tutorboard-auth-screen"
      className="min-h-screen bg-slate-50 text-slate-800 flex flex-col justify-center items-center p-4 selection:bg-blue-600 selection:text-white relative overflow-hidden"
    >
      {/* Ambient background soft glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-blue-200/40 via-indigo-100/30 to-transparent rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-[480px] z-10">
        {/* Main Card Container */}
        <div className="bg-white/95 backdrop-blur-xl border border-slate-200/90 rounded-3xl shadow-xl shadow-slate-200/60 overflow-hidden transition-all duration-200">
          {/* Header Banner */}
          <div className="p-6 pb-4 border-b border-slate-100 flex items-center justify-between bg-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-600/20">
                <GraduationCap className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-base font-bold tracking-tight text-slate-900 flex items-center gap-2">
                  <span>TutorBoard</span>
                </h1>
                <p className="text-xs text-slate-500">Интерактивная доска для занятий</p>
              </div>
            </div>

            {currentUser && (
              <div className="flex items-center gap-2">
                {currentUser.role === 'tutor' && (
                  <button
                    onClick={() => setShowUsersModal(true)}
                    title="Список зарегистрированных пользователей"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200/80 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 transition cursor-pointer"
                  >
                    <Users className="w-3.5 h-3.5 text-blue-600" />
                    <span>Пользователи</span>
                  </button>
                )}
                <button
                  onClick={handleLogout}
                  title="Сменить аккаунт"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200/80 border border-slate-200/80 rounded-xl text-xs font-medium text-slate-600 hover:text-rose-600 transition cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Выйти</span>
                </button>
              </div>
            )}
          </div>

          {/* User Profile Strip (When Logged In) */}
          {currentUser && (
            <div className="px-6 py-3.5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowAvatarModal(true)}
                  title="Изменить аватарку"
                  className="relative group cursor-pointer"
                >
                  <UserAvatar
                    avatar={currentUser.avatar || regAvatar}
                    name={currentUser.name}
                    color={userColor}
                    size="sm"
                    className="ring-2 ring-blue-500/30 group-hover:scale-105 transition"
                  />
                  <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[8px] shadow-sm">
                    ✎
                  </span>
                </button>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-900">{currentUser.name}</span>
                    <span className="text-[11px] text-slate-500 font-mono">@{currentUser.username}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAvatarModal(true)}
                    className="text-[11px] text-blue-600 hover:text-blue-700 font-medium transition cursor-pointer"
                  >
                    Сменить аватар
                  </button>
                </div>
              </div>

              <span
                className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold tracking-wide flex items-center gap-1 ${
                  currentUser.role === 'tutor'
                    ? 'bg-amber-50 text-amber-800 border border-amber-200/80'
                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200/80'
                }`}
              >
                {currentUser.role === 'tutor' ? '👨‍🏫 Преподаватель' : '🎓 Ученик'}
              </span>
            </div>
          )}

          {/* Body Section */}
          <div className="p-6">
            {/* Error Message */}
            {authError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs flex items-center gap-2 animate-in fade-in duration-150">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span className="font-medium">{authError}</span>
              </div>
            )}

            {/* Notification Toast */}
            {copiedNotification && (
              <div className="mb-4 p-2.5 bg-blue-50 border border-blue-200 text-blue-800 rounded-2xl text-xs flex items-center justify-center gap-1.5 animate-in fade-in">
                <Check className="w-3.5 h-3.5 text-blue-600" />
                <span className="font-medium">{copiedNotification}</span>
              </div>
            )}

            {/* ----------------- NOT LOGGED IN ----------------- */}
            {!currentUser ? (
              <div>
                {/* Segmented Auth Mode Switcher */}
                <div className="grid grid-cols-3 gap-1 bg-slate-100/90 p-1 rounded-2xl border border-slate-200/70 mb-5">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('login');
                      setAuthError(null);
                    }}
                    className={`py-2 px-2.5 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      authMode === 'login'
                        ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60 font-bold'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Вход</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('register');
                      setAuthError(null);
                    }}
                    className={`py-2 px-2.5 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      authMode === 'register'
                        ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60 font-bold'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                    <span>Регистрация</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('guest');
                      setAuthError(null);
                    }}
                    className={`py-2 px-2.5 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      authMode === 'guest'
                        ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60 font-bold'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Compass className="w-3.5 h-3.5" />
                    <span>Гость</span>
                  </button>
                </div>

                {/* LOGIN FORM */}
                {authMode === 'login' && (
                  <form onSubmit={handleLogin} className="space-y-3.5">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Логин / Никнейм
                      </label>
                      <div className="relative">
                        <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          required
                          value={loginUsername}
                          onChange={(e) => setLoginUsername(e.target.value)}
                          placeholder="Введите ваш логин"
                          className="w-full bg-slate-50/80 hover:bg-white focus:bg-white border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 transition outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                          Пароль
                        </label>
                      </div>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type={showLoginPassword ? 'text' : 'password'}
                          required
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          placeholder="Ваш пароль"
                          className="w-full bg-slate-50/80 hover:bg-white focus:bg-white border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-xl pl-10 pr-10 py-2.5 text-xs text-slate-900 placeholder-slate-400 transition outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowLoginPassword(!showLoginPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={authLoading}
                      className="w-full h-11 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-600/20 transition flex items-center justify-center gap-2 mt-2 cursor-pointer"
                    >
                      <span>{authLoading ? 'Вход...' : 'Войти в аккаунт'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </form>
                )}

                {/* REGISTER FORM */}
                {authMode === 'register' && (
                  <form onSubmit={handleRegister} className="space-y-3">
                    {/* Avatar & Name Row */}
                    <div className="flex items-center gap-3 p-2.5 bg-slate-50/80 border border-slate-200 rounded-2xl">
                      <button
                        type="button"
                        onClick={() => setShowAvatarModal(true)}
                        className="relative group shrink-0 cursor-pointer"
                        title="Выбрать аватарку"
                      >
                        <UserAvatar
                          avatar={regAvatar}
                          name={regName || 'Пользователь'}
                          color={userColor}
                          size="md"
                          className="ring-2 ring-blue-500/30 group-hover:scale-105 transition"
                        />
                        <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[9px] shadow-sm">
                          ✎
                        </span>
                      </button>

                      <div className="flex-1 min-w-0">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                          Ваше Имя
                        </label>
                        <input
                          type="text"
                          required
                          value={regName}
                          onChange={(e) => setRegName(e.target.value)}
                          placeholder="Например: Иван Иванов"
                          className="w-full bg-transparent border-0 text-xs font-semibold text-slate-900 placeholder-slate-400 focus:outline-none p-0"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowAvatarModal(true)}
                        className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-semibold rounded-lg transition shrink-0 shadow-2xs cursor-pointer"
                      >
                        Иконка
                      </button>
                    </div>

                    {/* Username & Password */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                          Логин
                        </label>
                        <input
                          type="text"
                          required
                          value={regUsername}
                          onChange={(e) => setRegUsername(e.target.value)}
                          placeholder="ivan123"
                          className="w-full bg-slate-50/80 hover:bg-white focus:bg-white border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                          Пароль
                        </label>
                        <div className="relative">
                          <input
                            type={showRegPassword ? 'text' : 'password'}
                            required
                            value={regPassword}
                            onChange={(e) => setRegPassword(e.target.value)}
                            placeholder="Пароль"
                            className="w-full bg-slate-50/80 hover:bg-white focus:bg-white border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 outline-none pr-7"
                          />
                          <button
                            type="button"
                            onClick={() => setShowRegPassword(!showRegPassword)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                          >
                            {showRegPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Role Selection Segment */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Ваша роль
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setRegRole('student')}
                          className={`p-2.5 rounded-xl border text-left transition flex items-center gap-2.5 cursor-pointer ${
                            regRole === 'student'
                              ? 'bg-blue-50/70 border-blue-500 text-slate-900 ring-1 ring-blue-500/20'
                              : 'bg-slate-50/70 hover:bg-slate-100/70 border-slate-200 text-slate-600'
                          }`}
                        >
                          <span className="text-lg">🎓</span>
                          <div>
                            <div className="text-xs font-bold text-slate-900">Ученик</div>
                            <div className="text-[10px] text-slate-500">Подключение к урокам</div>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setRegRole('tutor')}
                          className={`p-2.5 rounded-xl border text-left transition flex items-center gap-2.5 cursor-pointer ${
                            regRole === 'tutor'
                              ? 'bg-blue-50/70 border-blue-500 text-slate-900 ring-1 ring-blue-500/20'
                              : 'bg-slate-50/70 hover:bg-slate-100/70 border-slate-200 text-slate-600'
                          }`}
                        >
                          <span className="text-lg">👨‍🏫</span>
                          <div>
                            <div className="text-xs font-bold text-slate-900">Преподаватель</div>
                            <div className="text-[10px] text-slate-500">Создание комнат</div>
                          </div>
                        </button>
                      </div>
                    </div>

                    {/* Tutor Key Input (If tutor role selected - secret key NOT shown in UI) */}
                    {regRole === 'tutor' && (
                      <div className="p-3 bg-amber-50/80 border border-amber-200/90 rounded-2xl space-y-1.5 animate-in fade-in duration-150">
                        <label className="text-[11px] font-bold text-amber-900 flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                          <span>Секретный ключ преподавателя:</span>
                        </label>
                        <input
                          type="password"
                          value={regTutorCode}
                          onChange={(e) => setRegTutorCode(e.target.value)}
                          placeholder="Введите секретный ключ"
                          className="w-full bg-white border border-amber-300 rounded-xl px-3 py-2 text-xs font-mono text-amber-950 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-200"
                        />
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={authLoading}
                      className="w-full h-11 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-600/20 transition flex items-center justify-center gap-2 mt-2 cursor-pointer"
                    >
                      <span>{authLoading ? 'Создание...' : 'Зарегистрироваться и войти'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </form>
                )}

                {/* GUEST QUICK ENTRY (Single-use invite key) */}
                {authMode === 'guest' && (
                  <form onSubmit={handleGuestEntry} className="space-y-3.5">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Ваше имя
                      </label>
                      <input
                        type="text"
                        required
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        placeholder="Например: Андрей"
                        className="w-full bg-slate-50/80 hover:bg-white focus:bg-white border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 outline-none transition"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                          Одноразовый ключ доступа:
                        </label>
                        <button
                          type="button"
                          onClick={() => handlePasteClipboard(setGuestInviteCode)}
                          className="text-[11px] text-amber-600 hover:text-amber-700 font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <Clipboard className="w-3 h-3" />
                          <span>Вставить ключ</span>
                        </button>
                      </div>
                      <input
                        type="text"
                        required
                        value={guestInviteCode}
                        onChange={(e) => setGuestInviteCode(e.target.value.toUpperCase())}
                        placeholder="Например: INV-7294"
                        className="w-full bg-amber-50/50 hover:bg-white focus:bg-white border border-amber-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-100 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold text-amber-700 placeholder-slate-400 outline-none uppercase tracking-wider text-center transition"
                      />
                      <p className="text-[10px] text-slate-400 mt-1">
                        Ключ выдается преподавателем перед занятием
                      </p>
                    </div>

                    <button
                      type="submit"
                      disabled={authLoading}
                      className="w-full h-11 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-md shadow-amber-600/20 transition flex items-center justify-center gap-2 mt-2 cursor-pointer disabled:opacity-50"
                    >
                      <span>{authLoading ? 'Активация...' : 'Активировать и войти'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </form>
                )}
              </div>
            ) : (
              /* ----------------- LOGGED IN USER VIEW ----------------- */
              <div>
                {/* Mode Tabs: Only Tutors can create rooms */}
                {currentUser.role === 'tutor' ? (
                  <div className="grid grid-cols-2 gap-1 bg-slate-100/90 p-1 rounded-2xl border border-slate-200/70 mb-5">
                    <button
                      type="button"
                      onClick={() => setRoomTab('join')}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                        roomTab === 'join'
                          ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60 font-bold'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>Одноразовый ключ</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRoomTab('create')}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                        roomTab === 'create'
                          ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60 font-bold'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5 text-blue-600" />
                      <span>Создать комнату</span>
                    </button>
                  </div>
                ) : (
                  <div className="mb-4 text-center">
                    <div className="text-xs font-bold text-slate-800">Вход на занятие по одноразовому ключу</div>
                    <div className="text-[11px] text-slate-500">Введите одноразовый ключ, который вам отправил преподаватель</div>
                  </div>
                )}

                <form onSubmit={handleUserRoomSubmit} className="space-y-4">
                  {/* TAB: JOIN ROOM VIA ONE-TIME INVITE KEY */}
                  {roomTab === 'join' ? (
                    <div className="space-y-3.5">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                            Одноразовый ключ доступа:
                          </label>
                          <button
                            type="button"
                            onClick={() => handlePasteClipboard(setInviteKeyInput)}
                            className="text-[11px] text-amber-600 hover:text-amber-700 font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <Clipboard className="w-3 h-3" />
                            <span>Вставить ключ</span>
                          </button>
                        </div>
                        <input
                          type="text"
                          required
                          value={inviteKeyInput}
                          onChange={(e) => setInviteKeyInput(e.target.value.toUpperCase())}
                          placeholder="Например: INV-7391"
                          className="w-full bg-amber-50/50 hover:bg-white focus:bg-white border border-amber-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-100 rounded-2xl px-4 py-3 text-sm font-mono font-bold text-amber-700 placeholder-slate-400 outline-none uppercase tracking-widest text-center transition"
                        />
                        <p className="text-[10px] text-slate-400 mt-1 text-center">
                          После активации ключ сгорает, а доска навсегда появится в вашем списке досок
                        </p>
                      </div>
                    </div>
                  ) : (
                    /* TAB: CREATE ROOM (Tutor only) */
                    <div className="space-y-3.5">
                      {/* Room Icon Selector */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                          Иконка комнаты
                        </label>
                        <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 border border-slate-200/80 rounded-2xl max-h-24 overflow-y-auto scrollbar-thin">
                          {ROOM_ICONS.map((icon) => (
                            <button
                              key={icon}
                              type="button"
                              onClick={() => setRoomIcon(icon)}
                              className={`w-8 h-8 rounded-xl text-base flex items-center justify-center transition transform hover:scale-110 cursor-pointer ${
                                roomIcon === icon
                                  ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-600/30 scale-105'
                                  : 'bg-white hover:bg-slate-100 text-slate-800 border border-slate-200/80'
                              }`}
                            >
                              {icon}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Lesson Title */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                          Название комнаты / урока
                        </label>
                        <input
                          type="text"
                          value={lessonTitle}
                          onChange={(e) => setLessonTitle(e.target.value)}
                          placeholder="Например: Занятие с репетитором"
                          className="w-full bg-slate-50/80 hover:bg-white focus:bg-white border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-xl px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 outline-none transition"
                        />
                      </div>
                    </div>
                  )}

                  {/* Marker Color Row */}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] font-semibold text-slate-500">Цвет вашего маркера:</span>
                    <div className="flex items-center gap-1.5">
                      {AVATAR_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setUserColor(c)}
                          className={`w-5 h-5 rounded-full transition transform hover:scale-110 flex items-center justify-center cursor-pointer ${
                            userColor === c ? 'ring-2 ring-blue-600 ring-offset-2 ring-offset-white scale-110' : 'opacity-70 hover:opacity-100'
                          }`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-600/20 transition flex items-center justify-center gap-2 mt-1 cursor-pointer"
                  >
                    <span>{roomTab === 'create' ? 'Создать и открыть комнату' : 'Присоединиться к уроку'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              </div>
            )}

            {/* ----------------- ACCESSIBLE BOARDS CARDS SECTION ----------------- */}
            <div className="mt-6 pt-5 border-t border-slate-100">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-bold text-slate-800">Доступные вам доски</span>
                  {savedBoards.length > 0 && (
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200/80 rounded-full text-[10px] font-bold">
                      {savedBoards.length}
                    </span>
                  )}
                </div>

                {savedBoards.length > 0 && (
                  <button
                    type="button"
                    onClick={() => fetchRoomStatuses(savedBoards)}
                    title="Обновить статус досок"
                    className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-blue-600 transition cursor-pointer"
                  >
                    <RefreshCw className={`w-3 h-3 ${isRefreshingStatuses ? 'animate-spin text-blue-600' : ''}`} />
                    <span>Обновить</span>
                  </button>
                )}
              </div>

              {savedBoards.length === 0 ? (
                <div className="p-4 bg-slate-50/80 border border-dashed border-slate-200 rounded-2xl text-center">
                  <div className="text-xl mb-1">📋</div>
                  <div className="text-xs font-bold text-slate-700 mb-0.5">У вас пока нет доступных досок</div>
                  <p className="text-[11px] text-slate-500 max-w-[340px] mx-auto">
                    {currentUser?.role === 'tutor'
                      ? 'Создайте свою первую комнату выше, чтобы начать урок с учениками.'
                      : 'Введите одноразовый ключ от преподавателя выше, и доска навсегда появится в вашем списке!'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1 scrollbar-thin">
                  {savedBoards.map((b) => {
                    const normId = normalizeRoomCode(b.id);
                    const status = roomStatuses[normId] || roomStatuses[b.id];
                    const onlineCount = status?.participantCount ?? 0;
                    const pageCount = status?.totalPages ?? (b as any).totalPages ?? 1;
                    const isTutorBoard = b.role === 'tutor' || (currentUser && currentUser.role === 'tutor');

                    return (
                      <div
                        key={b.id}
                        onClick={() => handleOpenSavedBoard(b)}
                        className="p-3 bg-white hover:bg-blue-50/40 border border-slate-200/90 hover:border-blue-300 rounded-2xl transition-all duration-150 shadow-2xs hover:shadow-md hover:shadow-blue-600/5 cursor-pointer group flex flex-col gap-2 relative"
                      >
                        {/* Top Card Row: Title & Code Badge */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-slate-900 truncate group-hover:text-blue-600 transition">
                                {b.title || 'Урок с репетитором'}
                              </span>
                              {b.subject && (
                                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[10px] font-medium shrink-0">
                                  {b.subject}
                                </span>
                              )}
                            </div>

                            {/* Clickable Code Tag */}
                            <div className="flex items-center gap-2 mt-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigator.clipboard.writeText(b.id);
                                  setCopiedCardId(b.id);
                                  showNotice(`Код ${b.id} скопирован`);
                                  setTimeout(() => setCopiedCardId(null), 2000);
                                }}
                                title="Нажмите, чтобы скопировать код"
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 hover:bg-blue-100/70 border border-slate-200 text-slate-700 hover:text-blue-800 rounded-lg text-[10px] font-mono font-bold transition cursor-pointer"
                              >
                                <span>{b.id}</span>
                                {copiedCardId === b.id ? (
                                  <Check className="w-2.5 h-2.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-2.5 h-2.5 opacity-60" />
                                )}
                              </button>

                              {/* Access status badge */}
                              <span
                                className={`text-[10px] font-semibold flex items-center gap-1 ${
                                  isTutorBoard ? 'text-amber-700' : 'text-emerald-700'
                                }`}
                              >
                                {isTutorBoard ? '👨‍🏫 Владелец' : '🎓 Доступ открыт'}
                              </span>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={(e) => handleDeleteSavedRoom(b.id, e)}
                              title="Удалить доску"
                              className="p-1.5 text-slate-400 hover:text-rose-600 opacity-60 group-hover:opacity-100 transition rounded-lg hover:bg-rose-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>

                            <span className="px-3 py-1.5 bg-blue-50 group-hover:bg-blue-600 text-blue-700 group-hover:text-white border border-blue-200/80 group-hover:border-transparent font-bold text-xs rounded-xl transition flex items-center gap-1 shadow-2xs">
                              <span>Войти</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </span>
                          </div>
                        </div>

                        {/* Bottom Metadata Strip: Online Indicator & Page count & Last Visit */}
                        <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1.5 border-t border-slate-100/80">
                          <div className="flex items-center gap-3">
                            {/* Live Online Badge */}
                            {onlineCount > 0 ? (
                              <span className="flex items-center gap-1 text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/80">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                <span>{onlineCount} в сети</span>
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-slate-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                                <span>Офлайн</span>
                              </span>
                            )}

                            {/* Total pages */}
                            <span className="flex items-center gap-1 text-slate-600 font-medium">
                              <Layers className="w-3 h-3 text-slate-400" />
                              <span>{pageCount} стр.</span>
                            </span>
                          </div>

                          <div className="flex items-center gap-1 text-slate-400">
                            <Clock className="w-3 h-3" />
                            <span>{formatDate(b.lastVisited)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Minimal Footer */}
        <div className="mt-4 text-center text-xs text-slate-400 font-medium">
          TutorBoard • Совместное обучение с аудиосвязью и средой разработки
        </div>
      </div>

      {/* Avatar Picker Modal */}
      <AvatarPicker
        isOpen={showAvatarModal}
        onClose={() => setShowAvatarModal(false)}
        selectedAvatar={currentUser?.avatar || regAvatar}
        selectedColor={userColor}
        userName={currentUser?.name || regName || 'Пользователь'}
        onSelectAvatar={(av, col) => {
          setRegAvatar(av);
          if (col) setUserColor(col);
        }}
      />

      {/* Users List Modal for Tutors */}
      <UsersListModal isOpen={showUsersModal} onClose={() => setShowUsersModal(false)} />
    </div>
  );
};
