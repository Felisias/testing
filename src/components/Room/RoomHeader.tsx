import React, { useState, useEffect } from 'react';
import { UserRole, Participant } from '../../types';
import { getSocket } from '../../services/socket';
import confetti from 'canvas-confetti';
import {
  GraduationCap,
  Copy,
  Check,
  Share2,
  Lock,
  Unlock,
  Star,
  Bell,
  Clock,
  Play,
  Pause,
  RotateCcw,
  Users,
  MessageSquare,
  LogOut,
  QrCode,
  Sparkles,
} from 'lucide-react';

interface RoomHeaderProps {
  roomId: string;
  roomTitle: string;
  subject: string;
  userRole: UserRole;
  userName: string;
  isLocked: boolean;
  participants: Record<string, Participant>;
  unreadChatCount: number;
  onToggleChat: () => void;
  onToggleParticipants: () => void;
  onLeaveRoom: () => void;
}

export const RoomHeader: React.FC<RoomHeaderProps> = ({
  roomId,
  roomTitle,
  subject,
  userRole,
  userName,
  isLocked,
  participants,
  unreadChatCount,
  onToggleChat,
  onToggleParticipants,
  onLeaveRoom,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  // Lesson Timer state
  const [timerSeconds, setTimerSeconds] = useState(45 * 60); // 45 min default
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [showTimerMenu, setShowTimerMenu] = useState(false);

  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => Math.max(0, prev - 1));
      }, 1000);
    } else if (timerSeconds === 0 && isTimerRunning) {
      setIsTimerRunning(false);
      // Play a gentle alert beep or confetti
      confetti({ particleCount: 50, spread: 60 });
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timerSeconds]);

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomId);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const copyDirectLink = () => {
    const link = `${window.location.origin}?room=${roomId}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleToggleLock = () => {
    getSocket().emit('board:lock:toggle');
  };

  const handleCheerStudent = () => {
    // Local confetti
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
    });
    // Broadcast praise to room
    getSocket().emit('tutor:cheer', {
      message: 'Прекрасно решено! Отличная работа!',
    });
  };

  const handleAttentionPing = () => {
    getSocket().emit('tutor:attention', {
      text: 'Внимание на доску! Пожалуйста, посмотрите на решение.',
    });
  };

  const formatTime = (totalSec: number) => {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const participantCount = Object.keys(participants).length;

  return (
    <header
      id="tutorboard-header"
      className="bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 py-2 flex flex-wrap items-center justify-between gap-3 select-none"
    >
      {/* Left: Branding, Subject & Room Code */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-sm">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-slate-900 leading-tight truncate max-w-[160px] sm:max-w-[220px]">
                {roomTitle}
              </h1>
              <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[11px] font-semibold">
                {subject}
              </span>
            </div>
            <p className="text-[11px] text-slate-600">
              Вы вошли как: <span className="font-semibold text-slate-700">{userName}</span> ({userRole === 'tutor' ? '👨‍🏫 Репетитор' : '👨‍🎓 Ученик'})
            </p>
          </div>
        </div>

        {/* Room Code Badge with 1-click copy */}
        <div className="flex items-center gap-1 bg-slate-100/90 hover:bg-slate-200/90 border border-slate-300/80 rounded-xl px-2.5 py-1 transition">
          <span className="text-[11px] text-slate-600 font-medium">Код:</span>
          <span className="font-mono text-xs font-bold text-slate-900 tracking-wider">
            {roomId}
          </span>
          <button
            onClick={copyRoomCode}
            title="Скопировать код комнаты"
            className="p-1 text-slate-500 hover:text-blue-600 transition"
          >
            {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => setShowShareModal(true)}
            title="Поделиться ссылкой с учеником"
            className="p-1 text-slate-500 hover:text-blue-600 transition ml-0.5"
          >
            <Share2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Middle: Lesson Timer */}
      <div className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-xl border border-slate-200">
        <Clock className="w-4 h-4 text-blue-600" />
        <span className="font-mono text-xs font-bold text-slate-800 w-12 text-center">
          {formatTime(timerSeconds)}
        </span>

        {/* Play/Pause */}
        <button
          onClick={() => setIsTimerRunning(!isTimerRunning)}
          title={isTimerRunning ? 'Пауза' : 'Запустить таймер урока'}
          className="p-1 hover:bg-white rounded text-slate-700 transition"
        >
          {isTimerRunning ? <Pause className="w-3.5 h-3.5 text-amber-600" /> : <Play className="w-3.5 h-3.5 text-emerald-600" />}
        </button>

        {/* Presets menu */}
        <div className="relative">
          <button
            onClick={() => setShowTimerMenu(!showTimerMenu)}
            title="Настройки времени урока"
            className="p-1 hover:bg-white rounded text-slate-500 transition text-[11px]"
          >
            ⚙️
          </button>
          {showTimerMenu && (
            <div
              className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-200 p-1.5 z-50 animate-in fade-in"
              onMouseLeave={() => setShowTimerMenu(false)}
            >
              <div className="text-[10px] font-bold text-slate-600 px-2 py-1 uppercase">Длительность урока</div>
              {[
                { label: '30 минут', sec: 30 * 60 },
                { label: '45 минут (школьный)', sec: 45 * 60 },
                { label: '60 минут (1 час)', sec: 60 * 60 },
                { label: '90 минут (1.5 часа)', sec: 90 * 60 },
              ].map((item) => (
                <button
                  key={item.sec}
                  onClick={() => {
                    setTimerSeconds(item.sec);
                    setIsTimerRunning(false);
                    setShowTimerMenu(false);
                  }}
                  className="w-full text-left px-2 py-1.5 text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-700 rounded-lg font-medium transition"
                >
                  {item.label}
                </button>
              ))}
              <div className="border-t border-slate-100 my-1" />
              <button
                onClick={() => {
                  setTimerSeconds(45 * 60);
                  setIsTimerRunning(false);
                  setShowTimerMenu(false);
                }}
                className="w-full text-left px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 rounded-lg transition flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" /> Сбросить
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right: Tutor Special Tools & Navigation Actions */}
      <div className="flex items-center gap-2">
        {/* Tutor Only Superpowers */}
        {userRole === 'tutor' && (
          <div className="flex items-center gap-1 bg-amber-50/80 p-1 rounded-xl border border-amber-200">
            {/* Lock/Unlock drawing */}
            <button
              onClick={handleToggleLock}
              title={isLocked ? 'Разблокировать доску для учеников' : 'Заблокировать доску (Только преподаватель)'}
              className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition ${
                isLocked ? 'bg-amber-500 text-white shadow-xs' : 'text-amber-800 hover:bg-amber-100'
              }`}
            >
              {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
              <span className="hidden lg:inline">{isLocked ? 'Доска закрыта' : 'Доска открыта'}</span>
            </button>

            {/* Praise Student Confetti */}
            <button
              onClick={handleCheerStudent}
              title="Похвалить ученика! (Салют и звезды на экране)"
              className="p-1.5 rounded-lg text-xs font-semibold text-amber-900 hover:bg-amber-200/70 transition flex items-center gap-1"
            >
              <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
              <span className="hidden lg:inline">Похвалить</span>
            </button>

            {/* Attention Ping */}
            <button
              onClick={handleAttentionPing}
              title="Привлечь внимание к доске"
              className="p-1.5 rounded-lg text-xs font-semibold text-amber-900 hover:bg-amber-200/70 transition flex items-center gap-1"
            >
              <Bell className="w-3.5 h-3.5 text-amber-600" />
            </button>
          </div>
        )}

        {/* Participants drawer toggle */}
        <button
          onClick={onToggleParticipants}
          title="Список участников занятия"
          className="px-2.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition"
        >
          <Users className="w-4 h-4 text-blue-600" />
          <span>{participantCount}</span>
        </button>

        {/* Chat drawer toggle */}
        <button
          onClick={onToggleChat}
          title="Чат занятия"
          className="relative p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 transition"
        >
          <MessageSquare className="w-4 h-4 text-blue-600" />
          {unreadChatCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center animate-bounce">
              {unreadChatCount}
            </span>
          )}
        </button>

        {/* Leave room */}
        <button
          onClick={onLeaveRoom}
          title="Выйти из комнаты"
          className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>

      {/* Share Modal Dialog */}
      {showShareModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 max-w-md w-full animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <Share2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Пригласить на урок</h3>
                  <p className="text-xs text-slate-500">Отправьте ученику код или прямую ссылку</p>
                </div>
              </div>
              <button
                onClick={() => setShowShareModal(false)}
                className="text-slate-400 hover:text-slate-700 text-sm font-semibold p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {/* Code Box */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Код комнаты:</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-slate-100 border border-slate-300 rounded-xl px-4 py-2.5 font-mono text-lg font-bold text-blue-700 tracking-wider text-center">
                    {roomId}
                  </div>
                  <button
                    onClick={copyRoomCode}
                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-xs transition flex items-center gap-1.5 shadow-sm"
                  >
                    {copiedCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copiedCode ? 'Скопировано' : 'Копировать'}
                  </button>
                </div>
              </div>

              {/* Direct Link Box */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Прямая ссылка для входа:</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`${window.location.origin}?room=${roomId}`}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 select-all"
                  />
                  <button
                    onClick={copyDirectLink}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-semibold text-xs transition flex items-center gap-1"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    Ссылка
                  </button>
                </div>
              </div>

              {/* Step by Step Tip */}
              <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-600 space-y-1 border border-slate-200">
                <p className="font-semibold text-slate-800">Как ученику подключиться:</p>
                <p>1. Открыть сайт и нажать "Войти по коду".</p>
                <p>2. Ввести код <strong className="text-blue-600 font-mono">{roomId}</strong> и свое имя.</p>
                <p>3. Включить микрофон и начать интерактивный урок!</p>
              </div>

              <button
                onClick={() => setShowShareModal(false)}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-xl text-xs transition"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
