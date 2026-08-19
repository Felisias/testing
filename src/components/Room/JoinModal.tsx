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
  X,
  Download,
  Upload,
  HardDrive,
  FileJson,
  Database,
  CheckCircle2,
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

  // Active Dialog on Dashboard: null | 'join-code' | 'create-room' | 'backup-import'
  const [activeDialog, setActiveDialog] = useState<'join-code' | 'create-room' | 'backup-import' | null>(null);

  // Backup & Restore State (Tutor only)
  const [isExportingBackup, setIsExportingBackup] = useState(false);
  const [isImportingBackup, setIsImportingBackup] = useState(false);
  const [pendingBackupData, setPendingBackupData] = useState<{
    filename: string;
    sizeKb: number;
    data: any;
    roomsCount: number;
    usersCount: number;
    inviteCodesCount: number;
  } | null>(null);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const backupFileInputRef = React.useRef<HTMLInputElement>(null);

  // Auth Modes (when not logged in): 'login' | 'register' | 'guest'
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

  // Join by Code Dialog State
  const [inviteKeyInput, setInviteKeyInput] = useState('');

  // Create Room Dialog State (Tutor only)
  const [roomIcon, setRoomIcon] = useState('🎓');
  const [lessonTitle, setLessonTitle] = useState('Урок с преподавателем');
  const [lessonSubject, setLessonSubject] = useState('Математика');
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
    if (currentUser && savedBoards.length > 0) {
      fetchRoomStatuses(savedBoards);
      const interval = setInterval(() => {
        fetchRoomStatuses(savedBoards);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [currentUser, savedBoards, fetchRoomStatuses]);

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
        }
      }
    } catch (err) {
      console.warn('Session init error:', err);
    }
  }, [fetchRoomStatuses]);

  // Check URL query param ?invite=CODE or ?room=CODE
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlInvite = params.get('invite') || params.get('room');
    if (urlInvite) {
      const code = urlInvite.trim().toUpperCase();
      setInviteKeyInput(code);
      setGuestInviteCode(code);
      if (!currentUser) {
        setAuthMode('guest');
      } else {
        setActiveDialog('join-code');
      }
    }
  }, [currentUser]);

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

  // Export full backup JSON (Tutor only)
  const handleExportBackup = async () => {
    if (!currentUser || currentUser.role !== 'tutor') return;
    setIsExportingBackup(true);
    try {
      const res = await fetch(`/api/admin/backup/export?username=${encodeURIComponent(currentUser.username)}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Ошибка при экспорте резервной копии');
      }
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `tutorboard-full-backup-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showNotice('Файл полного сохранения (.json) успешно скачан!');
    } catch (err: any) {
      showNotice(err.message || 'Не удалось скачать резервную копию');
    } finally {
      setIsExportingBackup(false);
    }
  };

  // Trigger file dialog
  const handleTriggerImport = () => {
    setAuthError(null);
    backupFileInputRef.current?.click();
  };

  // Read selected JSON backup file
  const handleBackupFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        if (!parsed || typeof parsed !== 'object') {
          throw new Error('Файл не содержит корректного JSON-объекта');
        }

        const rooms = parsed.rooms || {};
        const users = parsed.users || {};
        const inviteCodes = parsed.inviteCodes || {};

        const roomsCount = Object.keys(rooms).length;
        const usersCount = Object.keys(users).length;
        const inviteCodesCount = Object.keys(inviteCodes).length;

        if (roomsCount === 0 && usersCount === 0 && inviteCodesCount === 0) {
          throw new Error('В выбранном файле нет сохраненных комнат или пользователей TutorBoard');
        }

        setPendingBackupData({
          filename: file.name,
          sizeKb: Math.max(1, Math.round(file.size / 1024)),
          data: parsed,
          roomsCount,
          usersCount,
          inviteCodesCount,
        });
        setImportMode('merge');
        setActiveDialog('backup-import');
      } catch (err: any) {
        showNotice(err.message || 'Ошибка при чтении файла сохранения');
      } finally {
        if (backupFileInputRef.current) {
          backupFileInputRef.current.value = '';
        }
      }
    };
    reader.readAsText(file);
  };

  // Send backup data to server for restore
  const handleConfirmImportBackup = async () => {
    if (!currentUser || !pendingBackupData) return;
    setIsImportingBackup(true);
    try {
      const res = await fetch('/api/admin/backup/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: currentUser.username,
          backupData: pendingBackupData.data,
          mode: importMode,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Ошибка импорта сохранения');
      }

      if (data.savedBoards && Array.isArray(data.savedBoards)) {
        setSavedBoards(data.savedBoards);
        fetchRoomStatuses(data.savedBoards);
      } else {
        // Refresh boards
        const bRes = await fetch(`/api/user/boards?username=${encodeURIComponent(currentUser.username)}`);
        const bData = await bRes.json();
        if (bData?.savedBoards) {
          setSavedBoards(bData.savedBoards);
          fetchRoomStatuses(bData.savedBoards);
        }
      }

      showNotice(`✓ Сохранение загружено: ${data.stats.roomsCount} комнат, ${data.stats.usersCount} пользователей!`);
      setActiveDialog(null);
      setPendingBackupData(null);
    } catch (err: any) {
      showNotice(err.message || 'Не удалось применить файл сохранения');
    } finally {
      setIsImportingBackup(false);
    }
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ user, savedBoards: boards }));
      setActiveDialog(null);
      fetchRoomStatuses(boards);
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ user, savedBoards: [] }));
      setActiveDialog(null);
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
      throw new Error('Введите код комнаты или одноразовый ключ доступа');
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
        throw new Error(inviteData.error);
      }
    } catch (e: any) {
      if (e?.message && !e.message.includes('не найден')) {
        throw e;
      }
    }

    // 2. Fallback: check if it's an existing room (e.g. for direct room codes)
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

    throw new Error(`Ключ или комната "${cleanKey}" не найдены или ключ уже был использован.`);
  };

  // Handle Guest Entry
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
      setAuthError('Введите код или ключ доступа');
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
      setAuthError(err?.message || 'Не удалось войти в комнату.');
    } finally {
      setAuthLoading(false);
    }
  };

  // Handle Join by Code (Logged-in)
  const handleJoinByCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    const key = inviteKeyInput.trim();
    if (!key) {
      setAuthError('Введите код комнаты или одноразовый ключ');
      return;
    }

    const userName = currentUser ? currentUser.name : (guestName.trim() || 'Ученик');
    const userRole = currentUser ? currentUser.role : 'student';
    const userAvatarVal = currentUser?.avatar || regAvatar;

    setAuthLoading(true);
    try {
      const roomInfo = await redeemOrJoin(key, userName, currentUser?.username, userAvatarVal);
      saveRoomToHistory(roomInfo.roomId, roomInfo.title, roomInfo.subject, userRole);

      onJoinRoom({
        roomId: roomInfo.roomId,
        userName,
        role: userRole,
        color: userColor,
        avatar: userAvatarVal,
        userId: currentUser?.id,
        title: roomInfo.title,
        subject: roomInfo.subject,
      });
    } catch (err: any) {
      setAuthError(err?.message || 'Не удалось войти по указанному коду.');
    } finally {
      setAuthLoading(false);
    }
  };

  // Handle Tutor Creating a New Room (Tutor only)
  const handleCreateRoomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || currentUser.role !== 'tutor') return;
    setAuthError(null);

    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const targetCode = `ROOM-${randomNum}`;
    const title = `${roomIcon} ${lessonTitle.trim() || 'Урок'}`;
    const subject = lessonSubject.trim() || 'Занятие';

    saveRoomToHistory(targetCode, title, subject, 'tutor');

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

  // Join Saved Board Directly
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
    setActiveDialog(null);
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

  const isTutor = currentUser?.role === 'tutor';

  // =========================================================================
  // CASE 1: USER IS NOT LOGGED IN -> SHOW CLEAN AUTHENTICATION / LOGIN PAGE
  // =========================================================================
  if (!currentUser) {
    return (
      <div
        id="tutorboard-auth-screen"
        className="min-h-screen w-full bg-slate-50 text-slate-800 flex flex-col justify-center items-center p-4 selection:bg-blue-600 selection:text-white relative overflow-hidden"
      >
        {/* Soft background glow */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[340px] bg-gradient-to-tr from-blue-200/50 via-indigo-100/30 to-transparent rounded-full blur-3xl pointer-events-none" />

        {/* Global Toast */}
        {copiedNotification && (
          <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-slate-900 text-white rounded-full text-xs font-semibold shadow-lg flex items-center gap-2 animate-in fade-in">
            <Check className="w-3.5 h-3.5 text-emerald-400" />
            <span>{copiedNotification}</span>
          </div>
        )}

        <div className="w-full max-w-[440px] z-10">
          {/* Main Card */}
          <div className="bg-white/95 backdrop-blur-xl border border-slate-200/90 rounded-3xl shadow-xl shadow-slate-200/60 overflow-hidden">
            {/* Header */}
            <div className="p-6 pb-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-600/20">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-base font-bold tracking-tight text-slate-900">TutorBoard</h1>
                  <p className="text-xs text-slate-500">Интерактивная доска для занятий</p>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="p-6">
              {/* Error Box */}
              {authError && (
                <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span className="font-medium">{authError}</span>
                </div>
              )}

              {/* Mode Tabs: Вход | Регистрация | Гость */}
              <div className="grid grid-cols-3 gap-1 bg-slate-100/90 p-1 rounded-2xl border border-slate-200/70 mb-5">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('login');
                    setAuthError(null);
                  }}
                  className={`py-2 px-2 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer ${
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
                  className={`py-2 px-2 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer ${
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
                  className={`py-2 px-2 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    authMode === 'guest'
                      ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60 font-bold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Compass className="w-3.5 h-3.5" />
                  <span>Гость</span>
                </button>
              </div>

              {/* 1. LOGIN FORM */}
              {authMode === 'login' && (
                <form onSubmit={handleLogin} className="space-y-3.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Логин
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
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Пароль
                    </label>
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
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
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

              {/* 2. REGISTER FORM */}
              {authMode === 'register' && (
                <form onSubmit={handleRegister} className="space-y-3">
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
                  </div>

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
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          {showRegPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Role Segment */}
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

                  {/* Tutor Key Input (If tutor role selected) */}
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
                        className="w-full bg-white border border-amber-300 rounded-xl px-3 py-2 text-xs font-mono text-amber-950 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={authLoading}
                    className="w-full h-11 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-600/20 transition flex items-center justify-center gap-2 mt-2 cursor-pointer"
                  >
                    <span>{authLoading ? 'Создание...' : 'Зарегистрироваться'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              )}

              {/* 3. GUEST ENTRY FORM */}
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
                        Код или одноразовый ключ:
                      </label>
                      <button
                        type="button"
                        onClick={() => handlePasteClipboard(setGuestInviteCode)}
                        className="text-[11px] text-amber-600 hover:text-amber-700 font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <Clipboard className="w-3 h-3" />
                        <span>Вставить</span>
                      </button>
                    </div>
                    <input
                      type="text"
                      required
                      value={guestInviteCode}
                      onChange={(e) => setGuestInviteCode(e.target.value.toUpperCase())}
                      placeholder="INV-XXXX или ROOM-XXXX"
                      className="w-full bg-amber-50/50 hover:bg-white focus:bg-white border border-amber-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-100 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold text-amber-800 placeholder-slate-400 outline-none uppercase tracking-wider text-center transition"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      Ключ выдаётся преподавателем перед занятием
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={authLoading}
                    className="w-full h-11 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-600/20 transition flex items-center justify-center gap-2 cursor-pointer mt-2"
                  >
                    <span>{authLoading ? 'Вход...' : 'Войти гостем'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>

        {/* Avatar Picker Modal */}
        <AvatarPicker
          isOpen={showAvatarModal}
          onClose={() => setShowAvatarModal(false)}
          selectedAvatar={regAvatar}
          selectedColor={userColor}
          userName={regName || 'Пользователь'}
          onSelectAvatar={(av, col) => {
            setRegAvatar(av);
            if (col) setUserColor(col);
          }}
        />
      </div>
    );
  }

  // =========================================================================
  // CASE 2: USER IS LOGGED IN -> FULL-WIDTH MINIMALIST DASHBOARD
  // =========================================================================
  return (
    <div
      id="tutorboard-hub"
      className="min-h-screen w-full bg-slate-50 text-slate-800 flex flex-col selection:bg-blue-600 selection:text-white relative"
    >
      {/* Subtle top ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-48 bg-gradient-to-b from-blue-100/40 via-indigo-50/20 to-transparent blur-2xl pointer-events-none" />

      {/* Global Notification Toast */}
      {copiedNotification && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-slate-900 text-white rounded-full text-xs font-semibold shadow-lg shadow-slate-900/20 flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <Check className="w-3.5 h-3.5 text-emerald-400" />
          <span>{copiedNotification}</span>
        </div>
      )}

      {/* ===================== TOP NAVIGATION HEADER ===================== */}
      <header className="w-full border-b border-slate-200/80 bg-white/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-600/20">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <div className="text-base font-bold tracking-tight text-slate-900 flex items-center gap-2">
                <span>TutorBoard</span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium leading-none">
                Интерактивное пространство для занятий
              </p>
            </div>
          </div>

          {/* Top Right: User Profile & Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Hidden Backup File Input for Tutors */}
            <input
              type="file"
              ref={backupFileInputRef}
              onChange={handleBackupFileSelect}
              accept=".json,application/json"
              className="hidden"
            />

            {/* Tutors Backup Action Toolbar */}
            {isTutor && (
              <div className="hidden sm:flex items-center gap-1.5 p-1 bg-slate-100/80 border border-slate-200/80 rounded-2xl">
                <button
                  type="button"
                  onClick={handleExportBackup}
                  disabled={isExportingBackup}
                  title="Скачать полный файл сохранения (.json)"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 hover:text-blue-700 bg-white hover:bg-blue-50 border border-slate-200/90 rounded-xl shadow-2xs transition cursor-pointer disabled:opacity-50"
                >
                  <Download className={`w-3.5 h-3.5 ${isExportingBackup ? 'animate-bounce text-blue-600' : 'text-slate-600'}`} />
                  <span>Скачать бэкап</span>
                </button>

                <button
                  type="button"
                  onClick={handleTriggerImport}
                  title="Загрузить файл сохранения (.json)"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 hover:text-blue-700 bg-white hover:bg-blue-50 border border-slate-200/90 rounded-xl shadow-2xs transition cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 text-slate-600" />
                  <span>Загрузить бэкап</span>
                </button>
              </div>
            )}

            <div className="flex items-center gap-3 pl-3 pr-2 py-1.5 bg-slate-100/80 border border-slate-200/80 rounded-2xl">
              {/* Avatar with click-to-change */}
              <button
                type="button"
                onClick={() => setShowAvatarModal(true)}
                title="Нажмите, чтобы изменить аватар"
                className="relative group cursor-pointer shrink-0"
              >
                <UserAvatar
                  avatar={currentUser.avatar || regAvatar}
                  name={currentUser.name}
                  color={userColor}
                  size="sm"
                  className="ring-1.5 ring-blue-500/40 group-hover:scale-105 transition"
                />
                <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[7px] shadow-sm">
                  ✎
                </span>
              </button>

              {/* Name & Role */}
              <div className="flex flex-col text-left">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-900 max-w-[120px] sm:max-w-[160px] truncate">
                    {currentUser.name}
                  </span>
                  <span
                    className={`px-1.5 py-0.2 rounded-md text-[10px] font-semibold ${
                      isTutor ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'
                    }`}
                  >
                    {isTutor ? 'Преподаватель' : 'Ученик'}
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 font-mono leading-tight">
                  @{currentUser.username}
                </span>
              </div>

              {/* Tutors: Manage registered users */}
              {isTutor && (
                <button
                  type="button"
                  onClick={() => setShowUsersModal(true)}
                  title="Список всех зарегистрированных пользователей"
                  className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-white rounded-xl transition cursor-pointer"
                >
                  <Users className="w-4 h-4" />
                </button>
              )}

              {/* Logout / Switch Account */}
              <button
                type="button"
                onClick={handleLogout}
                title="Выйти из аккаунта"
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ===================== MAIN CONTENT WRAPPER ===================== */}
      <main className="max-w-7xl mx-auto w-full px-6 py-8 flex-1 flex flex-col gap-10 z-10">
        
        {/* SECTION 1: ДОСТУПНЫЕ КОМНАТЫ (Accessible Rooms Row) */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700">
                <BookOpen className="w-3.5 h-3.5" />
              </div>
              <h2 className="text-sm font-bold text-slate-900 tracking-tight">Доступные комнаты</h2>
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
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-blue-600 transition cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingStatuses ? 'animate-spin text-blue-600' : ''}`} />
                <span>Обновить статус</span>
              </button>
            )}
          </div>

          {/* Cards Grid */}
          {savedBoards.length === 0 ? (
            <div className="w-full p-8 bg-white border border-dashed border-slate-200 rounded-3xl text-center flex flex-col items-center justify-center gap-2">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-xl text-slate-400">
                📋
              </div>
              <div className="text-sm font-bold text-slate-800">У вас пока нет сохранённых комнат</div>
              <p className="text-xs text-slate-500 max-w-md">
                {isTutor
                  ? 'Создайте новую доску ниже, чтобы начать онлайн-занятие с учениками.'
                  : 'Введите код комнаты или одноразовый ключ доступа от преподавателя, чтобы открыть доску.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4.5">
              {savedBoards.map((b) => {
                const normId = normalizeRoomCode(b.id);
                const status = roomStatuses[normId] || roomStatuses[b.id];
                const onlineCount = status?.participantCount ?? 0;
                const pageCount = status?.totalPages ?? (b as any).totalPages ?? 1;
                const isTutorBoard = b.role === 'tutor' || isTutor;

                return (
                  <div
                    key={b.id}
                    onClick={() => handleOpenSavedBoard(b)}
                    className="bg-white hover:bg-slate-50/80 border border-slate-200/90 hover:border-blue-300 rounded-2xl p-4.5 transition-all duration-150 shadow-2xs hover:shadow-md hover:shadow-blue-600/5 cursor-pointer group flex flex-col justify-between gap-3 relative"
                  >
                    {/* Top Row: Subject Pill & Online Pill */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-[10px] font-bold truncate max-w-[130px]">
                        {b.subject || 'Занятие'}
                      </span>

                      {onlineCount > 0 ? (
                        <span className="flex items-center gap-1.5 text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/80 text-[10px] shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span>{onlineCount} в сети</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-slate-400 text-[10px] shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                          <span>Офлайн</span>
                        </span>
                      )}
                    </div>

                    {/* Middle: Title & Room Code */}
                    <div className="flex flex-col gap-1.5">
                      <h3 className="font-bold text-xs text-slate-900 group-hover:text-blue-600 transition line-clamp-2">
                        {b.title || 'Урок с репетитором'}
                      </h3>

                      {/* Click-to-copy code pill */}
                      <div className="flex items-center justify-between gap-2 mt-0.5">
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
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 hover:bg-blue-100/70 border border-slate-200 text-slate-700 hover:text-blue-800 rounded-md text-[10px] font-mono font-bold transition cursor-pointer"
                        >
                          <span>{b.id}</span>
                          {copiedCardId === b.id ? (
                            <Check className="w-2.5 h-2.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-2.5 h-2.5 opacity-60" />
                          )}
                        </button>

                        <span
                          className={`text-[10px] font-semibold ${
                            isTutorBoard ? 'text-amber-700' : 'text-emerald-700'
                          }`}
                        >
                          {isTutorBoard ? 'Владелец' : 'Ученик'}
                        </span>
                      </div>
                    </div>

                    {/* Bottom Row: Metadata & Quick Join Button */}
                    <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <Clock className="w-3 h-3" />
                        <span>{formatDate(b.lastVisited)}</span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => handleDeleteSavedRoom(b.id, e)}
                          title="Удалить из списка"
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition opacity-60 group-hover:opacity-100"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <span className="px-2.5 py-1 bg-blue-50 group-hover:bg-blue-600 text-blue-700 group-hover:text-white border border-blue-200/80 group-hover:border-transparent font-bold text-xs rounded-lg transition flex items-center gap-1">
                          <span>Войти</span>
                          <ArrowRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* SECTION 2: ДЕЙСТВИЯ (Action Cards) */}
        <section className="flex flex-col gap-4">
          <h2 className="text-sm font-bold text-slate-900 tracking-tight">Быстрые действия</h2>

          <div className={`grid gap-5 ${isTutor ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1 max-w-xl'}`}>
            {/* Action Card 1: Войти по коду (Visible to both Student & Tutor) */}
            <div
              onClick={() => {
                setAuthError(null);
                setActiveDialog('join-code');
              }}
              className="p-6 bg-white hover:bg-blue-50/30 border border-slate-200/90 hover:border-blue-300 rounded-3xl transition-all duration-200 shadow-2xs hover:shadow-md hover:shadow-blue-600/5 cursor-pointer group flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-700 flex items-center justify-center group-hover:scale-105 transition">
                  <KeyRound className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition">
                    Войти по коду или ссылке
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Подключиться к занятию по одноразовому ключу от преподавателя
                  </p>
                </div>
              </div>
              <span className="px-3.5 py-2 bg-slate-100 group-hover:bg-blue-600 group-hover:text-white text-slate-700 rounded-xl font-bold text-xs transition flex items-center gap-1.5 shrink-0">
                <span>Войти</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>

            {/* Action Card 2: Создать новую комнату (STRICTLY TUTOR ONLY - NEVER SHOWN TO STUDENTS) */}
            {isTutor && (
              <div
                onClick={() => {
                  setAuthError(null);
                  setActiveDialog('create-room');
                }}
                className="p-6 bg-white hover:bg-blue-50/30 border border-slate-200/90 hover:border-blue-300 rounded-3xl transition-all duration-200 shadow-2xs hover:shadow-md hover:shadow-blue-600/5 cursor-pointer group flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-700 flex items-center justify-center group-hover:scale-105 transition">
                    <Plus className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition">
                      Создать новую доску
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Запустить интерактивную доску для занятия с учениками
                    </p>
                  </div>
                </div>
                <span className="px-3.5 py-2 bg-blue-600 text-white rounded-xl font-bold text-xs transition flex items-center gap-1.5 shrink-0 shadow-sm shadow-blue-600/20">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Создать</span>
                </span>
              </div>
            )}

            {/* Action Card 3: Резервное копирование и сохранение (Tutor only) */}
            {isTutor && (
              <div className="p-6 bg-white border border-slate-200/90 rounded-3xl transition-all duration-200 shadow-2xs flex flex-col justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 flex items-center justify-center shrink-0">
                    <Database className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Резервная копия данных
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                      Экспорт и импорт всех комнат, досок, учеников и ключей в единый .json файл
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handleExportBackup}
                    disabled={isExportingBackup}
                    className="flex-1 py-2 px-3 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 hover:border-blue-200 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Download className={`w-3.5 h-3.5 ${isExportingBackup ? 'animate-bounce text-blue-600' : ''}`} />
                    <span>Скачать .json</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleTriggerImport}
                    className="flex-1 py-2 px-3 bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border border-slate-200 hover:border-emerald-200 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Загрузить .json</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* ===================== MODAL 1: ВОЙТИ ПО КОДУ ===================== */}
      {activeDialog === 'join-code' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-[460px] bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Вход по коду</h3>
                  <p className="text-[11px] text-slate-500">Подключение к онлайн-доске</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveDialog(null);
                  setAuthError(null);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              {authError && (
                <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span className="font-medium">{authError}</span>
                </div>
              )}

              <form onSubmit={handleJoinByCodeSubmit} className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Код комнаты или одноразовый ключ
                    </label>
                    <button
                      type="button"
                      onClick={() => handlePasteClipboard(setInviteKeyInput)}
                      className="text-[11px] text-amber-600 hover:text-amber-700 font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Clipboard className="w-3 h-3" />
                      <span>Вставить</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={inviteKeyInput}
                    onChange={(e) => setInviteKeyInput(e.target.value.toUpperCase())}
                    placeholder="INV-XXXX или ROOM-XXXX"
                    className="w-full bg-amber-50/40 hover:bg-white focus:bg-white border border-amber-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-100 rounded-2xl px-4 py-3 text-sm font-mono font-bold text-amber-800 placeholder-slate-400 outline-none uppercase tracking-widest text-center transition"
                  />
                  <p className="text-[10px] text-slate-400 mt-1 text-center">
                    После входа доска автоматически сохранится в списке ваших комнат
                  </p>
                </div>

                {/* Marker Color Row */}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs font-semibold text-slate-600">Цвет маркера:</span>
                  <div className="flex items-center gap-1.5">
                    {AVATAR_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setUserColor(c)}
                        className={`w-5 h-5 rounded-full transition transform hover:scale-110 flex items-center justify-center cursor-pointer ${
                          userColor === c ? 'ring-2 ring-blue-600 ring-offset-2 scale-110' : 'opacity-70 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full h-11 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-600/20 transition flex items-center justify-center gap-2 cursor-pointer mt-2"
                >
                  <span>{authLoading ? 'Подключение...' : 'Присоединиться к уроку'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ===================== MODAL 2: СОЗДАТЬ НОВУЮ КОМНАТУ (TUTOR ONLY) ===================== */}
      {activeDialog === 'create-room' && isTutor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-[480px] bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Создание новой комнаты</h3>
                  <p className="text-[11px] text-slate-500">Запуск интерактивного онлайн-урока</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveDialog(null);
                  setAuthError(null);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleCreateRoomSubmit} className="p-6 space-y-4">
              {/* Room Emoji Icon Selector */}
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
                  Название урока
                </label>
                <input
                  type="text"
                  required
                  value={lessonTitle}
                  onChange={(e) => setLessonTitle(e.target.value)}
                  placeholder="Например: Подготовка к экзамену"
                  className="w-full bg-slate-50/80 hover:bg-white focus:bg-white border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 outline-none transition"
                />
              </div>

              {/* Subject / Предмет */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Предмет / Тема
                </label>
                <input
                  type="text"
                  value={lessonSubject}
                  onChange={(e) => setLessonSubject(e.target.value)}
                  placeholder="Например: Математика, Физика, Информатика"
                  className="w-full bg-slate-50/80 hover:bg-white focus:bg-white border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 outline-none transition"
                />
              </div>

              {/* Marker Color Row */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-semibold text-slate-600">Цвет маркера преподавателя:</span>
                <div className="flex items-center gap-1.5">
                  {AVATAR_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setUserColor(c)}
                      className={`w-5 h-5 rounded-full transition transform hover:scale-110 flex items-center justify-center cursor-pointer ${
                        userColor === c ? 'ring-2 ring-blue-600 ring-offset-2 scale-110' : 'opacity-70 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-600/20 transition flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                <span>Создать и открыть комнату</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ===================== MODAL 3: ИМПОРТ СОХРАНЕНИЯ (TUTOR ONLY) ===================== */}
      {activeDialog === 'backup-import' && pendingBackupData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-[480px] bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Загрузка сохранения</h3>
                  <p className="text-[11px] text-slate-500">Восстановление данных из .json файла</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveDialog(null);
                  setPendingBackupData(null);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 flex flex-col gap-4">
              {/* File details card */}
              <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800 truncate">
                    <FileJson className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="truncate max-w-[240px]">{pendingBackupData.filename}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {pendingBackupData.sizeKb} КБ
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-200/60">
                  <span className="px-2.5 py-1 bg-white border border-slate-200 text-slate-700 rounded-lg text-[10px] font-bold">
                    🏛 {pendingBackupData.roomsCount} комнат
                  </span>
                  <span className="px-2.5 py-1 bg-white border border-slate-200 text-slate-700 rounded-lg text-[10px] font-bold">
                    👥 {pendingBackupData.usersCount} пользователей
                  </span>
                  {pendingBackupData.inviteCodesCount > 0 && (
                    <span className="px-2.5 py-1 bg-white border border-slate-200 text-slate-700 rounded-lg text-[10px] font-bold">
                      🔑 {pendingBackupData.inviteCodesCount} ключей
                    </span>
                  )}
                </div>
              </div>

              {/* Mode choice */}
              <div className="flex flex-col gap-2">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Режим восстановления:
                </label>

                <div className="grid grid-cols-1 gap-2">
                  <div
                    onClick={() => setImportMode('merge')}
                    className={`p-3 rounded-2xl border transition cursor-pointer flex items-start gap-3 ${
                      importMode === 'merge'
                        ? 'bg-blue-50/70 border-blue-400 ring-1 ring-blue-400'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === 'merge'}
                      onChange={() => setImportMode('merge')}
                      className="mt-0.5 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">
                        Объединить с текущими данными (Рекомендуется)
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Добавит новые комнаты и пользователей, обновит совпадающие, сохранив текущие активные сессии.
                      </p>
                    </div>
                  </div>

                  <div
                    onClick={() => setImportMode('replace')}
                    className={`p-3 rounded-2xl border transition cursor-pointer flex items-start gap-3 ${
                      importMode === 'replace'
                        ? 'bg-amber-50/70 border-amber-400 ring-1 ring-amber-400'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === 'replace'}
                      onChange={() => setImportMode('replace')}
                      className="mt-0.5 text-amber-600 focus:ring-amber-500"
                    />
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">
                        Полная замена (Перезаписать)
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Сотрет текущую базу данных комнат и ключей и полностью заменит данными из файла.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setActiveDialog(null);
                    setPendingBackupData(null);
                  }}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Отмена
                </button>

                <button
                  type="button"
                  onClick={handleConfirmImportBackup}
                  disabled={isImportingBackup}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm shadow-emerald-600/20 transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isImportingBackup ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Применение...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Применить сохранение</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Avatar Picker Modal */}
      <AvatarPicker
        isOpen={showAvatarModal}
        onClose={() => setShowAvatarModal(false)}
        selectedAvatar={currentUser.avatar || regAvatar}
        selectedColor={userColor}
        userName={currentUser.name}
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
