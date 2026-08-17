import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { UserRole, SavedBoard, UserWithBoards } from '../../types';
import {
  Users,
  X,
  Shield,
  Calendar,
  BookOpen,
  RefreshCw,
  Search,
  Trash2,
  Lock,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { UserAvatar } from '../Common/UserAvatar';

interface UsersListModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UsersListModal: React.FC<UsersListModalProps> = ({ isOpen, onClose }) => {
  const [users, setUsers] = useState<UserWithBoards[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [expandedUsernames, setExpandedUsernames] = useState<Record<string, boolean>>({});
  const [revokingBoard, setRevokingBoard] = useState<{ username: string; roomId: string; boardTitle: string } | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/users-with-boards');
      if (!res.ok) throw new Error('Не удалось загрузить список пользователей');
      const data = await res.json();
      setUsers(data.users || []);
    } catch (err: any) {
      setError(err.message || 'Ошибка сети');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleExpand = (username: string) => {
    setExpandedUsernames((prev) => ({ ...prev, [username]: !prev[username] }));
  };

  const handleRevokeAccess = async (username: string, roomId: string, boardTitle: string) => {
    try {
      const res = await fetch('/api/users/revoke-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, roomId }),
      });
      if (!res.ok) throw new Error('Не удалось отозвать доступ');
      const data = await res.json();

      setUsers((prev) =>
        prev.map((u) => {
          if (u.username === username) {
            return { ...u, savedBoards: data.savedBoards || [] };
          }
          return u;
        })
      );

      setSuccessMsg(`Доступ к доске "${boardTitle}" для пользователя @${username} успешно отозван`);
      setTimeout(() => setSuccessMsg(null), 4000);
      setRevokingBoard(null);
    } catch (err: any) {
      setError(err.message || 'Ошибка отзыва доступа');
      setTimeout(() => setError(null), 4000);
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.username.toLowerCase().includes(search.toLowerCase())
  );

  const formatDate = (ts: number) => {
    if (!ts) return '—';
    return new Date(ts).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] animate-in fade-in overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[88vh] flex flex-col overflow-hidden animate-in zoom-in-95 my-auto">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-600/20">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Управление пользователями и доступом</h3>
              <p className="text-xs text-slate-500">Просмотр доступных досок и управление правами учеников</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchUsers}
              disabled={loading}
              title="Обновить список"
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 flex items-center justify-center transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-slate-100 bg-white">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по имени или логину ученика..."
              className="w-full bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 focus:border-blue-500 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-900 placeholder-slate-400 outline-none transition"
            />
          </div>
        </div>

        {/* Alerts */}
        {successMsg && (
          <div className="mx-4 mt-3 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl font-medium flex items-center gap-2 animate-in fade-in">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {error && (
          <div className="mx-4 mt-3 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl font-medium flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Content List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
          {loading && users.length === 0 && (
            <div className="py-12 text-center text-xs text-slate-400">
              Загрузка списка пользователей...
            </div>
          )}

          {!loading && filteredUsers.length === 0 && (
            <div className="py-12 text-center text-xs text-slate-400">
              Пользователи не найдены
            </div>
          )}

          {filteredUsers.map((u) => {
            const isExpanded = !!expandedUsernames[u.username];
            const boards = u.savedBoards || [];

            return (
              <div
                key={u.id}
                className="bg-slate-50/70 border border-slate-200 rounded-2xl transition overflow-hidden"
              >
                {/* User Row */}
                <div className="p-3.5 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3 min-w-0">
                    <UserAvatar
                      avatar={u.avatar}
                      name={u.name}
                      color={u.role === 'tutor' ? '#D97706' : '#2563EB'}
                      size="md"
                      className="shrink-0 ring-1 ring-slate-200"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 truncate">{u.name}</span>
                        <span className="text-[11px] text-slate-500 font-mono">@{u.username}</span>
                        <span
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold ${
                            u.role === 'tutor'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {u.role === 'tutor' ? 'Преподаватель' : 'Ученик'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          Регистрация: {formatDate(u.createdAt)}
                        </span>
                        <span className="flex items-center gap-1">
                          • <BookOpen className="w-3 h-3 text-slate-400" />
                          Доступно досок: <strong>{boards.length}</strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {boards.length > 0 ? (
                      <button
                        onClick={() => toggleExpand(u.username)}
                        className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                      >
                        <span>Доски ({boards.length})</span>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    ) : (
                      <span className="text-[11px] text-slate-400 italic px-2">Нет досок</span>
                    )}
                  </div>
                </div>

                {/* Expanded Boards Access List */}
                {isExpanded && boards.length > 0 && (
                  <div className="p-3 bg-white border-t border-slate-200 space-y-2">
                    <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider px-1">
                      Доски, к которым у пользователя есть доступ:
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {boards.map((b) => (
                        <div
                          key={b.id}
                          className="p-2.5 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900 truncate">
                              {b.title}
                            </div>
                            <div className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                              <span className="font-mono bg-slate-200 px-1 py-0.2 rounded text-[9px] font-bold">
                                {b.id}
                              </span>
                              <span>• {b.subject}</span>
                            </div>
                          </div>

                          <button
                            onClick={() =>
                              setRevokingBoard({
                                username: u.username,
                                roomId: b.id,
                                boardTitle: b.title,
                              })
                            }
                            title="Отозвать доступ к этой доске"
                            className="p-1.5 text-rose-500 hover:text-white hover:bg-rose-600 border border-rose-200 hover:border-rose-600 rounded-lg transition cursor-pointer shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Revoke Confirmation Modal / Overlay */}
        {revokingBoard && (
          <div className="p-4 bg-rose-50 border-t border-rose-200 animate-in slide-in-from-bottom-2 text-xs space-y-2">
            <div className="flex items-center gap-2 text-rose-900 font-bold text-sm">
              <AlertCircle className="w-4 h-4 text-rose-600" />
              <span>Отозвать доступ к доске?</span>
            </div>
            <p className="text-slate-700">
              Вы действительно хотите отозвать доступ к доске <strong>«{revokingBoard.boardTitle}»</strong> ({revokingBoard.roomId}) у пользователя <strong>@{revokingBoard.username}</strong>?
            </p>
            <p className="text-[11px] text-slate-500">
              Пользователь больше не сможет зайти на эту доску, и если он сейчас на ней находится, то будет автоматически отключен.
            </p>
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() =>
                  handleRevokeAccess(
                    revokingBoard.username,
                    revokingBoard.roomId,
                    revokingBoard.boardTitle
                  )
                }
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs transition cursor-pointer"
              >
                Да, отозвать доступ
              </button>
              <button
                onClick={() => setRevokingBoard(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-semibold text-xs transition cursor-pointer"
              >
                Отмена
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs text-slate-500">
          <span>Всего пользователей: {users.length}</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs transition cursor-pointer"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

