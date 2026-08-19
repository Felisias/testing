import React, { useEffect, useRef } from 'react';
import { CodeSuggestion, SuggestionType } from './codeSuggestions';
import {
  FunctionSquare,
  Variable,
  KeyRound,
  Box,
  Layers,
  Sparkles,
  Braces,
  Hash,
} from 'lucide-react';

interface AutocompletePopupProps {
  suggestions: CodeSuggestion[];
  selectedIndex: number;
  onSelect: (item: CodeSuggestion) => void;
  position: { top: number; left: number };
  prefix: string;
}

const TYPE_CONFIG: Record<
  SuggestionType,
  { label: string; bg: string; text: string; icon: React.ReactNode }
> = {
  function: {
    label: 'fn',
    bg: 'bg-purple-500/20 border-purple-500/30',
    text: 'text-purple-300',
    icon: <FunctionSquare className="w-3.5 h-3.5 text-purple-400" />,
  },
  method: {
    label: 'method',
    bg: 'bg-indigo-500/20 border-indigo-500/30',
    text: 'text-indigo-300',
    icon: <FunctionSquare className="w-3.5 h-3.5 text-indigo-400" />,
  },
  variable: {
    label: 'var',
    bg: 'bg-emerald-500/20 border-emerald-500/30',
    text: 'text-emerald-300',
    icon: <Variable className="w-3.5 h-3.5 text-emerald-400" />,
  },
  class: {
    label: 'class',
    bg: 'bg-amber-500/20 border-amber-500/30',
    text: 'text-amber-300',
    icon: <Box className="w-3.5 h-3.5 text-amber-400" />,
  },
  keyword: {
    label: 'key',
    bg: 'bg-blue-500/20 border-blue-500/30',
    text: 'text-blue-300',
    icon: <KeyRound className="w-3.5 h-3.5 text-blue-400" />,
  },
  property: {
    label: 'prop',
    bg: 'bg-cyan-500/20 border-cyan-500/30',
    text: 'text-cyan-300',
    icon: <Braces className="w-3.5 h-3.5 text-cyan-400" />,
  },
  type: {
    label: 'type',
    bg: 'bg-rose-500/20 border-rose-500/30',
    text: 'text-rose-300',
    icon: <Hash className="w-3.5 h-3.5 text-rose-400" />,
  },
  snippet: {
    label: 'snippet',
    bg: 'bg-teal-500/20 border-teal-500/30',
    text: 'text-teal-300',
    icon: <Sparkles className="w-3.5 h-3.5 text-teal-400" />,
  },
};

export const AutocompletePopup: React.FC<AutocompletePopupProps> = ({
  suggestions,
  selectedIndex,
  onSelect,
  position,
  prefix,
}) => {
  const activeItemRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Scroll active item into view
  useEffect(() => {
    if (activeItemRef.current && listRef.current) {
      activeItemRef.current.scrollIntoView({
        block: 'nearest',
      });
    }
  }, [selectedIndex]);

  if (suggestions.length === 0) return null;

  const currentItem = suggestions[selectedIndex] || suggestions[0];

  return (
    <div
      id="ide-autocomplete-popup"
      className="absolute z-50 flex flex-col md:flex-row bg-[#111622]/95 backdrop-blur-md border border-slate-700/80 rounded-xl shadow-2xl shadow-black/80 font-sans text-xs overflow-hidden max-w-[540px] pointer-events-auto animate-in fade-in zoom-in-95 duration-100"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
    >
      {/* Suggestions List Column */}
      <div className="w-64 max-h-64 overflow-y-auto flex flex-col p-1 scrollbar-thin divide-y divide-slate-800/40" ref={listRef}>
        {suggestions.map((item, index) => {
          const isSelected = index === selectedIndex;
          const config = TYPE_CONFIG[item.type] || TYPE_CONFIG.variable;

          // Highlight matching prefix in label
          const lowerLabel = item.label.toLowerCase();
          const lowerPrefix = prefix.toLowerCase();
          const matchIndex = lowerLabel.indexOf(lowerPrefix);

          return (
            <div
              key={`${item.label}-${item.type}-${index}`}
              ref={isSelected ? activeItemRef : undefined}
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(item);
              }}
              className={`px-2.5 py-1.5 rounded-lg flex items-center justify-between gap-2 cursor-pointer transition select-none ${
                isSelected
                  ? 'bg-blue-600/90 text-white font-semibold shadow-xs'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2 truncate font-mono text-[12.5px]">
                <div className="shrink-0">{config.icon}</div>
                <span className="truncate">
                  {matchIndex >= 0 ? (
                    <>
                      {item.label.substring(0, matchIndex)}
                      <span className={isSelected ? 'text-amber-300 font-bold underline' : 'text-cyan-300 font-bold'}>
                        {item.label.substring(matchIndex, matchIndex + prefix.length)}
                      </span>
                      {item.label.substring(matchIndex + prefix.length)}
                    </>
                  ) : (
                    item.label
                  )}
                </span>
              </div>

              {/* Type pill */}
              <span
                className={`px-1.5 py-0.5 rounded text-[9.5px] font-mono border shrink-0 ${
                  isSelected ? 'bg-white/20 text-white border-white/30' : `${config.bg} ${config.text}`
                }`}
              >
                {config.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Detail / Documentation Sidebar */}
      {currentItem && (
        <div className="w-56 p-2.5 bg-slate-950/90 border-t md:border-t-0 md:border-l border-slate-800/80 flex flex-col justify-between gap-2 text-[11px] text-slate-400 font-sans">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-xs font-bold text-slate-200 truncate">
                {currentItem.label}
              </span>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                {currentItem.type}
              </span>
            </div>
            {currentItem.detail && (
              <div className="font-mono text-[11px] text-emerald-400 bg-slate-900/90 p-1.5 rounded-md border border-slate-800 break-all leading-tight">
                {currentItem.detail}
              </div>
            )}
            {currentItem.documentation && (
              <p className="text-[10px] text-slate-400 leading-normal">
                {currentItem.documentation}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between text-[9px] text-slate-500 pt-1 border-t border-slate-900 font-mono">
            <span>Tab / ↵ вставить</span>
            <span>Esc закрыть</span>
          </div>
        </div>
      )}
    </div>
  );
};
