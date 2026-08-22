import React from 'react';
import { Bell, CheckCircle2, ChevronRight, RefreshCw } from 'lucide-react';
import { PythonLogo } from './PyCharmIcons';

interface PyCharmStatusBarProps {
  projectName?: string;
  activeFileName?: string;
  activeLanguage?: string;
  cursorLine?: number;
  cursorCol?: number;
  isRunning?: boolean;
  isTerminalExecuting?: boolean;
  participantCount?: number;
  onChangeLanguage?: (lang: string) => void;
  // Alternate aliases passed from CodeIDE
  line?: number;
  column?: number;
  language?: string;
  encoding?: string;
  lineEnding?: string;
  branch?: string;
  otherCursorsCount?: number;
  activeBottomTab?: 'output' | 'terminal' | 'plots';
  onSelectBottomTab?: (tab: 'output' | 'terminal' | 'plots') => void;
}

export const PyCharmStatusBar: React.FC<PyCharmStatusBarProps> = ({
  projectName = 'Project',
  activeFileName = 'main.py',
  activeLanguage,
  cursorLine,
  cursorCol,
  isRunning = false,
  isTerminalExecuting = false,
  participantCount,
  onChangeLanguage,
  line = 1,
  column = 1,
  language = 'python',
  encoding = 'UTF-8',
  lineEnding = 'LF',
  branch = 'master',
  otherCursorsCount = 0,
  activeBottomTab,
  onSelectBottomTab,
}) => {
  const [showLangMenu, setShowLangMenu] = React.useState(false);

  const effectiveLang = (activeLanguage || language || 'python').toLowerCase();
  const effectiveLine = cursorLine ?? line;
  const effectiveCol = cursorCol ?? column;
  const effectiveParticipants = participantCount ?? otherCursorsCount;

  const getInterpreterLabel = () => {
    switch (effectiveLang) {
      case 'python':
        return `Python 3.12 (${projectName})`;
      case 'javascript':
        return 'Node.js v20.x';
      case 'typescript':
        return 'TypeScript 5.x';
      case 'cpp':
        return 'GCC / Clang C++20';
      case 'sql':
        return 'PostgreSQL Engine';
      case 'html':
        return 'HTML5 / CSS3';
      default:
        return effectiveLang ? `${effectiveLang.toUpperCase()} Engine` : 'Python 3.12';
    }
  };

  return (
    <footer
      id="pycharm-status-bar"
      className="h-[26px] bg-[#1E1F22] border-t border-[#2B2D30] px-3 flex items-center justify-between text-[11px] text-[#8C9098] select-none font-sans shrink-0 z-30"
    >
      {/* Left: Breadcrumbs navigation */}
      <div className="flex items-center gap-1.5 font-mono text-[11px] text-[#A6A9B0] overflow-hidden truncate">
        <span className="hover:text-white cursor-pointer transition truncate">
          {projectName}
        </span>
        <ChevronRight className="w-3 h-3 text-[#5A5D63] shrink-0" />
        <div className="flex items-center gap-1 text-[#DFE1E5] font-medium hover:text-white cursor-pointer transition shrink-0">
          <PythonLogo className="w-3 h-3" />
          <span>{activeFileName}</span>
        </div>
      </div>

      {/* Center: Background task / Engine status */}
      <div className="hidden md:flex items-center gap-2 text-[11px] font-mono">
        {isRunning || isTerminalExecuting ? (
          <div className="flex items-center gap-2 text-[#589DF6] animate-pulse">
            <RefreshCw className="w-3 h-3 animate-spin" />
            <span>Выполнение скрипта...</span>
            <div className="w-16 h-1.5 bg-[#2B2D30] rounded-full overflow-hidden">
              <div className="h-full bg-[#3574F0] animate-indeterminate" style={{ width: '60%' }} />
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-[#7A7E85]">
            <CheckCircle2 className="w-3 h-3 text-[#6AAB73]" />
            <span>Ready</span>
            <span className="text-[#4E5157]">•</span>
            <span className="text-[10.5px]">Синхронизировано ({effectiveParticipants + 1})</span>
          </div>
        )}
      </div>

      {/* Right: Line:Col, Encoding, Indent, Interpreter & Notifications */}
      <div className="flex items-center gap-3 text-[11px] font-mono shrink-0">
        {/* Line and Column */}
        <div className="text-[#A6A9B0] hover:text-white transition cursor-default">
          {effectiveLine}:{effectiveCol}
        </div>

        <span className="text-[#393B40]">|</span>

        {/* Line endings & Charset */}
        <span className="hover:text-white cursor-pointer transition">{lineEnding}</span>
        <span className="hover:text-white cursor-pointer transition">{encoding}</span>
        <span className="hover:text-white cursor-pointer transition hidden sm:inline">4 spaces</span>

        <span className="text-[#393B40]">|</span>

        {/* Interpreter Selector dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowLangMenu((prev) => !prev)}
            className="flex items-center gap-1.5 text-[#DFE1E5] hover:text-white hover:bg-[#2B2D30] px-1.5 py-0.5 rounded transition cursor-pointer"
            title="Выбрать интерпретатор / язык"
          >
            <PythonLogo className="w-3 h-3" />
            <span className="truncate max-w-[150px]">{getInterpreterLabel()}</span>
          </button>

          {showLangMenu && (
            <div className="absolute right-0 bottom-full mb-1 w-52 bg-[#2B2D30] border border-[#393B40] rounded-lg shadow-2xl p-1 z-50 animate-in fade-in zoom-in-95 font-sans">
              <div className="px-2 py-1 text-[10px] font-bold text-[#7A7E85] uppercase tracking-wider border-b border-[#393B40] mb-1">
                Интерпретатор / Язык
              </div>
              {[
                { id: 'python', label: 'Python 3.12 (venv)', ext: '.py' },
                { id: 'javascript', label: 'JavaScript (Node.js)', ext: '.js' },
                { id: 'typescript', label: 'TypeScript (v5)', ext: '.ts' },
                { id: 'cpp', label: 'C++ 20 (GCC)', ext: '.cpp' },
                { id: 'html', label: 'HTML5 / CSS3', ext: '.html' },
                { id: 'sql', label: 'SQL (PostgreSQL)', ext: '.sql' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    if (onChangeLanguage) {
                      onChangeLanguage(item.id);
                    }
                    setShowLangMenu(false);
                  }}
                  className={`w-full px-2 py-1 rounded text-left text-xs flex items-center justify-between transition cursor-pointer ${
                    effectiveLang === item.id
                      ? 'bg-[#3574F0] text-white font-medium'
                      : 'text-[#DFE1E5] hover:bg-[#393B40]'
                  }`}
                >
                  <span className="font-mono">{item.label}</span>
                  <span className="text-[10px] opacity-60 font-mono">{item.ext}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Notification Bell */}
        <button
          className="text-[#8C9098] hover:text-white p-0.5 hover:bg-[#2B2D30] rounded transition cursor-pointer"
          title="Уведомления и события"
        >
          <Bell className="w-3.5 h-3.5" />
        </button>
      </div>
    </footer>
  );
};
