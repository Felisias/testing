import React from 'react';
import {
  FolderGit2,
  Terminal as TerminalIcon,
  Mic,
  MicOff,
  Settings,
  AlertCircle,
  MoreHorizontal,
  Code2,
  SlidersHorizontal,
} from 'lucide-react';
import { GitBranchIcon, PythonLogo } from './PyCharmIcons';

interface PyCharmActivityBarProps {
  isProjectOpen: boolean;
  onToggleProject: () => void;
  activeBottomTab: 'output' | 'terminal' | 'plots';
  onSelectBottomTab: (tab: 'output' | 'terminal' | 'plots') => void;
  isMicMuted: boolean;
  isSpeaking: boolean;
  onToggleMic: () => void;
}

export const PyCharmActivityBar: React.FC<PyCharmActivityBarProps> = ({
  isProjectOpen,
  onToggleProject,
  activeBottomTab,
  onSelectBottomTab,
  isMicMuted,
  isSpeaking,
  onToggleMic,
}) => {
  return (
    <aside
      id="pycharm-activity-bar"
      className="w-10 bg-[#1E1F22] border-r border-[#2B2D30] flex flex-col justify-between items-center py-2 select-none shrink-0 z-20"
    >
      {/* Top Tool Icons */}
      <div className="flex flex-col items-center gap-1 w-full">
        {/* Project View toggle button */}
        <button
          onClick={onToggleProject}
          title="Project (Alt+1)"
          className={`w-8 h-8 rounded flex items-center justify-center relative transition cursor-pointer ${
            isProjectOpen
              ? 'text-white bg-[#2B2D30]'
              : 'text-[#8C9098] hover:text-white hover:bg-[#2B2D30]/60'
          }`}
        >
          {isProjectOpen && (
            <div className="absolute left-0 top-1.5 bottom-1.5 w-[2px] bg-[#3574F0] rounded-r" />
          )}
          <FolderGit2 className="w-4 h-4" />
        </button>

        {/* Structure / Git Branch */}
        <button
          title="Git & Structure"
          className="w-8 h-8 rounded flex items-center justify-center text-[#8C9098] hover:text-white hover:bg-[#2B2D30]/60 transition cursor-pointer"
        >
          <GitBranchIcon className="w-4 h-4" />
        </button>

        {/* More Tools */}
        <button
          title="More Tool Windows"
          className="w-8 h-8 rounded flex items-center justify-center text-[#8C9098] hover:text-white hover:bg-[#2B2D30]/60 transition cursor-pointer"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>

      {/* Bottom Tool Icons */}
      <div className="flex flex-col items-center gap-1 w-full">
        {/* Python Console */}
        <button
          onClick={() => onSelectBottomTab('output')}
          title="Python Console / Run (Alt+4)"
          className={`w-8 h-8 rounded flex items-center justify-center transition cursor-pointer ${
            activeBottomTab === 'output'
              ? 'text-white bg-[#2B2D30]'
              : 'text-[#8C9098] hover:text-white hover:bg-[#2B2D30]/60'
          }`}
        >
          <PythonLogo className="w-4 h-4" />
        </button>

        {/* Terminal Tab */}
        <button
          onClick={() => onSelectBottomTab('terminal')}
          title="Terminal (Alt+F12)"
          className={`w-8 h-8 rounded flex items-center justify-center transition cursor-pointer ${
            activeBottomTab === 'terminal'
              ? 'text-white bg-[#2B2D30]'
              : 'text-[#8C9098] hover:text-white hover:bg-[#2B2D30]/60'
          }`}
        >
          <TerminalIcon className="w-4 h-4" />
        </button>

        {/* Microphone Quick Control */}
        <button
          onClick={onToggleMic}
          title={isMicMuted ? 'Включить микрофон' : 'Заглушить микрофон'}
          className={`w-8 h-8 rounded flex items-center justify-center relative transition cursor-pointer ${
            isMicMuted
              ? 'text-rose-400 hover:bg-rose-950/40'
              : isSpeaking
              ? 'text-emerald-300 bg-emerald-950/60 animate-pulse'
              : 'text-emerald-400 hover:bg-emerald-950/40'
          }`}
        >
          {isMicMuted ? (
            <MicOff className="w-4 h-4" />
          ) : (
            <Mic className="w-4 h-4" />
          )}
          <span
            className={`absolute top-1 right-1 w-1.5 h-1.5 rounded-full ${
              isMicMuted ? 'bg-rose-500' : isSpeaking ? 'bg-emerald-400 animate-ping' : 'bg-emerald-500'
            }`}
          />
        </button>

        {/* Problems */}
        <button
          title="Problems (0 errors, 0 warnings)"
          className="w-8 h-8 rounded flex items-center justify-center text-[#8C9098] hover:text-white hover:bg-[#2B2D30]/60 transition cursor-pointer"
        >
          <AlertCircle className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
};
