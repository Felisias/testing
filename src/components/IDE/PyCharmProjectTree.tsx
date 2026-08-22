import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  Plus,
  Trash2,
  Image as ImageIcon,
  Check,
  Copy,
  Layers,
  FileCode,
  FileText,
  Minus,
  Settings,
  MoreVertical,
} from 'lucide-react';
import { CodeFile, CodePlot } from '../../types/extra';
import { PythonLogo } from './PyCharmIcons';

interface PyCharmProjectTreeProps {
  roomId: string;
  projectName: string;
  files: CodeFile[];
  activeFileId: string;
  plots: CodePlot[];
  activePlotId?: string;
  showPlotViewer: boolean;
  copiedPlotId: string | null;
  onSelectFile: (fileId: string) => void;
  onDeleteFile: (fileId: string, e: React.MouseEvent) => void;
  onOpenNewFileModal: () => void;
  onOpenPlot: (plotId: string) => void;
  onDeletePlot: (plotId: string, e: React.MouseEvent) => void;
  onClearPlots: () => void;
  onCopyPlot: (plot: CodePlot, e: React.MouseEvent) => void;
  onSendPlotToBoard?: (plot: CodePlot, e: React.MouseEvent) => void;
  onCloseSidebar?: () => void;
}

export const PyCharmProjectTree: React.FC<PyCharmProjectTreeProps> = ({
  roomId,
  projectName,
  files,
  activeFileId,
  plots,
  activePlotId,
  showPlotViewer,
  copiedPlotId,
  onSelectFile,
  onDeleteFile,
  onOpenNewFileModal,
  onOpenPlot,
  onDeletePlot,
  onClearPlots,
  onCopyPlot,
  onSendPlotToBoard,
  onCloseSidebar,
}) => {
  const [isProjectRootOpen, setIsProjectRootOpen] = useState(true);
  const [isVenvOpen, setIsVenvOpen] = useState(false);
  const [isExtLibrariesOpen, setIsExtLibrariesOpen] = useState(false);
  const [isPlotsOpen, setIsPlotsOpen] = useState(true);

  const getFileIcon = (fileName: string) => {
    if (fileName.endsWith('.py')) {
      return <PythonLogo className="w-3.5 h-3.5" />;
    }
    if (fileName.endsWith('.js') || fileName.endsWith('.ts')) {
      return <FileCode className="w-3.5 h-3.5 text-yellow-400" />;
    }
    if (fileName.endsWith('.cpp') || fileName.endsWith('.c')) {
      return <FileCode className="w-3.5 h-3.5 text-blue-400" />;
    }
    if (fileName.endsWith('.sql')) {
      return <FileText className="w-3.5 h-3.5 text-cyan-400" />;
    }
    return <FileText className="w-3.5 h-3.5 text-slate-400" />;
  };

  return (
    <aside
      id="pycharm-project-tree"
      className="w-60 bg-[#1E1F22] border-r border-[#2B2D30] flex flex-col shrink-0 select-none text-[12px] font-sans"
    >
      {/* Tool Window Header */}
      <div className="h-8 px-2.5 bg-[#1E1F22] border-b border-[#2B2D30] flex items-center justify-between text-[#DFE1E5] font-medium">
        <div className="flex items-center gap-1 hover:text-white cursor-pointer transition">
          <span className="font-semibold text-[12px]">Project</span>
          <ChevronDown className="w-3 h-3 text-[#7A7E85]" />
        </div>

        <div className="flex items-center gap-1 text-[#7A7E85]">
          <button
            onClick={onOpenNewFileModal}
            title="New File (Alt+Insert)"
            className="p-1 hover:text-white hover:bg-[#2B2D30] rounded transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          {onCloseSidebar && (
            <button
              onClick={onCloseSidebar}
              title="Hide Tool Window (Shift+Esc)"
              className="p-1 hover:text-white hover:bg-[#2B2D30] rounded transition cursor-pointer"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Tree Content */}
      <div className="flex-1 overflow-y-auto py-1 font-mono text-[12px]">
        {/* Project Root Folder */}
        <div>
          <div
            onClick={() => setIsProjectRootOpen((prev) => !prev)}
            className="px-1.5 py-1 flex items-center gap-1.5 text-[#DFE1E5] hover:bg-[#2B2D30] cursor-pointer transition rounded-xs"
          >
            {isProjectRootOpen ? (
              <ChevronDown className="w-3 h-3 text-[#7A7E85] shrink-0" />
            ) : (
              <ChevronRight className="w-3 h-3 text-[#7A7E85] shrink-0" />
            )}
            <FolderOpen className="w-3.5 h-3.5 text-[#589DF6] shrink-0" />
            <span className="font-semibold text-[#DFE1E5] truncate">{projectName}</span>
            <span className="text-[10px] text-[#7A7E85] truncate">D:\{projectName}</span>
          </div>

          {isProjectRootOpen && (
            <div className="pl-4 space-y-0.5">
              {/* Virtual Environment Folder */}
              <div>
                <div
                  onClick={() => setIsVenvOpen((prev) => !prev)}
                  className="px-1.5 py-0.5 flex items-center gap-1.5 text-[#7A7E85] hover:text-[#DFE1E5] hover:bg-[#2B2D30] cursor-pointer transition rounded-xs text-[11.5px]"
                >
                  {isVenvOpen ? (
                    <ChevronDown className="w-3 h-3 text-[#5A5D63] shrink-0" />
                  ) : (
                    <ChevronRight className="w-3 h-3 text-[#5A5D63] shrink-0" />
                  )}
                  <Folder className="w-3.5 h-3.5 text-[#7A7E85] shrink-0" />
                  <span className="truncate">.venv</span>
                  <span className="text-[10px] text-[#5A5D63]">library root</span>
                </div>

                {isVenvOpen && (
                  <div className="pl-5 py-0.5 text-[10.5px] text-[#5A5D63] space-y-0.5">
                    <div>Include</div>
                    <div>Lib/site-packages</div>
                    <div>Scripts</div>
                    <div>pyvenv.cfg</div>
                  </div>
                )}
              </div>

              {/* Project Source Files */}
              {files.map((file) => {
                const isActive = file.id === activeFileId;
                return (
                  <div
                    key={file.id}
                    onClick={() => onSelectFile(file.id)}
                    className={`group px-2 py-1 rounded-xs flex items-center justify-between cursor-pointer transition ${
                      isActive
                        ? 'bg-[#2B2D30] text-white font-semibold'
                        : 'text-[#BCBEC4] hover:bg-[#2B2D30]/60 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {getFileIcon(file.name)}
                      <span className="truncate">{file.name}</span>
                    </div>

                    {files.length > 1 && (
                      <button
                        onClick={(e) => onDeleteFile(file.id, e)}
                        title="Delete File"
                        className="opacity-0 group-hover:opacity-100 hover:text-rose-400 p-0.5 rounded transition cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })}

              {/* External Libraries Node */}
              <div>
                <div
                  onClick={() => setIsExtLibrariesOpen((prev) => !prev)}
                  className="px-1.5 py-0.5 flex items-center gap-1.5 text-[#7A7E85] hover:text-[#DFE1E5] hover:bg-[#2B2D30] cursor-pointer transition rounded-xs text-[11.5px]"
                >
                  {isExtLibrariesOpen ? (
                    <ChevronDown className="w-3 h-3 text-[#5A5D63] shrink-0" />
                  ) : (
                    <ChevronRight className="w-3 h-3 text-[#5A5D63] shrink-0" />
                  )}
                  <span className="text-[12px]">📚</span>
                  <span className="truncate">External Libraries</span>
                </div>

                {isExtLibrariesOpen && (
                  <div className="pl-6 py-0.5 text-[10.5px] text-[#7A7E85] space-y-1">
                    <div>Python 3.12 (venv)</div>
                    <div>&lt; numpy 1.26.4 &gt;</div>
                    <div>&lt; matplotlib 3.8.4 &gt;</div>
                    <div>&lt; sympy 1.12 &gt;</div>
                  </div>
                )}
              </div>

              {/* Scratches and Consoles Node */}
              <div className="px-1.5 py-0.5 flex items-center gap-1.5 text-[#7A7E85] hover:text-[#DFE1E5] hover:bg-[#2B2D30] cursor-pointer transition rounded-xs text-[11.5px]">
                <ChevronRight className="w-3 h-3 text-[#5A5D63] shrink-0" />
                <span className="text-[12px]">📁</span>
                <span className="truncate">Scratches and Consoles</span>
              </div>
            </div>
          )}
        </div>

        {/* Section 2: Generated Plots / Matplotlib Charts */}
        {plots.length > 0 && (
          <div className="mt-3 pt-2 border-t border-[#2B2D30]">
            <div
              onClick={() => setIsPlotsOpen((prev) => !prev)}
              className="px-2 py-1 flex items-center justify-between text-[#DFE1E5] hover:bg-[#2B2D30] cursor-pointer transition"
            >
              <div className="flex items-center gap-1.5 text-[#E5A84B] font-semibold text-[11px]">
                {isPlotsOpen ? (
                  <ChevronDown className="w-3 h-3 shrink-0" />
                ) : (
                  <ChevronRight className="w-3 h-3 shrink-0" />
                )}
                <ImageIcon className="w-3.5 h-3.5 shrink-0" />
                <span>Matplotlib Plots ({plots.length})</span>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClearPlots();
                }}
                title="Очистить все графики"
                className="text-[#7A7E85] hover:text-rose-400 p-0.5 rounded transition"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>

            {isPlotsOpen && (
              <div className="p-1 space-y-1">
                {plots.map((plot) => {
                  const isCurrent = showPlotViewer && activePlotId === plot.id;
                  return (
                    <div
                      key={plot.id}
                      onClick={() => onOpenPlot(plot.id)}
                      className={`group p-1.5 rounded flex items-center justify-between cursor-pointer transition border ${
                        isCurrent
                          ? 'bg-[#2B2D30] text-white border-[#E5A84B]/60'
                          : 'bg-[#1E1F22] hover:bg-[#2B2D30] text-[#BCBEC4] border-[#2B2D30]'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <img
                          src={plot.dataUrl}
                          alt={plot.name}
                          className="w-5 h-5 rounded object-cover bg-white shrink-0 border border-[#393B40]"
                        />
                        <div className="flex flex-col min-w-0">
                          <span className="truncate text-[11px] font-medium leading-tight">
                            {plot.name}
                          </span>
                          <span className="text-[9px] text-[#7A7E85]">
                            {plot.size ? `${Math.round(plot.size / 1024)} KB` : 'PNG'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
                        <button
                          onClick={(e) => onCopyPlot(plot, e)}
                          title="Копировать график"
                          className="p-1 text-[#7A7E85] hover:text-white rounded transition"
                        >
                          {copiedPlotId === plot.id ? (
                            <Check className="w-3 h-3 text-[#6AAB73]" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                        {onSendPlotToBoard && (
                          <button
                            onClick={(e) => onSendPlotToBoard(plot, e)}
                            title="Вставить на интерактивную доску"
                            className="p-1 text-[#7A7E85] hover:text-[#589DF6] rounded transition"
                          >
                            <Layers className="w-3 h-3" />
                          </button>
                        )}
                        <button
                          onClick={(e) => onDeletePlot(plot.id, e)}
                          title="Удалить график"
                          className="p-1 text-[#7A7E85] hover:text-rose-400 rounded transition"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
