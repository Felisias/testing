import React, { useState, useEffect } from 'react';
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
  const [guestRoomCode, setGuestRoomCode] = useState('');
  const [guestAvatar, setGuestAvatar] = useState('🎓');
  const [guestRole, setGuestRole] = useState<UserRole>('student');

  // Logged-in Room Action Tab: 'join' | 'create'
  const [roomTab, setRoomTab] = useState<'join' | 'create'>('join');
  const [roomCode, setRoomCode] = useState('');
  const [roomIcon, setRoomIcon] = useState('🎓');
  const [lessonTitle, setLessonTitle] = useState('Урок с преподавателем');
  const [userColor, setUserColor] = useState(AVATAR_COLORS[0]);

  // Modals & UI States
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [showUsersModal, setShowUsersModal] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [copiedNotification, setCopiedNotification] = useState<string | null>(null);

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
                setSavedBoards(Array.from(srvMap.values()));
              }
            })
            .catch(() => {});
        }
      } else {
        if (localRecent.length > 0) {
          setSavedBoards(localRecent);
        }
      }
    } catch (err) {
      console.warn('Session init error:', err);
    }
  }, []);

  // Check URL query param ?room=CODE
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlRoom = params.get('room');
    if (urlRoom) {
      const code = urlRoom.trim().toUpperCase();
      setRoomCode(code);
      setGuestRoomCode(code);
      setRoomTab('join');
    }
  }, []);

  const generateRoomCode = () => {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    return `ROOM-${randomNum}`;
  };

  // Generate initial room code
  useEffect(() => {
    if (roomTab === 'create' && !roomCode) {
      setRoomCode(generateRoomCode());
    }
  }, [roomTab]);

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

  // Handle Quick Guest Entry
  const handleGuestEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    const name = guestName.trim();
    const code = normalizeRoomCode(guestRoomCode);

    if (!name) {
      setAuthError('Укажите ваше имя');
      return;
    }

    if (!code) {
      setAuthError('Введите код комнаты от преподавателя');
      return;
    }

    setAuthLoading(true);
    try {
      let finalCode = code;
      const checkRes = await fetch(`/api/rooms/${encodeURIComponent(code)}`);
      if (checkRes.ok) {
        const data = await checkRes.json();
        if (data?.id) finalCode = data.id;
      }

      saveRoomToHistory(finalCode, `Урок ${finalCode}`, 'Занятие', 'student');

      onJoinRoom({
        roomId: finalCode,
        userName: name,
        role: 'student',
        color: userColor,
        avatar: guestAvatar,
        title: `Занятие ${finalCode}`,
        subject: 'Занятие',
      });
    } catch {
      saveRoomToHistory(code, `Урок ${code}`, 'Занятие', 'student');
      onJoinRoom({
        roomId: code,
        userName: name,
        role: 'student',
        color: userColor,
        avatar: guestAvatar,
        title: `Занятие ${code}`,
        subject: 'Занятие',
      });
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
    let targetCode = normalizeRoomCode(roomCode);

    // Students cannot create rooms
    if (isStudent || roomTab === 'join') {
      if (!targetCode) {
        setAuthError('Введите код комнаты, полученный от преподавателя');
        return;
      }

      setAuthLoading(true);
      try {
        let finalCode = targetCode;
        const checkRes = await fetch(`/api/rooms/${encodeURIComponent(targetCode)}`);
        if (checkRes.ok) {
          const data = await checkRes.json();
          if (data?.id) finalCode = data.id;
        }

        saveRoomToHistory(finalCode, `Урок ${finalCode}`, 'Занятие', currentUser.role);

        onJoinRoom({
          roomId: finalCode,
          userName: currentUser.name,
          role: currentUser.role,
          color: userColor,
          avatar: currentUser.avatar || regAvatar,
          userId: currentUser.id,
        });
      } catch {
        saveRoomToHistory(targetCode, `Урок ${targetCode}`, 'Занятие', currentUser.role);

        onJoinRoom({
          roomId: targetCode,
          userName: currentUser.name,
          role: currentUser.role,
          color: userColor,
          avatar: currentUser.avatar || regAvatar,
          userId: currentUser.id,
        });
      } finally {
        setAuthLoading(false);
      }
      return;
    }

    // Tutor creating room
    if (!targetCode) {
      targetCode = generateRoomCode();
    }

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

                {/* GUEST QUICK ENTRY */}
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
                          Код комнаты
                        </label>
                        <button
                          type="button"
                          onClick={() => handlePasteClipboard(setGuestRoomCode)}
                          className="text-[11px] text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <Clipboard className="w-3 h-3" />
                          <span>Вставить</span>
                        </button>
                      </div>
                      <input
                        type="text"
                        value={guestRoomCode}
                        onChange={(e) => setGuestRoomCode(e.target.value.toUpperCase())}
                        placeholder="ROOM-2024"
                        className="w-full bg-slate-50/80 hover:bg-white focus:bg-white border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold text-blue-600 placeholder-slate-400 outline-none uppercase tracking-wider transition"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-600/20 transition flex items-center justify-center gap-2 mt-2 cursor-pointer"
                    >
                      <span>Войти на доску</span>
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
                      <span>Войти по коду</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setRoomTab('create');
                        if (!roomCode) setRoomCode(generateRoomCode());
                      }}
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
                    <div className="text-xs font-bold text-slate-800">Вход на урок по коду</div>
                    <div className="text-[11px] text-slate-500">Введите код, который вам отправил преподаватель</div>
                  </div>
                )}

                <form onSubmit={handleUserRoomSubmit} className="space-y-4">
                  {/* TAB: JOIN ROOM */}
                  {roomTab === 'join' ? (
                    <div className="space-y-3.5">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                            Код комнаты от преподавателя:
                          </label>
                          <button
                            type="button"
                            onClick={() => handlePasteClipboard(setRoomCode)}
                            className="text-[11px] text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <Clipboard className="w-3 h-3" />
                            <span>Вставить из буфера</span>
                          </button>
                        </div>
                        <input
                          type="text"
                          required
                          value={roomCode}
                          onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                          placeholder="Например: ROOM-7391"
                          className="w-full bg-slate-50/80 hover:bg-white focus:bg-white border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-2xl px-4 py-3 text-sm font-mono font-bold text-blue-600 placeholder-slate-400 outline-none uppercase tracking-widest text-center transition"
                        />
                      </div>
                    </div>
                  ) : (
                    /* TAB: CREATE ROOM (No subject tags - room icon + title) */
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

                      {/* Generated Room Code with Refresh */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                            Сгенерированный код комнаты
                          </label>
                          <button
                            type="button"
                            onClick={() => setRoomCode(generateRoomCode())}
                            className="text-[11px] text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span>Обновить</span>
                          </button>
                        </div>
                        <input
                          type="text"
                          value={roomCode}
                          onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-mono font-bold text-blue-600 outline-none uppercase tracking-wider"
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

            {/* ----------------- SAVED RECENT ROOMS ----------------- */}
            {savedBoards.length > 0 && (
              <div className="mt-6 pt-5 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-blue-600" />
                    <span>Недавние занятия ({savedBoards.length})</span>
                  </span>
                </div>

                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1 scrollbar-thin">
                  {savedBoards.map((b) => (
                    <div
                      key={b.id}
                      onClick={() => handleOpenSavedBoard(b)}
                      className="p-2.5 bg-slate-50/70 hover:bg-blue-50/50 border border-slate-200/80 hover:border-blue-300 rounded-xl transition flex items-center justify-between gap-3 text-xs cursor-pointer group shadow-2xs"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-blue-600 text-[11px]">{b.id}</span>
                          <span className="font-semibold text-slate-800 truncate">{b.title || 'Урок'}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                          <span>{formatDate(b.lastVisited)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => handleDeleteSavedRoom(b.id, e)}
                          title="Удалить из недавних"
                          className="p-1 text-slate-400 hover:text-rose-600 opacity-40 group-hover:opacity-100 transition rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <span className="px-2.5 py-1 bg-white group-hover:bg-blue-600 text-slate-700 group-hover:text-white border border-slate-200/80 group-hover:border-transparent font-medium text-[11px] rounded-lg transition flex items-center gap-1 shadow-2xs">
                          <span>Войти</span>
                          <ArrowRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
