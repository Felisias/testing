import React, { useState } from 'react';
import { Participant, UserRole } from '../../types';
import { UserAvatar } from '../Common/UserAvatar';
import { getSocket } from '../../services/socket';
import {
  Users,
  X,
  Mic,
  MicOff,
  Star,
  Crown,
  UserX,
} from 'lucide-react';

interface ParticipantsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  participants: Record<string, Participant>;
  currentUserId: string;
  userRole: UserRole;
  onChangeAvatar?: () => void;
}

export const ParticipantsDrawer: React.FC<ParticipantsDrawerProps> = ({
  isOpen,
  onClose,
  participants,
  currentUserId,
  userRole,
  onChangeAvatar,
}) => {
  const [kickConfirmTarget, setKickConfirmTarget] = useState<Participant | null>(null);

  if (!isOpen) return null;

  const list = Object.values(participants) as Participant[];

  const handlePraise = (studentName: string) => {
    getSocket().emit('tutor:cheer', {
      message: `Превосходно решено, ${studentName}! Отличный результат! 🌟`,
    });
  };

  const handleKick = (p: Participant) => {
    getSocket().emit('room:kick:user', {
      targetSocketId: p.id,
      targetName: p.name,
      reason: 'Преподаватель исключил вас из занятия.',
    });
    setKickConfirmTarget(null);
  };

  return (
    <aside
      id="participants-drawer-panel"
      aria-label="Список участников занятия"
      className="w-80 bg-white border-l border-slate-200 h-full flex flex-col z-40 shadow-2xl animate-in slide-in-from-right duration-200"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-blue-600" />
          <h3 className="text-sm font-bold text-slate-800">Участники урока</h3>
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">
            {list.length}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60 transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Participants List */}
      <div className="flex-1 p-3 overflow-y-auto space-y-2">
        {list.map((p) => {
          const isSelf = p.id === currentUserId;
          const isSpeaking = p.isSpeaking && !p.micMuted;

          return (
            <div
              key={p.id}
              className={`p-3 rounded-2xl border transition flex items-center justify-between gap-2 ${
                isSpeaking
                  ? 'bg-emerald-50/60 border-emerald-300 ring-1 ring-emerald-400'
                  : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100/60'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="relative shrink-0">
                  <UserAvatar
                    avatar={p.avatar || (p.role === 'tutor' ? '👨‍🏫' : '🎓')}
                    name={p.name}
                    color={p.color || '#3B82F6'}
                    size="md"
                    className="shadow-2xs"
                  />
                  {p.role === 'tutor' && (
                    <span className="absolute -top-1 -right-1 bg-amber-400 text-amber-950 p-0.5 rounded-full ring-1 ring-white shadow-xs">
                      <Crown className="w-2.5 h-2.5" />
                    </span>
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-800 truncate">
                      {p.name} {isSelf && '(Вы)'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span
                      className={`text-[9px] font-semibold px-1.5 py-0.2 rounded ${
                        p.role === 'tutor'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {p.role === 'tutor' ? 'Преподаватель' : 'Ученик'}
                    </span>
                    {isSpeaking && (
                      <span className="text-[9px] text-emerald-600 font-semibold flex items-center gap-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Говорит
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions & Mic status */}
              <div className="flex items-center gap-1 shrink-0">
                {p.micMuted ? (
                  <div className="p-1.5 bg-rose-50 text-rose-500 rounded-lg" title="Микрофон выключен">
                    <MicOff className="w-3.5 h-3.5" />
                  </div>
                ) : (
                  <div
                    className={`p-1.5 rounded-lg ${
                      isSpeaking ? 'bg-emerald-100 text-emerald-600 animate-pulse' : 'bg-slate-200/70 text-slate-600'
                    }`}
                    title={isSpeaking ? 'Говорит...' : 'Микрофон включен'}
                  >
                    <Mic className="w-3.5 h-3.5" />
                  </div>
                )}

                {/* Tutor praise action for student */}
                {userRole === 'tutor' && p.role === 'student' && (
                  <button
                    onClick={() => handlePraise(p.name)}
                    title={`Похвалить ${p.name}`}
                    className="p-1.5 hover:bg-amber-100 text-amber-600 rounded-lg transition cursor-pointer"
                  >
                    <Star className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Tutor kick action for non-tutor participants */}
                {userRole === 'tutor' && !isSelf && (
                  <button
                    onClick={() => setKickConfirmTarget(p)}
                    title={`Исключить ${p.name} из урока`}
                    className="p-1.5 hover:bg-rose-100 text-rose-500 hover:text-rose-700 rounded-lg transition cursor-pointer"
                  >
                    <UserX className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Kick Confirmation Dialog */}
      {kickConfirmTarget && (
        <div className="p-3 bg-rose-50 border-t border-rose-200 animate-in slide-in-from-bottom-2 text-xs space-y-2">
          <p className="font-bold text-rose-900">
            Исключить {kickConfirmTarget.name} из занятия?
          </p>
          <p className="text-[11px] text-rose-700">
            Пользователь будет отключен от доски и голосового чата.
          </p>
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={() => handleKick(kickConfirmTarget)}
              className="flex-1 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-[11px] transition cursor-pointer"
            >
              Да, исключить
            </button>
            <button
              onClick={() => setKickConfirmTarget(null)}
              className="flex-1 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-semibold text-[11px] transition cursor-pointer"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-[11px] text-slate-600">
        <span>💡 Голосовая связь и доска активны</span>
        {onChangeAvatar && (
          <button
            onClick={onChangeAvatar}
            className="text-blue-600 hover:text-blue-700 font-semibold underline"
          >
            Сменить аватар
          </button>
        )}
      </div>
    </aside>
  );
};
