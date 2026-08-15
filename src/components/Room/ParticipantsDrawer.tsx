import React from 'react';
import { Participant, UserRole } from '../../types';
import { getSocket } from '../../services/socket';
import {
  Users,
  X,
  Mic,
  MicOff,
  GraduationCap,
  Sparkles,
  Star,
  Bell,
  Crown,
} from 'lucide-react';

interface ParticipantsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  participants: Record<string, Participant>;
  currentUserId: string;
  userRole: UserRole;
}

export const ParticipantsDrawer: React.FC<ParticipantsDrawerProps> = ({
  isOpen,
  onClose,
  participants,
  currentUserId,
  userRole,
}) => {
  if (!isOpen) return null;

  const list = Object.values(participants) as Participant[];

  const handlePraise = (studentName: string) => {
    getSocket().emit('tutor:cheer', {
      message: `Превосходно решено, ${studentName}! Отличный результат! 🌟`,
    });
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
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-white shadow-xs shrink-0 relative"
                  style={{ backgroundColor: p.color || '#3B82F6' }}
                >
                  {p.name.charAt(0).toUpperCase()}
                  {p.role === 'tutor' && (
                    <span className="absolute -top-1 -right-1 bg-amber-400 text-amber-950 p-0.5 rounded-full ring-1 ring-white">
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
                  <div className="p-1.5 bg-rose-50 text-rose-500 rounded-lg">
                    <MicOff className="w-3.5 h-3.5" />
                  </div>
                ) : (
                  <div
                    className={`p-1.5 rounded-lg ${
                      isSpeaking ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200/70 text-slate-600'
                    }`}
                  >
                    <Mic className="w-3.5 h-3.5" />
                  </div>
                )}

                {/* Tutor praise action for student */}
                {userRole === 'tutor' && p.role === 'student' && (
                  <button
                    onClick={() => handlePraise(p.name)}
                    title={`Похвалить ${p.name}`}
                    className="p-1.5 hover:bg-amber-100 text-amber-600 rounded-lg transition"
                  >
                    <Star className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-3 border-t border-slate-200 bg-slate-50 text-[11px] text-slate-600">
        <span>💡 Все участники слышат друг друга и синхронно видят доску в реальном времени.</span>
      </div>
    </aside>
  );
};
