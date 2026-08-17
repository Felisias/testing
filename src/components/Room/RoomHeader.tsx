import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { UserRole, Participant } from '../../types';
import { UserAvatar } from '../Common/UserAvatar';
import { UsersListModal } from './UsersListModal';
import { InviteCodeModal } from './InviteCodeModal';
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
  ChevronDown,
  Settings,
  Code2,
  Layout,
  UserCheck,
  KeyRound,
} from 'lucide-react';

interface RoomHeaderProps {
  roomId: string;
  roomTitle: string;
  subject: string;
  userRole: UserRole;
  userName: string;
  userColor?: string;
  userAvatar?: string;
  isLocked: boolean;
  participants: Record<string, Participant>;
  unreadChatCount: number;
  activeView: 'board' | 'ide';
  onToggleChat: () => void;
  onToggleParticipants: () => void;
  onLeaveRoom: () => void;
  onOpenSettings: () => void;
  onSelectView: (view: 'board' | 'ide') => void;
  onOpenAvatarPicker?: () => void;
}

export const RoomHeader: React.FC<RoomHeaderProps> = ({
  roomId,
  roomTitle,
  subject,
  userRole,
  userName,
  userColor = '#2563EB',
  userAvatar = '🎓',
  isLocked,
  participants,
  unreadChatCount,
  activeView,
  onToggleChat,
  onToggleParticipants,
  onLeaveRoom,
  onOpenSettings,
  onSelectView,
  onOpenAvatarPicker,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showUsersModal, setShowUsersModal] = useState(false);
  const [showInviteCodeModal, setShowInviteCodeModal] = useState(false);

  // Lesson Timer state (synchronized via server sockets)
  const [timerSeconds, setTimerSeconds] = useState(45 * 60); // 45 min default
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [showTimerMenu, setShowTimerMenu] = useState(false);
  const [customMinutesInput, setCustomMinutesInput] = useState('45');

  const isDarkTheme = activeView === 'ide';

  // Listen for real-time timer sync from tutor/server
  useEffect(() => {
    const socket = getSocket();
    const handleTimerSync = (data: {
      seconds?: number;
      timerSeconds?: number;
      isRunning?: boolean;
      isTimerRunning?: boolean;
    }) => {
      const sec = data.timerSeconds ?? data.seconds;
      const running = data.isTimerRunning ?? data.isRunning;
      if (typeof sec === 'number') {
        setTimerSeconds(sec);
      }
      if (typeof running === 'boolean') {
        setIsTimerRunning(running);
      }
    };

    socket.on('timer:synced', handleTimerSync);

    return () => {
      socket.off('timer:synced', handleTimerSync);
    };
  }, []);

  // Local tick fallback / countdown
  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => Math.max(0, prev - 1));
      }, 1000);
    } else if (timerSeconds === 0 && isTimerRunning) {
      setIsTimerRunning(false);
      confetti({ particleCount: 60, spread: 70 });
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
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
    });
    getSocket().emit('tutor:cheer', {
      message: 'Прекрасно решено! Отличная работа!',
    });
  };

  const handleAttentionPing = () => {
    getSocket().emit('tutor:attention', {
      text: 'Внимание на доску! Пожалуйста, посмотрите на решение.',
    });
  };

  // Timer controls (Tutor broadcasts to all students)
  const handleToggleTimer = () => {
    const socket = getSocket();
    if (isTimerRunning) {
      setIsTimerRunning(false);
      socket.emit('timer:pause', { timerSeconds });
    } else {
      setIsTimerRunning(true);
      socket.emit('timer:start', { timerSeconds });
    }
  };

  const handleSetTimerDuration = (seconds: number) => {
    setTimerSeconds(seconds);
    setIsTimerRunning(false);
    setShowTimerMenu(false);
    getSocket().emit('timer:set', { seconds, timerSeconds: seconds });
  };

  const handleCustomTimeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const mins = parseInt(customMinutesInput, 10);
    if (!isNaN(mins) && mins > 0 && mins <= 600) {
      handleSetTimerDuration(mins * 60);
    }
  };

  const handleResetTimer = () => {
    setTimerSeconds(45 * 60);
    setIsTimerRunning(false);
    setShowTimerMenu(false);
    getSocket().emit('timer:reset', { timerSeconds: 45 * 60 });
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
      className={`relative z-50 px-4 py-2 flex flex-wrap items-center justify-between gap-3 select-none transition-colors duration-200 shadow-xs border-b ${
        isDarkTheme
          ? 'bg-slate-900 border-slate-800 text-slate-100'
          : 'bg-white/95 backdrop-blur-md border-slate-200 text-slate-900'
      }`}
    >
      {/* Left: Site Icon and Room Title ONLY (No "Вы вошли как") */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-sm shrink-0">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <h1
              className={`text-sm font-bold leading-tight truncate max-w-[180px] sm:max-w-[260px] ${
                isDarkTheme ? 'text-white' : 'text-slate-900'
              }`}
            >
              {roomTitle}
            </h1>
          </div>
        </div>

        {/* Room Code Badge with 1-click copy */}
        <div
          className={`flex items-center gap-1 rounded-xl px-2.5 py-1 transition border ${
            isDarkTheme
              ? 'bg-slate-800 border-slate-700 hover:bg-slate-750 text-slate-300'
              : 'bg-slate-100 border-slate-200 hover:bg-slate-200/90 text-slate-600'
          }`}
        >
          <span className="text-[11px] font-medium opacity-80">Код:</span>
          <span
            className={`font-mono text-xs font-bold tracking-wider ${
              isDarkTheme ? 'text-blue-400' : 'text-blue-600'
            }`}
          >
            {roomId}
          </span>
          <button
            onClick={copyRoomCode}
            title="Скопировать код комнаты"
            className="p-1 hover:text-blue-400 transition cursor-pointer"
          >
            {copiedCode ? (
              <Check className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            onClick={() => setShowShareModal(true)}
            title="Поделиться ссылкой с учеником"
            className="p-1 hover:text-blue-400 transition ml-0.5 cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Middle: 2-Button Toggle (Board vs IDE) + Lesson Timer */}
      <div className="flex items-center gap-3">
        {/* Segmented 2-button switch: Доска / Среда разработки */}
        <div
          className={`flex items-center p-1 rounded-xl border ${
            isDarkTheme
              ? 'bg-slate-800 border-slate-700'
              : 'bg-slate-100 border-slate-200/80'
          }`}
        >
          <button
            type="button"
            onClick={() => onSelectView('board')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
              activeView === 'board'
                ? isDarkTheme
                  ? 'bg-slate-700 text-white shadow-xs'
                  : 'bg-white text-blue-600 shadow-xs border border-slate-200/60 font-bold'
                : isDarkTheme
                ? 'text-slate-400 hover:text-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layout className="w-3.5 h-3.5" />
            <span>Доска</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectView('ide')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
              activeView === 'ide'
                ? isDarkTheme
                  ? 'bg-blue-600 text-white shadow-xs font-bold'
                  : 'bg-slate-900 text-white shadow-xs font-bold'
                : isDarkTheme
                ? 'text-slate-400 hover:text-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Code2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Среда разработки</span>
          </button>
        </div>

        {/* Synchronized Lesson Timer */}
        <div
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border ${
            isDarkTheme
              ? 'bg-slate-800 border-slate-700 text-slate-200'
              : 'bg-slate-100 border-slate-200 text-slate-800'
          }`}
        >
          <Clock
            className={`w-4 h-4 ${
              isTimerRunning ? 'text-blue-500 animate-pulse' : 'text-slate-400'
            }`}
          />
          <span className="font-mono text-xs font-bold w-12 text-center">
            {formatTime(timerSeconds)}
          </span>

          {/* Tutor: Play/Pause controls with sync & manual duration */}
          {userRole === 'tutor' ? (
            <>
              <button
                onClick={handleToggleTimer}
                title={
                  isTimerRunning
                    ? 'Приостановить таймер урока'
                    : 'Запустить таймер урока для всех'
                }
                className={`p-1 rounded-lg transition cursor-pointer ${
                  isDarkTheme ? 'hover:bg-slate-700' : 'hover:bg-white'
                }`}
              >
                {isTimerRunning ? (
                  <Pause className="w-3.5 h-3.5 text-amber-500" />
                ) : (
                  <Play className="w-3.5 h-3.5 text-emerald-500" />
                )}
              </button>

              {/* Presets & Manual Time Menu */}
              <div className="relative">
                <button
                  onClick={() => setShowTimerMenu(!showTimerMenu)}
                  title="Настройки времени урока"
                  className={`p-1 rounded-lg transition text-[11px] flex items-center cursor-pointer ${
                    isDarkTheme
                      ? 'hover:bg-slate-700 text-slate-400'
                      : 'hover:bg-white text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <ChevronDown className="w-3 h-3" />
                </button>

                {showTimerMenu && (
                  <div
                    className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-slate-200 p-3 z-[100] animate-in fade-in text-slate-800"
                    onMouseLeave={() => setShowTimerMenu(false)}
                  >
                    <div className="text-[10px] font-bold text-slate-500 px-1 mb-1.5 uppercase tracking-wider">
                      Длительность урока
                    </div>

                    {/* Manual Custom Time Input */}
                    <form onSubmit={handleCustomTimeSubmit} className="mb-2.5 flex items-center gap-1.5">
                      <div className="relative flex-1">
                        <input
                          type="number"
                          min="1"
                          max="600"
                          value={customMinutesInput}
                          onChange={(e) => setCustomMinutesInput(e.target.value)}
                          placeholder="Минут"
                          className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-xl px-3 py-1.5 text-xs text-slate-900 outline-none font-bold"
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-medium">
                          мин
                        </span>
                      </div>
                      <button
                        type="submit"
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                      >
                        Задать
                      </button>
                    </form>

                    {/* Quick Preset Buttons */}
                    <div className="space-y-1">
                      {[
                        { label: '30 минут', sec: 30 * 60 },
                        { label: '45 минут (стандарт)', sec: 45 * 60 },
                        { label: '60 минут (1 час)', sec: 60 * 60 },
                        { label: '90 минут (1.5 часа)', sec: 90 * 60 },
                      ].map((item) => (
                        <button
                          key={item.sec}
                          type="button"
                          onClick={() => handleSetTimerDuration(item.sec)}
                          className="w-full text-left px-2.5 py-1.5 text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-700 rounded-xl font-medium transition cursor-pointer"
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>

                    <div className="border-t border-slate-100 my-1.5" />
                    <button
                      type="button"
                      onClick={handleResetTimer}
                      className="w-full text-left px-2.5 py-1.5 text-xs text-rose-600 hover:bg-rose-50 rounded-xl transition flex items-center gap-1.5 font-medium cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Сбросить таймер
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <span className="text-[10px] font-medium opacity-70 pl-1">
              {isTimerRunning ? 'Урок идет' : 'Пауза'}
            </span>
          )}
        </div>
      </div>

      {/* Right: Tools, Settings, Tutor Controls & Actions */}
      <div className="flex items-center gap-2">
        {/* Tutor: View all users and board access */}
        {userRole === 'tutor' && (
          <>
            <button
              onClick={() => setShowInviteCodeModal(true)}
              title="Создать одноразовый ключ доступа для ученика"
              className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                isDarkTheme
                  ? 'bg-amber-950/50 border-amber-800/80 text-amber-300 hover:bg-amber-900/60'
                  : 'bg-amber-50 border-amber-200 text-amber-900 hover:bg-amber-100'
              }`}
            >
              <KeyRound className="w-4 h-4 text-amber-500" />
              <span className="hidden xl:inline">Одноразовый ключ</span>
            </button>

            <button
              onClick={() => setShowUsersModal(true)}
              title="Список всех пользователей и управление доступом к доскам"
              className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                isDarkTheme
                  ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <UserCheck className="w-4 h-4 text-blue-500" />
              <span className="hidden xl:inline">Пользователи</span>
            </button>
          </>
        )}

        {/* Settings button */}
        <button
          onClick={onOpenSettings}
          title="Настройки горячих клавиш инструментов"
          className={`p-2 rounded-xl border transition cursor-pointer ${
            isDarkTheme
              ? 'border-slate-700 hover:bg-slate-800 text-slate-300'
              : 'border-slate-200 hover:bg-slate-50 text-slate-700'
          }`}
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* Tutor Only Superpowers */}
        {userRole === 'tutor' && (
          <div
            className={`flex items-center gap-1 p-1 rounded-xl border ${
              isDarkTheme
                ? 'bg-amber-950/40 border-amber-800/60'
                : 'bg-amber-50 border-amber-200'
            }`}
          >
            {/* Lock/Unlock drawing */}
            <button
              onClick={handleToggleLock}
              title={
                isLocked
                  ? 'Разблокировать доску для учеников'
                  : 'Заблокировать доску (Только преподаватель)'
              }
              className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer ${
                isLocked
                  ? 'bg-amber-500 text-white shadow-xs'
                  : isDarkTheme
                  ? 'text-amber-300 hover:bg-amber-900/50'
                  : 'text-amber-900 hover:bg-amber-100'
              }`}
            >
              {isLocked ? (
                <Lock className="w-3.5 h-3.5" />
              ) : (
                <Unlock className="w-3.5 h-3.5" />
              )}
              <span className="hidden lg:inline">
                {isLocked ? 'Доска закрыта' : 'Доска открыта'}
              </span>
            </button>

            {/* Praise Student Confetti */}
            <button
              onClick={handleCheerStudent}
              title="Похвалить ученика! (Салют и звезды на экране)"
              className={`p-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1 cursor-pointer ${
                isDarkTheme
                  ? 'text-amber-300 hover:bg-amber-900/50'
                  : 'text-amber-900 hover:bg-amber-200/70'
              }`}
            >
              <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
              <span className="hidden lg:inline">Похвалить</span>
            </button>

            {/* Attention Ping */}
            <button
              onClick={handleAttentionPing}
              title="Привлечь внимание ученика к доске"
              className={`p-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1 cursor-pointer ${
                isDarkTheme
                  ? 'text-amber-300 hover:bg-amber-900/50'
                  : 'text-amber-900 hover:bg-amber-200/70'
              }`}
            >
              <Bell className="w-3.5 h-3.5 text-amber-500" />
            </button>
          </div>
        )}

        {/* Participants drawer toggle */}
        <button
          onClick={onToggleParticipants}
          title="Список участников занятия"
          className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
            isDarkTheme
              ? 'border-slate-700 hover:bg-slate-800 text-slate-200'
              : 'border-slate-200 hover:bg-slate-50 text-slate-700'
          }`}
        >
          <Users className="w-4 h-4 text-blue-500" />
          <span>{participantCount}</span>
        </button>

        {/* Chat drawer toggle */}
        <button
          onClick={onToggleChat}
          title="Чат занятия"
          className={`relative p-2 rounded-xl border transition cursor-pointer ${
            isDarkTheme
              ? 'border-slate-700 hover:bg-slate-800 text-slate-200'
              : 'border-slate-200 hover:bg-slate-50 text-slate-700'
          }`}
        >
          <MessageSquare className="w-4 h-4 text-blue-500" />
          {unreadChatCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center animate-bounce">
              {unreadChatCount}
            </span>
          )}
        </button>

        {/* User Profile Avatar with Click-to-Change */}
        {onOpenAvatarPicker && (
          <button
            onClick={onOpenAvatarPicker}
            title={`${userName} (Нажмите, чтобы изменить имя, аватарку и цвет)`}
            className="flex items-center gap-1.5 p-1 rounded-xl transition cursor-pointer hover:opacity-90"
          >
            <UserAvatar
              avatar={userAvatar}
              name={userName}
              color={userColor}
              size="sm"
              className="shadow-2xs hover:scale-105 transition"
            />
          </button>
        )}

        {/* Leave room */}
        <button
          onClick={onLeaveRoom}
          title="Выйти из комнаты"
          className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>

      {/* Share Modal Dialog */}
      {showShareModal &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] animate-in fade-in overflow-y-auto">
            <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 max-w-md w-full animate-in zoom-in-95 text-slate-800 my-auto">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 bg-blue-50 text-blue-600 rounded-2xl">
                    <Share2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Пригласить на урок</h3>
                    <p className="text-xs text-slate-500">Отправьте ученику код или прямую ссылку</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowShareModal(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 flex items-center justify-center transition cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                {/* Code Box */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Код комнаты:
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-slate-100 border border-slate-300 rounded-2xl px-4 py-2.5 font-mono text-lg font-bold text-blue-700 tracking-wider text-center select-all">
                      {roomId}
                    </div>
                    <button
                      onClick={copyRoomCode}
                      className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-xs transition flex items-center gap-1.5 shadow-md shadow-blue-600/30 cursor-pointer"
                    >
                      {copiedCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      {copiedCode ? 'Скопировано' : 'Копировать'}
                    </button>
                  </div>
                </div>

                {/* Direct Link Box */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Прямая ссылка для входа:
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={`${window.location.origin}?room=${roomId}`}
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs text-slate-700 select-all font-mono"
                    />
                    <button
                      onClick={copyDirectLink}
                      className="px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold text-xs transition flex items-center gap-1 shadow-sm cursor-pointer"
                    >
                      {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      Ссылка
                    </button>
                  </div>
                </div>

                {/* Step by Step Tip */}
                <div className="bg-slate-50 rounded-2xl p-3.5 text-xs text-slate-600 space-y-1 border border-slate-200">
                  <p className="font-bold text-slate-800">Как ученику подключиться:</p>
                  <p>1. Открыть ссылку или сайт и войти в свой аккаунт ученика.</p>
                  <p>
                    2. Ввести код <strong className="text-blue-600 font-mono font-bold">{roomId}</strong>.
                  </p>
                  <p>3. Включить микрофон и рисовать вместе на доске!</p>
                </div>

                <button
                  onClick={() => setShowShareModal(false)}
                  className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-2xl text-xs transition cursor-pointer"
                >
                  Закрыть
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Users List Modal for Tutors */}
      <UsersListModal isOpen={showUsersModal} onClose={() => setShowUsersModal(false)} />

      {/* Invite Code Generator Modal for Tutors */}
      <InviteCodeModal
        isOpen={showInviteCodeModal}
        onClose={() => setShowInviteCodeModal(false)}
        roomId={roomId}
        roomTitle={roomTitle}
        subject={subject}
        userName={userName}
      />
    </header>
  );
};
