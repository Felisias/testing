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
      className={`relative z-50 h-13 px-4 flex items-center justify-between gap-4 select-none transition-colors duration-200 border-b shrink-0 ${
        isDarkTheme
          ? 'bg-slate-950/95 backdrop-blur-md border-slate-800 text-slate-100'
          : 'bg-white/95 backdrop-blur-md border-slate-200/90 text-slate-900'
      }`}
    >
      {/* Left: Brand Identity & Document Context */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center shadow-xs transition-colors shrink-0">
            <GraduationCap className="w-4.5 h-4.5" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h1
                className={`text-[13px] font-semibold tracking-tight leading-tight truncate max-w-[160px] sm:max-w-[240px] md:max-w-[320px] ${
                  isDarkTheme ? 'text-slate-100' : 'text-slate-900'
                }`}
              >
                {roomTitle}
              </h1>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            </div>
            {subject && (
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-normal truncate max-w-[200px] leading-tight">
                {subject}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Middle: Minimalist Segmented View Switch + Compact Sync Timer */}
      <div className="flex items-center gap-2.5 shrink-0">
        {/* Modern Segmented View Switch (Board vs IDE) */}
        <div
          className={`flex items-center p-0.5 rounded-xl border ${
            isDarkTheme
              ? 'bg-slate-900 border-slate-800'
              : 'bg-slate-100/90 border-slate-200/80'
          }`}
        >
          <button
            type="button"
            onClick={() => onSelectView('board')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 cursor-pointer ${
              activeView === 'board'
                ? isDarkTheme
                  ? 'bg-slate-800 text-white shadow-xs font-semibold'
                  : 'bg-white text-indigo-600 shadow-xs border border-slate-200/60 font-semibold'
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
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 cursor-pointer ${
              activeView === 'ide'
                ? isDarkTheme
                  ? 'bg-indigo-600 text-white shadow-xs font-semibold'
                  : 'bg-slate-900 text-white shadow-xs font-semibold'
                : isDarkTheme
                ? 'text-slate-400 hover:text-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Code2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Среда разработки</span>
          </button>
        </div>

        {/* Unified Minimalist Lesson Timer */}
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border ${
            isDarkTheme
              ? 'bg-slate-900 border-slate-800 text-slate-200'
              : 'bg-slate-100/80 border-slate-200/90 text-slate-800'
          }`}
        >
          <Clock
            className={`w-3.5 h-3.5 ${
              isTimerRunning ? 'text-indigo-500 animate-pulse' : 'text-slate-400'
            }`}
          />
          <span className="font-mono text-xs font-semibold w-11 text-center tracking-tight">
            {formatTime(timerSeconds)}
          </span>

          {/* Tutor Controls */}
          {userRole === 'tutor' ? (
            <>
              <button
                onClick={handleToggleTimer}
                title={
                  isTimerRunning
                    ? 'Приостановить таймер урока'
                    : 'Запустить таймер урока для всех'
                }
                className={`p-1 rounded-md transition cursor-pointer ${
                  isDarkTheme ? 'hover:bg-slate-800' : 'hover:bg-white text-slate-600 hover:text-slate-900'
                }`}
              >
                {isTimerRunning ? (
                  <Pause className="w-3 h-3 text-amber-500" />
                ) : (
                  <Play className="w-3 h-3 text-emerald-500" />
                )}
              </button>

              {/* Timer Menu Popover */}
              <div className="relative">
                <button
                  onClick={() => setShowTimerMenu(!showTimerMenu)}
                  title="Настройки времени урока"
                  className={`p-1 rounded-md transition text-[11px] flex items-center cursor-pointer ${
                    isDarkTheme
                      ? 'hover:bg-slate-800 text-slate-400'
                      : 'hover:bg-white text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <ChevronDown className="w-3 h-3" />
                </button>

                {showTimerMenu && (
                  <div
                    className="absolute right-0 top-full mt-2 w-64 bg-white/98 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200 p-3.5 z-[600] animate-in fade-in text-slate-800 filter drop-shadow-xl"
                    onMouseLeave={() => setShowTimerMenu(false)}
                  >
                    <div className="text-[10px] font-bold text-slate-400 px-1 mb-2 uppercase tracking-wider">
                      Длительность занятия
                    </div>

                    <form onSubmit={handleCustomTimeSubmit} className="mb-2.5 flex items-center gap-1.5">
                      <div className="relative flex-1">
                        <input
                          type="number"
                          min="1"
                          max="600"
                          value={customMinutesInput}
                          onChange={(e) => setCustomMinutesInput(e.target.value)}
                          placeholder="Минут"
                          className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-1.5 text-xs text-slate-900 outline-none font-semibold"
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-medium">
                          мин
                        </span>
                      </div>
                      <button
                        type="submit"
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition shadow-xs cursor-pointer"
                      >
                        Задать
                      </button>
                    </form>

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
                          className="w-full text-left px-2.5 py-1.5 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 rounded-xl font-medium transition cursor-pointer"
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>

                    <div className="border-t border-slate-100 my-2" />
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
            <span className="text-[10px] font-medium text-slate-400 pl-0.5">
              {isTimerRunning ? 'Идет' : 'Пауза'}
            </span>
          )}
        </div>
      </div>

      {/* Right: Unified Action Controls */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Tutor Controls Group */}
        {userRole === 'tutor' && (
          <div className="flex items-center gap-1">
            {/* Quick action buttons in unified toolbar */}
            <div
              className={`flex items-center gap-0.5 p-0.5 rounded-xl border ${
                isDarkTheme
                  ? 'bg-slate-900 border-slate-800'
                  : 'bg-slate-100/90 border-slate-200/80'
              }`}
            >
              {/* Lock/Unlock Drawing */}
              <button
                onClick={handleToggleLock}
                title={isLocked ? 'Разблокировать доску для всех' : 'Заблокировать доску (только преподаватель)'}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition cursor-pointer ${
                  isLocked
                    ? 'bg-amber-500 text-white shadow-xs font-semibold'
                    : isDarkTheme
                    ? 'text-slate-300 hover:text-white hover:bg-slate-800'
                    : 'text-slate-700 hover:text-slate-900 hover:bg-white'
                }`}
              >
                {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5 text-slate-500" />}
                <span className="hidden lg:inline">{isLocked ? 'Закрыта' : 'Открыта'}</span>
              </button>

              {/* Praise Confetti */}
              <button
                onClick={handleCheerStudent}
                title="Похвалить ученика! (Салют и звезды)"
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  isDarkTheme
                    ? 'text-slate-300 hover:text-amber-300 hover:bg-slate-800'
                    : 'text-slate-600 hover:text-amber-600 hover:bg-white'
                }`}
              >
                <Star className="w-3.5 h-3.5" />
              </button>

              {/* Attention Ping */}
              <button
                onClick={handleAttentionPing}
                title="Привлечь внимание к доске"
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  isDarkTheme
                    ? 'text-slate-300 hover:text-indigo-300 hover:bg-slate-800'
                    : 'text-slate-600 hover:text-indigo-600 hover:bg-white'
                }`}
              >
                <Bell className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Invite Key & Users Modals */}
            <button
              onClick={() => setShowInviteCodeModal(true)}
              title="Создать одноразовый ключ доступа для ученика"
              className={`h-8 px-2.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition cursor-pointer ${
                isDarkTheme
                  ? 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-2xs'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5 text-indigo-500" />
              <span className="hidden xl:inline">Ключ</span>
            </button>

            <button
              onClick={() => setShowUsersModal(true)}
              title="Список всех пользователей и доступ к доскам"
              className={`h-8 px-2.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition cursor-pointer ${
                isDarkTheme
                  ? 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-2xs'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5 text-indigo-500" />
              <span className="hidden xl:inline">Доступ</span>
            </button>
          </div>
        )}

        {/* Subtle Divider */}
        <div className={`h-5 w-px mx-0.5 shrink-0 ${isDarkTheme ? 'bg-slate-800' : 'bg-slate-200'}`} />

        {/* Participants drawer toggle */}
        <button
          onClick={onToggleParticipants}
          title="Список участников занятия"
          className={`h-8 px-2.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition cursor-pointer ${
            isDarkTheme
              ? 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'
              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-2xs'
          }`}
        >
          <Users className="w-3.5 h-3.5 text-indigo-500" />
          <span className="font-semibold">{participantCount}</span>
        </button>

        {/* Chat drawer toggle */}
        <button
          onClick={onToggleChat}
          title="Чат занятия"
          className={`relative h-8 w-8 rounded-xl border flex items-center justify-center transition cursor-pointer ${
            isDarkTheme
              ? 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'
              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-2xs'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5 text-indigo-500" />
          {unreadChatCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white rounded-full text-[9px] font-bold flex items-center justify-center shadow-xs">
              {unreadChatCount}
            </span>
          )}
        </button>

        {/* Settings button */}
        <button
          onClick={onOpenSettings}
          title="Настройки горячих клавиш и панели инструментов"
          className={`h-8 w-8 rounded-xl border flex items-center justify-center transition cursor-pointer ${
            isDarkTheme
              ? 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'
              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-2xs'
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
        </button>

        {/* Subtle Divider */}
        <div className={`h-5 w-px mx-0.5 shrink-0 ${isDarkTheme ? 'bg-slate-800' : 'bg-slate-200'}`} />

        {/* User Profile Pill */}
        {onOpenAvatarPicker && (
          <button
            onClick={onOpenAvatarPicker}
            title={`${userName} (${userRole === 'tutor' ? 'Преподаватель' : 'Ученик'}). Нажмите для изменения профиля`}
            className={`h-8 pl-1 pr-2.5 rounded-xl border flex items-center gap-1.5 transition cursor-pointer ${
              isDarkTheme
                ? 'bg-slate-900 border-slate-800 hover:bg-slate-850 text-slate-200'
                : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-800 shadow-2xs'
            }`}
          >
            <UserAvatar
              avatar={userAvatar}
              name={userName}
              color={userColor}
              size="sm"
              className="w-6 h-6 rounded-lg text-xs"
            />
            <span className="text-xs font-medium max-w-[80px] sm:max-w-[100px] truncate">
              {userName}
            </span>
          </button>
        )}

        {/* Leave Room Button */}
        <button
          onClick={onLeaveRoom}
          title="Выйти из комнаты"
          className={`h-8 w-8 rounded-xl flex items-center justify-center transition cursor-pointer ${
            isDarkTheme
              ? 'text-slate-400 hover:text-rose-400 hover:bg-rose-950/40'
              : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
          }`}
        >
          <LogOut className="w-3.5 h-3.5" />
        </button>
      </div>

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
