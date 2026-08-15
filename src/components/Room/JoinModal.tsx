import React, { useState, useEffect } from 'react';
import { UserRole } from '../../types';
import {
  GraduationCap,
  KeyRound,
  PlusCircle,
  BookOpen,
  User,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Zap,
} from 'lucide-react';

interface JoinModalProps {
  onJoinRoom: (params: {
    roomId: string;
    userName: string;
    role: UserRole;
    color: string;
    title?: string;
    subject?: string;
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

export const JoinModal: React.FC<JoinModalProps> = ({ onJoinRoom }) => {
  const [mode, setMode] = useState<'join' | 'create'>('join');
  const [roomCode, setRoomCode] = useState('');
  const [userName, setUserName] = useState('');
  const [role, setRole] = useState<UserRole>('student');
  const [selectedSubject, setSelectedSubject] = useState('Математика');
  const [lessonTitle, setLessonTitle] = useState('Занятие по математике');
  const [selectedColor, setSelectedColor] = useState(AVATAR_COLORS[0]);

  // Check URL query param ?room=CODE
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const codeParam = params.get('room');
    if (codeParam) {
      setRoomCode(codeParam.toUpperCase());
      setMode('join');
      setRole('student');
    }
  }, []);

  const handleGenerateCode = () => {
    const prefix = selectedSubject === 'Математика' ? 'MATH' : selectedSubject === 'Физика' ? 'PHYS' : 'LESSON';
    const num = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}-${num}`;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let targetCode = roomCode.trim().toUpperCase();
    if (mode === 'create' && !targetCode) {
      targetCode = handleGenerateCode();
    }

    if (!targetCode) return;

    const finalName =
      userName.trim() || (role === 'tutor' ? 'Преподаватель' : 'Ученик');

    onJoinRoom({
      roomId: targetCode,
      userName: finalName,
      role,
      color: selectedColor,
      title: mode === 'create' ? lessonTitle : undefined,
      subject: mode === 'create' ? selectedSubject : undefined,
    });
  };

  const handleQuickDemo = (demoRole: UserRole) => {
    const demoCode = 'MATH-2026';
    onJoinRoom({
      roomId: demoCode,
      userName: demoRole === 'tutor' ? 'Алексей (Репетитор)' : 'Михаил (Ученик)',
      role: demoRole,
      color: demoRole === 'tutor' ? '#2563EB' : '#16A34A',
      title: 'Подготовка к экзамену',
      subject: 'Математика',
    });
  };

  return (
    <div
      id="tutorboard-join-screen"
      className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 flex flex-col justify-center items-center p-4 selection:bg-blue-500 selection:text-white"
    >
      <div className="w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Banner Header */}
        <div className="bg-slate-900 text-white p-6 border-b border-slate-800 relative overflow-hidden">
          <div className="absolute -right-8 -bottom-8 w-40 h-40 bg-blue-600/20 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/30 text-white font-bold">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight">TutorBoard</h1>
              <p className="text-xs text-slate-400">
                Интерактивная доска для репетитора и ученика с голосовой связью
              </p>
            </div>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="grid grid-cols-2 gap-1.5 bg-slate-800/90 p-1 rounded-2xl mt-4 border border-slate-700">
            <button
              type="button"
              onClick={() => {
                setMode('join');
                setRole('student');
              }}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                mode === 'join'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <KeyRound className="w-4 h-4" />
              Войти по коду
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('create');
                setRole('tutor');
              }}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                mode === 'create'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <PlusCircle className="w-4 h-4" />
              Создать занятие
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Room Code field if Join */}
          {mode === 'join' ? (
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Код комнаты от преподавателя:
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
              <p className="text-[11px] text-slate-500 mt-1">
                Преподаватель может скопировать код в правом верхнем углу доски
              </p>
            </div>
          ) : (
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
                  Тема урока (необязательно):
                </label>
                <input
                  type="text"
                  value={lessonTitle}
                  onChange={(e) => setLessonTitle(e.target.value)}
                  placeholder="Тема урока, класс или задача..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {/* Name and Role */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Ваше имя / фамилия:
              </label>
              <input
                type="text"
                required
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder={role === 'tutor' ? 'Иван Сергеевич' : 'Михаил'}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Роль в занятии:
              </label>
              <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setRole('tutor')}
                  className={`py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 ${
                    role === 'tutor'
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>👨‍🏫 Репетитор</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRole('student')}
                  className={`py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 ${
                    role === 'student'
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>👨‍🎓 Ученик</span>
                </button>
              </div>
            </div>
          </div>

          {/* Avatar Color */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Цвет вашего маркера и курсора:
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

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-2xl shadow-lg shadow-blue-600/30 hover:shadow-blue-600/40 transition flex items-center justify-center gap-2 mt-4"
          >
            <span>{mode === 'join' ? 'Войти в комнату занятия' : 'Создать комнату и начать урок'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Demo Quick Entry Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-600">
          <div className="flex items-center gap-1.5 font-medium">
            <Zap className="w-4 h-4 text-amber-500" />
            <span>Быстрый тест платформы:</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleQuickDemo('tutor')}
              className="px-2.5 py-1.5 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-blue-700 font-semibold rounded-xl transition shadow-xs"
            >
              👨‍🏫 Тест Репетитор
            </button>
            <button
              type="button"
              onClick={() => handleQuickDemo('student')}
              className="px-2.5 py-1.5 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-emerald-700 font-semibold rounded-xl transition shadow-xs"
            >
              👨‍🎓 Тест Ученик
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
