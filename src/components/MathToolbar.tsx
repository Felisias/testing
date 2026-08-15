import React, { useState } from 'react';
import { MATH_SYMBOL_GROUPS } from '../data/mathSymbols';
import { Sigma, X, ChevronRight, Copy, Check } from 'lucide-react';

interface MathToolbarProps {
  onInsertSymbol: (symbol: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export const MathToolbar: React.FC<MathToolbarProps> = ({
  onInsertSymbol,
  isOpen,
  onToggle,
}) => {
  const [activeCategory, setActiveCategory] = useState(0);
  const [copiedChar, setCopiedChar] = useState<string | null>(null);

  const handleSymbolClick = (item: { char: string; insertText?: string }) => {
    const textToInsert = item.insertText || item.char;
    onInsertSymbol(textToInsert);

    // Show quick copied feedback
    setCopiedChar(item.char);
    setTimeout(() => setCopiedChar(null), 1200);
  };

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        title="Формулы и мат. символы (π, √, ², ∑...)"
        className="bg-white/95 backdrop-blur shadow-md hover:shadow-lg border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-blue-700 flex items-center gap-1.5 transition hover:bg-blue-50"
      >
        <Sigma className="w-4 h-4 text-blue-600" />
        <span className="hidden sm:inline">Символы & Формулы</span>
      </button>
    );
  }

  return (
    <div
      id="math-symbol-panel"
      className="bg-white/95 backdrop-blur-md shadow-2xl border border-slate-200 rounded-2xl p-3 w-80 sm:w-96 z-40 animate-in fade-in"
    >
      <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2.5">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
          <Sigma className="w-4 h-4 text-blue-600" />
          <span>Математические и научные символы</span>
        </div>
        <button
          onClick={onToggle}
          className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-lg transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1.5 mb-2 scrollbar-none">
        {MATH_SYMBOL_GROUPS.map((group, idx) => (
          <button
            key={group.category}
            onClick={() => setActiveCategory(idx)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition ${
              activeCategory === idx
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {group.category}
          </button>
        ))}
      </div>

      {/* Symbol Grid */}
      <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5 max-h-48 overflow-y-auto p-0.5">
        {MATH_SYMBOL_GROUPS[activeCategory].symbols.map((sym) => {
          const isCopied = copiedChar === sym.char;
          return (
            <button
              key={sym.char}
              onClick={() => handleSymbolClick(sym)}
              title={`${sym.label} (Нажмите для вставки)`}
              className={`h-10 rounded-xl flex flex-col items-center justify-center border transition relative group ${
                isCopied
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                  : 'bg-slate-50 hover:bg-blue-50 border-slate-200 hover:border-blue-300 text-slate-800'
              }`}
            >
              <span className="text-base font-serif font-bold leading-none">{sym.char}</span>
              <span className="text-[9px] text-slate-600 truncate max-w-[50px] scale-90">
                {isCopied ? 'Вставлено' : sym.label}
              </span>
            </button>
          );
        })}
      </div>

      <div className="pt-2 mt-2 border-t border-slate-100 text-[10px] text-slate-600 flex items-center justify-between">
        <span>💡 Кликните по символу для быстрой вставки в текст или копирования</span>
      </div>
    </div>
  );
};
