import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { InviteCodeRecord } from '../../types';
import { KeyRound, Copy, Check, Plus, RefreshCw, X, ShieldCheck, UserCheck, Clock } from 'lucide-react';

interface InviteCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  roomTitle: string;
  subject: string;
  userName: string;
}

export const InviteCodeModal: React.FC<InviteCodeModalProps> = ({
  isOpen,
  onClose,
  roomId,
  roomTitle,
  subject,
  userName,
}) => {
  const [codes, setCodes] = useState<InviteCodeRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [latestCode, setLatestCode] = useState<InviteCodeRecord | null>(null);

  const fetchCodes = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/invite-codes`);
      if (res.ok) {
        const data = await res.json();
        setCodes(data.inviteCodes || []);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      fetchCodes();
    }
  }, [isOpen, roomId]);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/invite-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          createdBy: userName || 'tutor',
          roomTitle,
          subject,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.inviteCode) {
          setLatestCode(data.inviteCode);
          setCodes((prev) => [data.inviteCode, ...prev]);
        }
      }
    } catch {}
    setGenerating(false);
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleCopyLink = (code: string) => {
    const url = `${window.location.origin}?invite=${code}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(code);
    setTimeout(() => setCopiedLink(null), 2000);
  };

  const formatDate = (ts: number) => {
    if (!ts) return '—';
    return new Date(ts).toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      day: 'numeric',
      month: 'short',
    });
  };

  return createPortal(
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] animate-in fade-in overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in zoom-in-95 my-auto flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-amber-50 to-blue-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Одноразовый ключ доступа</h3>
              <p className="text-xs text-slate-500">Доска: {roomTitle} ({roomId})</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4">
          <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-3.5 text-xs text-amber-900 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Как работает одноразовый ключ:</p>
              <p className="mt-0.5 text-amber-800">
                Ученик вводит ключ один раз и попадает на доску. После активации ключ сгорает (никто другой войти по нему не сможет), но доска навсегда сохраняется в личном кабинете ученика.
              </p>
            </div>
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="w-full py-3 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold text-xs rounded-2xl shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition cursor-pointer active:scale-[0.99]"
          >
            {generating ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            <span>Создать новый одноразовый ключ</span>
          </button>

          {/* Latest Generated Code Highlight */}
          {latestCode && (
            <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-xl border border-slate-800 space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">
                  Новый сгенерированный ключ
                </span>
                <span className="text-[10px] text-slate-400">Готов к отправке ученику</span>
              </div>
              <div className="bg-slate-800 p-3 rounded-xl flex items-center justify-between border border-slate-700">
                <span className="text-xl font-black font-mono tracking-widest text-amber-300">
                  {latestCode.code}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleCopyCode(latestCode.code)}
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1.5 transition cursor-pointer"
                  >
                    {copiedCode === latestCode.code ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-950" />
                        Скопировано
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        Ключ
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => handleCopyLink(latestCode.code)}
                    className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg text-xs flex items-center gap-1.5 transition cursor-pointer"
                  >
                    {copiedLink === latestCode.code ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        Ссылка скопирована
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        Ссылка
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* History of Generated Codes */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <span>Сгенерированные ключи для этой доски ({codes.length})</span>
              <button
                onClick={fetchCodes}
                className="text-slate-400 hover:text-slate-700 transition flex items-center gap-1 text-[11px] font-normal"
              >
                <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                Обновить
              </button>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-thin pr-1">
              {codes.length === 0 && !loading && (
                <div className="py-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-2xl">
                  Ключи еще не создавались. Нажмите кнопку выше, чтобы создать.
                </div>
              )}

              {codes.map((c) => (
                <div
                  key={c.code}
                  className={`p-3 rounded-2xl border flex items-center justify-between gap-3 text-xs transition ${
                    c.used
                      ? 'bg-slate-50 border-slate-200 opacity-70'
                      : 'bg-amber-50/50 border-amber-200'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-900 tracking-wider">
                        {c.code}
                      </span>
                      {c.used ? (
                        <span className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded-full text-[10px] font-semibold flex items-center gap-1">
                          <UserCheck className="w-3 h-3 text-slate-600" />
                          Активирован ({c.usedByName || c.usedBy})
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-bold">
                          ✓ Свободен (1 вход)
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Создан: {formatDate(c.createdAt)}
                    </div>
                  </div>

                  {!c.used && (
                    <button
                      onClick={() => handleCopyCode(c.code)}
                      title="Скопировать ключ"
                      className="p-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-700 transition cursor-pointer shrink-0"
                    >
                      {copiedCode === c.code ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>Ученик активирует ключ на странице входа</span>
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
