import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { UserRole } from '../../types';
import { Users, X, Shield, Calendar, BookOpen, RefreshCw, Search } from 'lucide-react';
import { UserAvatar } from '../Common/UserAvatar';

interface UserListItem {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  avatar: string;
  createdAt: number;
  boardsCount: number;
}

interface UsersListModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UsersListModal: React.FC<UsersListModalProps> = ({ isOpen, onClose }) => {
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/users');
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
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 my-auto">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-600/20">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Пользователи платформы</h3>
              <p className="text-xs text-slate-500">Список всех зарегистрированных преподавателей и учеников</p>
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
              placeholder="Поиск по имени или логину..."
              className="w-full bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 focus:border-blue-500 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-900 placeholder-slate-400 outline-none transition"
            />
          </div>
        </div>

        {/* Content List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-thin">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl font-medium">
              {error}
            </div>
          )}

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

          {filteredUsers.map((u) => (
            <div
              key={u.id}
              className="p-3 bg-slate-50/70 hover:bg-blue-50/50 border border-slate-200/80 hover:border-blue-300 rounded-2xl transition flex items-center justify-between gap-3 text-xs"
            >
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
                  </div>
                  <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      Регистрация: {formatDate(u.createdAt)}
                    </span>
                    {u.boardsCount > 0 && (
                      <span className="flex items-center gap-1">
                        • <BookOpen className="w-3 h-3 text-slate-400" />
                        Уроков: {u.boardsCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="shrink-0">
                <span
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold flex items-center gap-1 ${
                    u.role === 'tutor'
                      ? 'bg-amber-50 text-amber-800 border border-amber-200/90'
                      : 'bg-emerald-50 text-emerald-800 border border-emerald-200/90'
                  }`}
                >
                  {u.role === 'tutor' ? '👨‍🏫 Преподаватель' : '🎓 Ученик'}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs text-slate-500">
          <span>Всего зарегистрировано: {users.length}</span>
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
