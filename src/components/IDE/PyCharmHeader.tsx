import React, { useState } from 'react';
import {
  Play,
  Bug,
  MoreVertical,
  Layers,
  Search,
  Settings,
  ChevronDown,
  Timer,
  Copy,
  Check,
  Menu,
  Square,
  Minus,
  X,
  StopCircle,
} from 'lucide-react';
import { PyCharmLogo, PythonLogo } from './PyCharmIcons';
import { UserAvatar } from '../Common/UserAvatar';
import { CodeCursor } from '../../types/extra';

interface PyCharmHeaderProps {
  roomId: string;
  projectName: string;
  activeFileName: string;
  activeLanguage: string;
  isRunning: boolean;
  onRunCode: () => void;
  copied: boolean;
  onCopyCode: () => void;
  onBackToBoard: () => void;
  userName: string;
  userRole: string;
  userColor: string;
  userAvatar?: string;
  otherCursors: Record<string, CodeCursor>;
  timeoutSeconds: number;
  onSetTimeout: (sec: number) => void;
}

export const PyCharmHeader: React.FC<PyCharmHeaderProps> = ({
  roomId,
  projectName,
  activeFileName,
  activeLanguage,
  isRunning,
  onRunCode,
  copied,
  onCopyCode,
  onBackToBoard,
  userName,
  userRole,
  userColor,
  userAvatar,
  otherCursors,
  timeoutSeconds,
  onSetTimeout,
}) => {
  const [showTimeoutDropdown, setShowTimeoutDropdown] = useState(false);
  const [customTimeoutInput, setCustomTimeoutInput] = useState('');

  // Extract initials for project badge (e.g. Analiticheskoe_reshenie -> AR)
  const projectInitials = (projectName || 'AR')
    .split(/[-_ ]/)
    .filter(Boolean)
    .map((s) => (s && s[0] ? s[0].toUpperCase() : ''))
    .slice(0, 2)
    .join('') || 'AR';

  return (
    <header
      id="pycharm-main-header"
      className="h-10 bg-[#1E1F22] border-b border-[#2B2D30] px-2.5 flex items-center justify-between gap-2 select-none shrink-0 z-30 font-sans text-xs"
    >
      {/* Left Zone: PyCharm Logo + Project Selector & Whiteboard Toggle */}
      <div className="flex items-center gap-2">
        <PyCharmLogo className="w-5 h-5" />

        <button
          className="p-1 text-[#8C9098] hover:text-white hover:bg-[#2B2D30] rounded transition cursor-pointer"
          title="Main Menu"
        >
          <Menu className="w-3.5 h-3.5" />
        </button>

        {/* Project Chip with initials badge */}
        <div className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-[#2B2D30] cursor-pointer transition text-[#DFE1E5] font-medium">
          <span className="w-4 h-4 rounded-full bg-[#8B5CF6] text-white text-[9px] font-bold flex items-center justify-center">
            {projectInitials}
          </span>
          <span className="font-mono text-[12px]">{projectName}</span>
          <ChevronDown className="w-3 h-3 text-[#7A7E85]" />
        </div>

        {/* Version control dropdown */}
        <div className="hidden sm:flex items-center gap-1 px-1.5 py-1 rounded text-[#7A7E85] hover:text-[#DFE1E5] hover:bg-[#2B2D30] cursor-pointer transition text-[11px]">
          <span>Version control</span>
          <ChevronDown className="w-3 h-3 text-[#5A5D63]" />
        </div>

        <div className="h-4 w-px bg-[#2B2D30] mx-1" />

        {/* Back to Whiteboard action button */}
        <button
          onClick={onBackToBoard}
          className="px-2 py-1 bg-[#2B2D30] hover:bg-[#3574F0] text-[#DFE1E5] hover:text-white rounded text-[11px] font-medium transition flex items-center gap-1.5 cursor-pointer shadow-2xs border border-[#393B40]"
          title="Переключиться на интерактивную доску"
        >
          <Layers className="w-3 h-3 text-[#589DF6] group-hover:text-white" />
          <span>Доска</span>
        </button>
      </div>

      {/* Center Zone: PyCharm Run Widget (Python Selector + Play + Debug + More) */}
      <div className="flex items-center gap-1 bg-[#2B2D30] border border-[#393B40] rounded-md px-1 py-0.5 shadow-xs">
        {/* Active Configuration chip */}
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded hover:bg-[#393B40] cursor-pointer text-[#DFE1E5] text-[11.5px] font-mono transition">
          <PythonLogo className="w-3.5 h-3.5" />
          <span className="font-medium">{activeFileName.replace(/\.[^/.]+$/, '')}</span>
          <ChevronDown className="w-3 h-3 text-[#7A7E85]" />
        </div>

        {/* Green Run Play Button */}
        <button
          onClick={onRunCode}
          disabled={isRunning}
          title="Run 'main' (Shift+F10 / Ctrl+Enter)"
          className={`w-6 h-6 rounded flex items-center justify-center transition cursor-pointer ${
            isRunning
              ? 'bg-[#3574F0] text-white animate-pulse'
              : 'hover:bg-[#393B40] text-[#59A869] hover:text-[#6AAB73]'
          }`}
        >
          {isRunning ? (
            <StopCircle className="w-3.5 h-3.5 text-white" />
          ) : (
            <Play className="w-3.5 h-3.5 fill-current" />
          )}
        </button>

        {/* Green Debug Bug Button */}
        <button
          onClick={onRunCode}
          disabled={isRunning}
          title="Debug 'main' (Shift+F9)"
          className="w-6 h-6 rounded flex items-center justify-center text-[#59A869] hover:text-[#6AAB73] hover:bg-[#393B40] transition cursor-pointer"
        >
          <Bug className="w-3.5 h-3.5" />
        </button>

        {/* More Options */}
        <button
          title="More Run Options"
          className="w-5 h-6 rounded flex items-center justify-center text-[#7A7E85] hover:text-white hover:bg-[#393B40] transition cursor-pointer"
        >
          <MoreVertical className="w-3 h-3" />
        </button>
      </div>

      {/* Right Zone: Timeout & Collaborators & Search & Settings */}
      <div className="flex items-center gap-1.5 relative">
        {/* Configurable Timeout Button (Tutor control) */}
        <div className="relative">
          {userRole === 'tutor' ? (
            <button
              onClick={() => setShowTimeoutDropdown((prev) => !prev)}
              title="Настроить предельное время выполнения программ"
              className={`px-2 py-0.5 rounded text-[11px] font-mono transition flex items-center gap-1 border ${
                showTimeoutDropdown
                  ? 'bg-[#3574F0] border-[#589DF6] text-white'
                  : 'bg-[#2B2D30] hover:bg-[#393B40] border-[#393B40] text-[#DFE1E5]'
              }`}
            >
              <Timer className="w-3 h-3 text-[#E5A84B]" />
              <span>{timeoutSeconds}s</span>
              <ChevronDown className="w-2.5 h-2.5 text-[#7A7E85]" />
            </button>
          ) : (
            <div
              title="Предельное время выполнения программ"
              className="px-2 py-0.5 rounded text-[11px] font-mono flex items-center gap-1 border bg-[#2B2D30] border-[#393B40] text-[#8C9098]"
            >
              <Timer className="w-3 h-3 text-[#E5A84B]" />
              <span>{timeoutSeconds}s</span>
            </div>
          )}

          {/* Timeout Dropdown Menu */}
          {showTimeoutDropdown && userRole === 'tutor' && (
            <div className="absolute right-0 top-full mt-1 w-56 bg-[#2B2D30] border border-[#393B40] rounded-lg shadow-2xl p-2.5 z-50 animate-in fade-in zoom-in-95 font-sans">
              <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-[#393B40] text-[11px] font-semibold text-[#DFE1E5]">
                <span>Лимит выполнения (тайм-аут)</span>
                <span className="text-[#E5A84B] font-mono">{timeoutSeconds}с</span>
              </div>
              <div className="grid grid-cols-4 gap-1 mb-2">
                {[3, 5, 10, 15, 30, 60, 90, 120].map((sec) => (
                  <button
                    key={sec}
                    onClick={() => {
                      onSetTimeout(sec);
                      setShowTimeoutDropdown(false);
                    }}
                    className={`py-0.5 rounded text-[11px] font-mono transition border ${
                      timeoutSeconds === sec
                        ? 'bg-[#3574F0] text-white border-[#589DF6]'
                        : 'bg-[#1E1F22] hover:bg-[#393B40] border-[#393B40] text-[#DFE1E5]'
                    }`}
                  >
                    {sec}s
                  </button>
                ))}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const val = parseInt(customTimeoutInput, 10);
                  if (!isNaN(val) && val >= 1) {
                    onSetTimeout(val);
                    setCustomTimeoutInput('');
                    setShowTimeoutDropdown(false);
                  }
                }}
                className="flex items-center gap-1 pt-1.5 border-t border-[#393B40]"
              >
                <input
                  type="number"
                  min="1"
                  max="180"
                  placeholder="Свой (сек)"
                  value={customTimeoutInput}
                  onChange={(e) => setCustomTimeoutInput(e.target.value)}
                  className="flex-1 bg-[#1E1F22] border border-[#393B40] rounded px-2 py-0.5 text-xs text-white placeholder-[#7A7E85] focus:outline-none focus:border-[#3574F0] font-mono"
                />
                <button
                  type="submit"
                  className="px-2 py-0.5 bg-[#3574F0] hover:bg-[#4682F4] text-white rounded text-xs transition font-medium"
                >
                  OK
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Copy Code */}
        <button
          onClick={onCopyCode}
          title="Копировать код"
          className="p-1.5 text-[#8C9098] hover:text-white hover:bg-[#2B2D30] rounded transition cursor-pointer"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-[#6AAB73]" /> : <Copy className="w-3.5 h-3.5 text-[#8C9098]" />}
        </button>

        {/* Collaborators Avatar Pills */}
        <div className="hidden lg:flex items-center gap-1 pl-1">
          <div
            className="flex items-center gap-1 bg-[#2B2D30] px-1.5 py-0.5 rounded border border-[#393B40] text-[11px]"
            title={`${userName} (Вы)`}
          >
            <UserAvatar avatar={userAvatar} color={userColor} name={userName} size="xs" className="w-3.5 h-3.5 text-[9px]" />
            <span className="text-[#DFE1E5] font-medium max-w-[70px] truncate">{userName}</span>
          </div>

          {(Object.values(otherCursors) as CodeCursor[]).slice(0, 3).map((c) => (
            <div
              key={c.userId}
              className="flex items-center gap-1 bg-[#2B2D30] px-1.5 py-0.5 rounded border border-[#393B40] text-[11px]"
              title={`${c.userName} (строка ${c.lineNumber})`}
            >
              <UserAvatar avatar={c.avatar || '🎓'} color={c.color} name={c.userName} size="xs" className="w-3.5 h-3.5 text-[9px]" />
              <span className="text-[#A6A9B0] max-w-[60px] truncate">{c.userName}</span>
            </div>
          ))}
        </div>

        {/* Search & Settings & Window Controls */}
        <button
          className="p-1 text-[#8C9098] hover:text-white hover:bg-[#2B2D30] rounded transition cursor-pointer"
          title="Search Everywhere (Double Shift)"
        >
          <Search className="w-3.5 h-3.5" />
        </button>

        <button
          className="p-1 text-[#8C9098] hover:text-white hover:bg-[#2B2D30] rounded transition cursor-pointer"
          title="Settings (Ctrl+Alt+S)"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
};
