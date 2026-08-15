import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage, UserRole } from '../../types';
import { UserAvatar } from '../Common/UserAvatar';
import { getSocket } from '../../services/socket';
import {
  MessageSquare,
  X,
  Send,
} from 'lucide-react';

interface ChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  currentUserId: string;
  userName: string;
  userRole: UserRole;
  userColor: string;
  userAvatar?: string;
}

export const ChatDrawer: React.FC<ChatDrawerProps> = ({
  isOpen,
  onClose,
  messages,
  currentUserId,
  userName,
  userRole,
  userColor,
  userAvatar = '🎓',
}) => {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    getSocket().emit('chat:send', { text: inputText.trim() });
    setInputText('');
  };

  const handleQuickFormula = (formula: string) => {
    setInputText((prev) => prev + formula);
  };

  if (!isOpen) return null;

  return (
    <aside
      id="chat-drawer-panel"
      aria-label="Чат занятия"
      className="w-80 sm:w-96 bg-white border-l border-slate-200 h-full flex flex-col z-40 shadow-2xl animate-in slide-in-from-right duration-200"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-blue-600" />
          <h3 className="text-sm font-bold text-slate-800">Чат занятия</h3>
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">
            {messages.length}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60 transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3">
        {messages.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-xs">
            Сообщений пока нет. Напишите вопрос или заметку к уроку!
          </div>
        ) : (
          messages.map((msg) => {
            const isSystem = msg.userId === 'system';
            const isSelf = msg.userId === currentUserId;

            if (isSystem) {
              return (
                <div
                  key={msg.id}
                  className="text-center py-1 px-3 bg-slate-100/90 text-slate-500 rounded-xl text-[11px] font-medium"
                >
                  {msg.text}
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                className={`flex gap-2 ${isSelf ? 'flex-row-reverse' : 'flex-row'} items-start`}
              >
                {/* User Avatar */}
                <UserAvatar
                  avatar={msg.avatar || (msg.role === 'tutor' ? '👨‍🏫' : '🎓')}
                  name={msg.userName}
                  size="xs"
                  className="mt-0.5 shrink-0 shadow-2xs"
                />

                <div className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'} max-w-[80%]`}>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[11px] font-bold text-slate-700">
                      {msg.userName} {isSelf && '(Вы)'}
                    </span>
                    <span
                      className={`text-[9px] px-1.5 py-0.2 rounded font-semibold ${
                        msg.role === 'tutor'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {msg.role === 'tutor' ? 'Репетитор' : 'Ученик'}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <div
                    className={`px-3.5 py-2 rounded-2xl text-xs leading-relaxed ${
                      isSelf
                        ? 'bg-blue-600 text-white rounded-tr-none'
                        : 'bg-slate-100 text-slate-800 rounded-tl-none border border-slate-200'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick math formula chips */}
      <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 flex gap-1 overflow-x-auto text-[11px] scrollbar-none">
        {['x²', '√x', 'π', '±', '≠', '≤', '≥', '∫', 'sin(x)', 'cos(x)', 'lim'].map(
          (formula) => (
            <button
              key={formula}
              onClick={() => handleQuickFormula(` ${formula} `)}
              className="px-2 py-0.5 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded font-serif text-slate-700 hover:text-blue-700 transition shrink-0"
            >
              {formula}
            </button>
          )
        )}
      </div>

      {/* Input Box */}
      <form
        onSubmit={handleSendMessage}
        className="p-3 border-t border-slate-200 bg-white flex items-center gap-2"
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Напишите сообщение..."
          className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={!inputText.trim()}
          className="p-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl shadow-md transition"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </aside>
  );
};
