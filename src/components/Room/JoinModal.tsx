import React, { useState, useEffect } from 'react';
import { UserAccount, SavedBoard, UserRole } from '../../types';
import {
  GraduationCap,
  KeyRound,
  Lock,
  User,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  BookOpen,
  PlusCircle,
  Clock,
  LogOut,
  FolderKanban,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';

interface AuthModalProps {
  onJoinRoom: (params: {
    roomId: string;
    userName: string;
    role: UserRole;
    color: string;
    title?: string;
    subject?: string;
    userId?: string;
  }) => void;
}

const SUBJECT_OPTIONS = [
  { id: 'Математика', icon: '📐', desc: 'Алгебра, геометрия, ОГЭ/ЕГЭ' },
  { id: 'Физика', icon: '⚡', desc: 'Механика, оптика, термодинамика' },
  { id: 'Информатика', icon: '💻', desc: 'Программирование, алгоритмы' },
  { id: 'Русский язык', icon: '📖', desc: 'Грамотность, сочинения, правила' },
  { id: 'Английский язык', icon: '🌍', desc: 'Грамматика, лексика, диалоги' },
  { id: 'Химия / Биология', icon: '🧪', desc: 'Формулы, реакции, генетика' },
];

const AVATAR_COLORS = [
  '#2563EB', '#DC2626', '#16A34A', '#9333EA',
  '#EA580C', '#0D9488', '#E11D48', '#4F46E5',
];

const STORAGE_KEY = 'tutorboard_user_session';

export const JoinModal: React.FC<AuthModalProps> = ({ onJoinRoom }) => {
  // Current logged in user
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [savedBoards, setSavedBoards] = useState<SavedBoard[]>([]);

  // Auth form state (if not logged in)
  const [authTab, setAuthTab] = useState<'login' | 'register'>('register');
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regName, setRegName] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regTutorCode, setRegTutorCode] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // Room action state (when logged in)
  const [roomAction, setRoomAction] = useState<'join' | 'create'>('join');
  const [roomCode, setRoomCode] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('Математика');
  const [lessonTitle, setLessonTitle] = useState('Занятие по математике');
  const [selectedColor, setSelectedColor] = useState(AVATAR_COLORS[0]);

  // Load saved persistent session on startup
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.user) {
          setCurrentUser(parsed.user);
          if (parsed.user.role === 'tutor') {
            setRoomAction('create');
          } else {
            setRoomAction('join');
          }
          if (parsed.savedBoards) {
            setSavedBoards(parsed.savedBoards);
          }
          // Fetch freshest saved boards from server
          fetch(`/api/user/boards?username=${encodeURIComponent(parsed.user.username)}`)
            .then((r) => r.json())
            .then((data) => {
              if (data?.savedBoards) {
                setSavedBoards(data.savedBoards);
              }
            })
            .catch(() => {});
        }
      }
    } catch (e) {
      console.warn('Could not read saved session:', e);
    }
  }, []);

  // Check URL query param ?room=CODE
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const codeParam = params.get('room');
    if (codeParam) {
      setRoomCode(codeParam.toUpperCase());
      setRoomAction('join');
    }
  }, []);

  // Handle Registration
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: regUsername.trim(),
          name: regName.trim(),
          password: regPassword,
          tutorCode: regTutorCode.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Ошибка регистрации');
      }

      const user: UserAccount = data.user;
      setCurrentUser(user);
      setSavedBoards([]);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ user, savedBoards: [] }));

      if (user.role === 'tutor') {
        setRoomAction('create');
      } else {
        setRoomAction('join');
      }
    } catch (err: any) {
      setAuthError(err.message || 'Произошла ошибка при регистрации');
    } finally {
      setAuthLoading(false);
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ user, savedBoards: boards }));

      if (user.role === 'tutor') {
        setRoomAction('create');
      } else {
        setRoomAction('join');
      }
    } catch (err: any) {
      setAuthError(err.message || 'Ошибка входа');
    } finally {
      setAuthLoading(false);
    }
  };

  // Logout
  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setCurrentUser(null);
    setSavedBoards([]);
    setAuthTab('login');
  };

  const handleGenerateCode = () => {
    const prefix = selectedSubject === 'Математика' ? 'MATH' : selectedSubject === 'Физика' ? 'PHYS' : 'LESSON';
    const num = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}-${num}`;
  };

  // Submit Room Entry
  const handleRoomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    let targetCode = roomCode.trim().toUpperCase();
    if (roomAction === 'create' && !targetCode) {
      targetCode = handleGenerateCode();
    }

    if (!targetCode) return;

    const boardTitle = roomAction === 'create' ? lessonTitle : `Занятие ${targetCode}`;
    const boardSubject = roomAction === 'create' ? selectedSubject : 'Предмет';

    // Save to user history
    fetch('/api/user/boards/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: currentUser.username,
        board: {
          id: targetCode,
          title: boardTitle,
          subject: boardSubject,
          role: currentUser.role,
        },
      }),
    }).catch(() => {});

    onJoinRoom({
      roomId: targetCode,
      userName: currentUser.name,
      role: currentUser.role,
      color: selectedColor,
      title: roomAction === 'create' ? lessonTitle : undefined,
      subject: roomAction === 'create' ? selectedSubject : undefined,
      userId: currentUser.id,
    });
  };

  // Join saved board from history
  const handleOpenSavedBoard = (board: SavedBoard) => {
    if (!currentUser) return;
    onJoinRoom({
      roomId: board.id,
      userName: currentUser.name,
      role: currentUser.role,
      color: selectedColor,
      title: board.title,
      subject: board.subject,
      userId: currentUser.id,
    });
  };

  return (
    <div
      id="tutorboard-auth-screen"
      className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 flex flex-col justify-center items-center p-4 selection:bg-blue-500 selection:text-white"
    >
      <div className="w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Banner Header */}
        <div className="bg-slate-900 text-white p-6 border-b border-slate-800 relative overflow-hidden">
          <div className="absolute -right-8 -bottom-8 w-40 h-40 bg-blue-600/20 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/30 text-white font-bold">
                <GraduationCap className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-extrabold tracking-tight">TutorBoard</h1>
                <p className="text-xs text-slate-400">
                  Интерактивная доска для репетитора и ученика с синхронизацией и голосом
                </p>
              </div>
            </div>

            {/* If logged in, show user info and logout button */}
            {currentUser && (
              <button
                onClick={handleLogout}
                title="Выйти из аккаунта"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-rose-950 hover:text-rose-400 border border-slate-700 rounded-xl text-xs font-semibold text-slate-300 transition"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Выйти</span>
              </button>
            )}
          </div>

          {/* User Status Bar if Logged In */}
          {currentUser && (
            <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>
                  Вы вошли как: <strong className="text-white font-bold">{currentUser.name}</strong> (@{currentUser.username})
                </span>
              </div>
              <span
                className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold ${
                  currentUser.role === 'tutor'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                }`}
              >
                {currentUser.role === 'tutor' ? '👨‍🏫 Репетитор' : '👨‍🎓 Ученик'}
              </span>
            </div>
          )}
        </div>

        {/* NOT LOGGED IN: Registration / Login Tabs */}
        {!currentUser ? (
          <div className="p-6">
            {/* Tabs */}
            <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-2xl mb-5">
              <button
                type="button"
                onClick={() => {
                  setAuthTab('register');
                  setAuthError(null);
                }}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  authTab === 'register'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sparkles className="w-4 h-4 text-blue-600" />
                Регистрация
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthTab('login');
                  setAuthError(null);
                }}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  authTab === 'login'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <KeyRound className="w-4 h-4 text-slate-600" />
                Вход в аккаунт
              </button>
            </div>

            {authError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{authError}</span>
              </div>
            )}

            {/* Registration Form */}
            {authTab === 'register' ? (
              <form onSubmit={handleRegister} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Логин / Никнейм:
                  </label>
                  <input
                    type="text"
                    required
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    placeholder="Например: alex_math"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Ваше Имя и Фамилия:
                  </label>
                  <input
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="Например: Иван Иванов"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Пароль:
                  </label>
                  <input
                    type="password"
                    required
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Придумайте пароль..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Secret Tutor Access Code */}
                <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-3">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-amber-600" />
                      Секретный код преподавателя (если вы репетитор):
                    </label>
                  </div>
                  <input
                    type="text"
                    value={regTutorCode}
                    onChange={(e) => setRegTutorCode(e.target.value)}
                    placeholder="Введите секретный код для прав репетитора"
                    className="w-full bg-white border border-amber-300 rounded-xl px-3.5 py-2 text-xs font-mono font-bold text-amber-950 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <p className="text-[11px] text-amber-800/80 mt-1">
                    * Ученики оставляют это поле пустым. Репетиторы вводят секретный код для доступа к созданию комнат и управлению доской.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-2xl shadow-lg shadow-blue-600/30 transition flex items-center justify-center gap-2 mt-2"
                >
                  <span>{authLoading ? 'Регистрация...' : 'Зарегистрироваться и войти'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            ) : (
              /* Login Form */
              <form onSubmit={handleLogin} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Логин / Никнейм:
                  </label>
                  <input
                    type="text"
                    required
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    placeholder="Ваш логин..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Пароль:
                  </label>
                  <input
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Ваш пароль..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-2xl shadow-lg shadow-blue-600/30 transition flex items-center justify-center gap-2 mt-4"
                >
                  <span>{authLoading ? 'Вход...' : 'Войти в аккаунт'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            )}
          </div>
        ) : (
          /* LOGGED IN VIEW: Room Creation (Tutor Only) or Join Room (Student & Tutor) + Saved Boards */
          <div className="p-6 space-y-5">
            {/* Tutor Mode vs Student Mode tabs */}
            {currentUser.role === 'tutor' ? (
              <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setRoomAction('create')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                    roomAction === 'create'
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <PlusCircle className="w-4 h-4 text-blue-600" />
                  Создать занятие
                </button>
                <button
                  type="button"
                  onClick={() => setRoomAction('join')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                    roomAction === 'join'
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <KeyRound className="w-4 h-4 text-slate-600" />
                  Войти по коду
                </button>
              </div>
            ) : (
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-2xl flex items-center gap-2.5 text-xs text-blue-950 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Аккаунт ученика: введите код комнаты, выданный репетитором для подключения к занятию.</span>
              </div>
            )}

            {/* Room Entry Form */}
            <form onSubmit={handleRoomSubmit} className="space-y-4">
              {roomAction === 'join' || currentUser.role === 'student' ? (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Код комнаты урока от репетитора:
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={roomCode}
                      onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                      placeholder="Например: MATH-8492"
                      className="w-full bg-slate-50 border-2 border-slate-200 focus:border-blue-500 focus:bg-white rounded-2xl px-4 py-3 font-mono text-base font-bold text-slate-900 tracking-wider placeholder-slate-400 focus:outline-none transition uppercase"
                    />
                    <KeyRound className="absolute right-4 top-3.5 w-5 h-5 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              ) : (
                /* Tutor: Create lesson settings */
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Предмет занятия:
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {SUBJECT_OPTIONS.map((sub) => (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => {
                            setSelectedSubject(sub.id);
                            setLessonTitle(`Занятие: ${sub.id}`);
                          }}
                          className={`p-2.5 rounded-xl border text-left transition flex flex-col ${
                            selectedSubject === sub.id
                              ? 'border-blue-600 bg-blue-50/70 ring-1 ring-blue-500 text-blue-950 font-bold'
                              : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <span className="text-base mb-0.5">{sub.icon}</span>
                          <span className="text-xs font-semibold">{sub.id}</span>
                          <span className="text-[9px] text-slate-500 leading-tight truncate">
                            {sub.desc}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Тема урока:
                    </label>
                    <input
                      type="text"
                      value={lessonTitle}
                      onChange={(e) => setLessonTitle(e.target.value)}
                      placeholder="Тема урока, класс или блок задач..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                    />
                  </div>
                </div>
              )}

              {/* Avatar Color Swatch */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Цвет маркера и курсора:
                </label>
                <div className="flex items-center gap-2">
                  {AVATAR_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setSelectedColor(c)}
                      className={`w-7 h-7 rounded-full transition-transform ${
                        selectedColor === c
                          ? 'ring-2 ring-blue-600 ring-offset-2 scale-110'
                          : 'opacity-80 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-2xl shadow-lg shadow-blue-600/30 transition flex items-center justify-center gap-2"
              >
                <span>
                  {roomAction === 'create' && currentUser.role === 'tutor'
                    ? 'Создать комнату и начать урок'
                    : 'Войти на доску занятия'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            {/* Saved Boards History in User Account */}
            {savedBoards.length > 0 && (
              <div className="pt-4 border-t border-slate-200">
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 uppercase tracking-wider">
                    <FolderKanban className="w-4 h-4 text-blue-600" />
                    <span>
                      {currentUser.role === 'tutor' ? 'Мои сохраненные доски' : 'Мои пройденные занятия'}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500">{savedBoards.length} досок</span>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {savedBoards.map((board) => (
                    <div
                      key={board.id}
                      className="p-2.5 bg-slate-50 hover:bg-blue-50/60 border border-slate-200 hover:border-blue-300 rounded-xl transition flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-blue-700">{board.id}</span>
                          <span className="font-semibold text-slate-800 truncate">{board.title}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 truncate">
                          {board.subject} • {new Date(board.lastVisited).toLocaleDateString('ru-RU')}
                        </p>
                      </div>

                      <button
                        onClick={() => handleOpenSavedBoard(board)}
                        className="px-3 py-1 bg-white hover:bg-blue-600 hover:text-white border border-slate-200 text-blue-600 font-semibold rounded-lg transition shrink-0 shadow-2xs"
                      >
                        Открыть
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
