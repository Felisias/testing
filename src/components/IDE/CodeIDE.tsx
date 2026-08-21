import React, { useState, useEffect, useRef, useMemo } from 'react';
import Prism from 'prismjs';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-markup';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-bash';

import { getSocket } from '../../services/socket';
import { CodeFile, CodeCursor, CodeSelection, CodePlot } from '../../types/extra';
import { Participant } from '../../types';
import { UserAvatar } from '../Common/UserAvatar';
import { voiceManager } from '../../services/webrtc';
import { getSuggestions, cleanInsertText, expandSnippet, CodeSuggestion } from './codeSuggestions';
import { AutocompletePopup } from './AutocompletePopup';
import { FloatingPlotViewer } from './FloatingPlotViewer';
import {
  Code2,
  Play,
  RotateCcw,
  Plus,
  Trash2,
  Terminal,
  FileCode,
  Copy,
  Check,
  Layers,
  FilePlus2,
  FileText,
  Sparkles,
  ExternalLink,
  GripHorizontal,
  Maximize2,
  Minimize2,
  ArrowUpRight,
  Mic,
  MicOff,
  Box,
  Download,
  AlertCircle,
  CheckCircle2,
  Command,
  Timer,
  ChevronDown,
  Settings2,
  Image as ImageIcon,
  Eye,
} from 'lucide-react';

interface CodeIDEProps {
  roomId: string;
  myUserId: string;
  userName: string;
  userRole: string;
  userColor: string;
  userAvatar?: string;
  participants?: Record<string, Participant>;
  onBackToBoard: () => void;
  onSendPlotToBoard?: (plot: { name: string; dataUrl: string }) => void;
}

const DEFAULT_FILES: CodeFile[] = [
  {
    id: 'main-py',
    name: 'main.py',
    language: 'python',
    content: `# TutorBoard Python IDE: Поддержка вывода графиков (Matplotlib)
import numpy as np
import matplotlib.pyplot as plt

# Генерация данных для графика
x = np.linspace(-5, 5, 200)
y1 = np.sin(x)
y2 = np.cos(x)

# Построение графика
plt.figure(figsize=(7, 4))
plt.plot(x, y1, label='sin(x)', color='#3b82f6', linewidth=2)
plt.plot(x, y2, label='cos(x)', color='#f43f5e', linewidth=2, linestyle='--')
plt.title('Графики функций sin(x) и cos(x)', fontsize=12)
plt.xlabel('Ось X')
plt.ylabel('Ось Y')
plt.grid(True, alpha=0.3)
plt.legend()
plt.tight_layout()

# Вызов plt.show() автоматически открывает интерактивное окно графика!
plt.show()

print("✓ Программа выполнена. График доступен для перемещения, зума и вставки на доску!")
`,
  },
];

const LANGUAGE_EXTENSIONS: Record<string, string> = {
  python: 'py',
  javascript: 'js',
  typescript: 'ts',
  cpp: 'cpp',
  html: 'html',
  css: 'css',
  sql: 'sql',
};

const LINE_HEIGHT = 24; // Exact px line-height
const PADDING_TOP = 12; // Textarea padding-top in px
const PADDING_LEFT = 12; // Textarea padding-left in px

const DISTINCT_COLORS = [
  '#f43f5e', // rose
  '#06b6d4', // cyan
  '#10b981', // emerald
  '#8b5cf6', // violet
  '#f59e0b', // amber
  '#ec4899', // pink
  '#3b82f6', // blue
  '#14b8a6', // teal
  '#e11d48', // crimson
  '#a855f7', // purple
];

function getDistinctRemoteColor(remoteColor?: string, localColor?: string, userId?: string): string {
  if (remoteColor && remoteColor.toLowerCase() !== (localColor || '').toLowerCase()) {
    return remoteColor;
  }
  let hash = 0;
  for (let i = 0; i < (userId || 'user').length; i++) {
    hash = ((hash << 5) - hash) + (userId || 'user').charCodeAt(i);
  }
  const filtered = DISTINCT_COLORS.filter(c => c.toLowerCase() !== (localColor || '').toLowerCase());
  return filtered[Math.abs(hash) % filtered.length] || '#3b82f6';
}

interface SelectionBox {
  top: number;
  left: number;
  width: number;
  height: number;
}

function getColumnOffset(lineText: string, colIndex: number, charWidth: number): number {
  // colIndex is 1-based index (1 = first character)
  if (colIndex <= 1) return 0;
  const prefix = lineText.substring(0, colIndex - 1);
  let visualCols = 0;
  for (let i = 0; i < prefix.length; i++) {
    if (prefix[i] === '\t') {
      visualCols += 4 - (visualCols % 4);
    } else {
      visualCols += 1;
    }
  }
  return visualCols * charWidth;
}

function calculateSelectionBoxes(
  selection: { startLine: number; startCol: number; endLine: number; endCol: number },
  content: string,
  charWidth: number,
  scrollPos: { top: number; left: number }
): SelectionBox[] {
  const boxes: SelectionBox[] = [];
  const lines = content.split('\n');
  const { startLine, startCol, endLine, endCol } = selection;

  if (startLine === endLine) {
    const lineText = lines[startLine - 1] || '';
    const leftOffset = getColumnOffset(lineText, startCol, charWidth);
    const rightOffset = getColumnOffset(lineText, endCol, charWidth);
    const width = Math.max(charWidth * 0.5, rightOffset - leftOffset);
    const top = (startLine - 1) * LINE_HEIGHT + PADDING_TOP - scrollPos.top;
    const left = leftOffset + PADDING_LEFT - scrollPos.left;
    boxes.push({ top, left, width, height: LINE_HEIGHT });
  } else {
    for (let l = startLine; l <= endLine; l++) {
      const top = (l - 1) * LINE_HEIGHT + PADDING_TOP - scrollPos.top;
      const lineText = lines[l - 1] || '';

      if (l === startLine) {
        const leftOffset = getColumnOffset(lineText, startCol, charWidth);
        const endLineOffset = getColumnOffset(lineText, lineText.length + 1, charWidth);
        const width = Math.max(charWidth * 0.5, endLineOffset - leftOffset);
        const left = leftOffset + PADDING_LEFT - scrollPos.left;
        boxes.push({ top, left, width, height: LINE_HEIGHT });
      } else if (l === endLine) {
        const left = PADDING_LEFT - scrollPos.left;
        const rightOffset = getColumnOffset(lineText, endCol, charWidth);
        const width = Math.max(charWidth * 0.5, rightOffset);
        boxes.push({ top, left, width, height: LINE_HEIGHT });
      } else {
        const left = PADDING_LEFT - scrollPos.left;
        const fullLineWidth = Math.max(charWidth, getColumnOffset(lineText, lineText.length + 1, charWidth));
        boxes.push({ top, left, width: fullLineWidth, height: LINE_HEIGHT });
      }
    }
  }

  return boxes;
}

function getPrismLanguage(lang: string): string {
  const map: Record<string, string> = {
    python: 'python',
    py: 'python',
    javascript: 'javascript',
    js: 'javascript',
    typescript: 'typescript',
    ts: 'typescript',
    cpp: 'cpp',
    c: 'c',
    html: 'markup',
    css: 'css',
    sql: 'sql',
    json: 'json',
    bash: 'bash',
  };
  return map[lang.toLowerCase()] || 'javascript';
}

function highlightSyntax(code: string, lang: string): string {
  const prismLang = getPrismLanguage(lang);
  const grammar = Prism.languages[prismLang] || Prism.languages.javascript;
  if (!grammar) return code;
  return Prism.highlight(code, grammar, prismLang);
}

export const CodeIDE: React.FC<CodeIDEProps> = ({
  roomId,
  myUserId,
  userName,
  userRole,
  userColor,
  userAvatar = '🎓',
  participants = {},
  onBackToBoard,
  onSendPlotToBoard,
}) => {
  const [files, setFiles] = useState<CodeFile[]>(() => {
    try {
      const saved = localStorage.getItem(`tutorboard_ide_files_${roomId}`);
      return saved ? JSON.parse(saved) : DEFAULT_FILES;
    } catch {
      return DEFAULT_FILES;
    }
  });
  const [activeFileId, setActiveFileId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(`tutorboard_ide_active_file_${roomId}`);
      return saved || 'main-py';
    } catch {
      return 'main-py';
    }
  });
  const [output, setOutput] = useState<string>(() => {
    try {
      return localStorage.getItem(`tutorboard_ide_output_${roomId}`) || '';
    } catch {
      return '';
    }
  });
  const [plots, setPlots] = useState<CodePlot[]>(() => {
    try {
      const saved = localStorage.getItem(`tutorboard_ide_plots_${roomId}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [activePlotId, setActivePlotId] = useState<string>('');
  const [showPlotViewer, setShowPlotViewer] = useState<boolean>(false);
  const [copiedPlotId, setCopiedPlotId] = useState<string | null>(null);

  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [otherCursors, setOtherCursors] = useState<Record<string, CodeCursor>>({});
  const [newFileName, setNewFileName] = useState<string>('');
  const [newFileLang, setNewFileLang] = useState<string>('python');
  const [showNewFileModal, setShowNewFileModal] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  // Microphone state
  const [isMicMuted, setIsMicMuted] = useState<boolean>(() => voiceManager.getIsMuted());
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);

  // Sync microphone state and speaking status
  useEffect(() => {
    const syncMute = () => {
      setIsMicMuted(voiceManager.getIsMuted());
    };
    syncMute();
    const interval = setInterval(syncMute, 400);

    voiceManager.setSpeakingCallback((speaking) => {
      setIsSpeaking(speaking);
    });

    return () => {
      clearInterval(interval);
    };
  }, []);

  const handleToggleMic = () => {
    const nextMuted = voiceManager.toggleMute();
    setIsMicMuted(nextMuted);
  };

  // Persist files, activeFileId, output, and plots
  useEffect(() => {
    try {
      localStorage.setItem(`tutorboard_ide_files_${roomId}`, JSON.stringify(files));
    } catch {}
  }, [files, roomId]);

  useEffect(() => {
    try {
      localStorage.setItem(`tutorboard_ide_active_file_${roomId}`, activeFileId);
    } catch {}
  }, [activeFileId, roomId]);

  useEffect(() => {
    try {
      localStorage.setItem(`tutorboard_ide_output_${roomId}`, output);
    } catch {}
  }, [output, roomId]);

  useEffect(() => {
    try {
      localStorage.setItem(`tutorboard_ide_plots_${roomId}`, JSON.stringify(plots));
    } catch {}
  }, [plots, roomId]);

  // Terminal vs Output vs Plots Console Tab Switcher State
  const [activeBottomTab, setActiveBottomTab] = useState<'output' | 'terminal' | 'plots'>('output');
  const [terminalLogs, setTerminalLogs] = useState<
    Array<{
      id: string;
      cmd: string;
      output: string;
      exitCode: number;
      time: string;
    }>
  >([
    {
      id: 'init-1',
      cmd: 'python3 --version && pip --version',
      output: 'Python 3.10.12\npip 23.0.1 (готов к установке пакетов через pip install <name>)',
      exitCode: 0,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    },
  ]);
  const [terminalInput, setTerminalInput] = useState<string>('');
  const [isTerminalExecuting, setIsTerminalExecuting] = useState<boolean>(false);
  const [terminalHistory, setTerminalHistory] = useState<string[]>([]);
  const [historyPointer, setHistoryPointer] = useState<number>(-1);
  const terminalScrollRef = useRef<HTMLDivElement>(null);
  const terminalInputRef = useRef<HTMLInputElement>(null);

  // Mouse cursors in IDE
  const [otherMouseCursors, setOtherMouseCursors] = useState<
    Record<
      string,
      {
        userId: string;
        x: number;
        y: number;
        userName: string;
        color: string;
        avatar?: string;
        role?: string;
        lastActive: number;
      }
    >
  >({});
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const lastMouseMoveTimeRef = useRef<number>(0);

  // Execute terminal command on live server
  const handleExecuteTerminalCommand = async (customCmd?: string) => {
    const rawCmd = customCmd !== undefined ? customCmd : terminalInput;
    const cmd = rawCmd.trim();
    if (!cmd || isTerminalExecuting) return;

    setTerminalInput('');
    setTerminalHistory((prev) => [cmd, ...prev.filter((c) => c !== cmd)]);
    setHistoryPointer(-1);

    if (cmd === 'clear' || cmd === 'cls') {
      setTerminalLogs([]);
      return;
    }

    setIsTerminalExecuting(true);
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    try {
      const res = await fetch('/api/terminal/exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd, timeout: timeoutSeconds }),
      });
      const data = await res.json();
      if (data.clear) {
        setTerminalLogs([]);
      } else {
        setTerminalLogs((prev) => [
          ...prev,
          {
            id: `cmd-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            cmd,
            output: data.output || '',
            exitCode: data.exitCode ?? 0,
            time: timeStr,
          },
        ]);
      }
    } catch (err: any) {
      setTerminalLogs((prev) => [
        ...prev,
        {
          id: `cmd-${Date.now()}`,
          cmd,
          output: `Сетевая ошибка выполнения команды: ${err.message}`,
          exitCode: -1,
          time: timeStr,
        },
      ]);
    } finally {
      setIsTerminalExecuting(false);
      setTimeout(() => {
        if (terminalScrollRef.current) {
          terminalScrollRef.current.scrollTop = terminalScrollRef.current.scrollHeight;
        }
      }, 50);
    }
  };

  const handleTerminalKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleExecuteTerminalCommand();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (terminalHistory.length === 0) return;
      const nextPtr = Math.min(terminalHistory.length - 1, historyPointer + 1);
      setHistoryPointer(nextPtr);
      setTerminalInput(terminalHistory[nextPtr] || '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyPointer <= 0) {
        setHistoryPointer(-1);
        setTerminalInput('');
      } else {
        const nextPtr = historyPointer - 1;
        setHistoryPointer(nextPtr);
        setTerminalInput(terminalHistory[nextPtr] || '');
      }
    }
  };

  const handleEditorMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!editorContainerRef.current) return;
    const now = Date.now();
    if (now - lastMouseMoveTimeRef.current < 45) return;
    lastMouseMoveTimeRef.current = now;

    const rect = editorContainerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    getSocket().emit('ide:mouse:move', {
      x,
      y,
      userName,
      color: userColor,
      avatar: userAvatar,
      role: userRole,
    });
  };

  const handleEditorMouseLeave = () => {
    getSocket().emit('ide:mouse:leave');
  };

  // Terminal Resizing & Popout Window states
  const [terminalHeight, setTerminalHeight] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('tutorboard_terminal_height');
      return saved ? Math.max(70, Math.min(600, parseInt(saved, 10))) : 210;
    } catch {
      return 210;
    }
  });
  const [isResizingTerminal, setIsResizingTerminal] = useState<boolean>(false);
  const [isTerminalPoppedOut, setIsTerminalPoppedOut] = useState<boolean>(false);
  const popoutWindowRef = useRef<Window | null>(null);
  const resizeStartYRef = useRef<number>(0);
  const resizeStartHeightRef = useRef<number>(210);

  // Sync output to popout window
  useEffect(() => {
    if (isTerminalPoppedOut && popoutWindowRef.current && !popoutWindowRef.current.closed) {
      const doc = popoutWindowRef.current.document;
      const el = doc.getElementById('output-box');
      if (el) {
        if (output) {
          el.className = 'content';
          el.textContent = output;
        } else {
          el.className = 'content empty';
          el.textContent = 'Терминал пуст. Нажмите «Запустить» или Ctrl+Enter в IDE...';
        }
        el.scrollTop = el.scrollHeight;
      }
    }
  }, [output, isTerminalPoppedOut]);

  // Clean up popout window on unmount
  useEffect(() => {
    return () => {
      if (popoutWindowRef.current && !popoutWindowRef.current.closed) {
        popoutWindowRef.current.close();
      }
    };
  }, []);

  // Handle Drag to Resize Terminal
  const handleStartResize = (e: React.PointerEvent) => {
    e.preventDefault();
    setIsResizingTerminal(true);
    resizeStartYRef.current = e.clientY;
    resizeStartHeightRef.current = terminalHeight;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaY = resizeStartYRef.current - moveEvent.clientY;
      const nextHeight = Math.max(55, Math.min(window.innerHeight - 160, resizeStartHeightRef.current + deltaY));
      setTerminalHeight(nextHeight);
      try {
        localStorage.setItem('tutorboard_terminal_height', nextHeight.toString());
      } catch {}
    };

    const handlePointerUp = () => {
      setIsResizingTerminal(false);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  // Handle Popout Window (multi-monitor support)
  const handleTogglePopoutTerminal = () => {
    if (isTerminalPoppedOut) {
      if (popoutWindowRef.current && !popoutWindowRef.current.closed) {
        popoutWindowRef.current.close();
      }
      setIsTerminalPoppedOut(false);
      return;
    }

    const width = 850;
    const height = 550;
    const left = window.screenX + 60;
    const top = window.screenY + 60;

    const popout = window.open(
      '',
      `tutorboard_terminal_${roomId}`,
      `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no,resizable=yes`
    );

    if (!popout) {
      alert('Всплывающее окно заблокировано браузером. Разрешите всплывающие окна в настройках браузера, чтобы вынести консоль на второй монитор.');
      return;
    }

    popoutWindowRef.current = popout;
    setIsTerminalPoppedOut(true);

    popout.document.title = `TutorBoard — Терминал [${roomId}]`;
    popout.document.head.innerHTML = `
      <meta charset="UTF-8">
      <title>TutorBoard IDE Terminal</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          background-color: #090d13;
          color: #34d399;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: 13px;
          height: 100vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .header {
          background-color: #020617;
          padding: 10px 16px;
          border-bottom: 1px solid #1e293b;
          display: flex;
          align-items: center;
          justify-content: space-between;
          user-select: none;
        }
        .title {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #f1f5f9;
          font-weight: 700;
          font-size: 13px;
        }
        .badge {
          background-color: #064e3b;
          color: #6ee7b7;
          padding: 2px 8px;
          border-radius: 9999px;
          font-size: 11px;
          font-weight: 600;
          border: 1px solid #047857;
        }
        .actions {
          display: flex;
          gap: 8px;
        }
        button {
          background-color: #1e293b;
          color: #cbd5e1;
          border: 1px solid #334155;
          padding: 5px 12px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 11px;
          font-weight: 600;
          font-family: inherit;
          display: flex;
          align-items: center;
          gap: 5px;
          transition: all 0.15s ease;
        }
        button:hover {
          background-color: #334155;
          color: #ffffff;
        }
        button.primary {
          background-color: #2563eb;
          color: white;
          border-color: #3b82f6;
        }
        button.primary:hover {
          background-color: #1d4ed8;
        }
        .content {
          flex: 1;
          padding: 16px;
          overflow-y: auto;
          white-space: pre-wrap;
          word-break: break-word;
          line-height: 1.6;
        }
        .empty {
          color: #475569;
          font-style: italic;
        }
      </style>
    `;

    popout.document.body.innerHTML = `
      <div class="header">
        <div class="title">
          <span>💻</span>
          <span>TutorBoard Терминал</span>
          <span class="badge">Второе окно / монитор</span>
        </div>
        <div class="actions">
          <button id="btn-copy">📋 Копировать</button>
          <button id="btn-clear">🔄 Очистить</button>
          <button id="btn-dock" class="primary">📥 Прикрепить к IDE</button>
        </div>
      </div>
      <div class="content" id="output-box"></div>
    `;

    const el = popout.document.getElementById('output-box');
    if (el) {
      if (output) {
        el.className = 'content';
        el.textContent = output;
      } else {
        el.className = 'content empty';
        el.textContent = 'Терминал пуст. Нажмите «Запустить» в IDE...';
      }
    }

    popout.document.getElementById('btn-clear')?.addEventListener('click', () => {
      setOutput('');
      const box = popout.document.getElementById('output-box');
      if (box) {
        box.className = 'content empty';
        box.textContent = 'Терминал пуст. Нажмите «Запустить» в IDE...';
      }
    });

    popout.document.getElementById('btn-copy')?.addEventListener('click', () => {
      if (output) {
        popout.navigator.clipboard?.writeText(output);
        const btn = popout.document.getElementById('btn-copy');
        if (btn) {
          btn.textContent = '✓ Скопировано!';
          setTimeout(() => {
            if (btn) btn.textContent = '📋 Копировать';
          }, 1500);
        }
      }
    });

    popout.document.getElementById('btn-dock')?.addEventListener('click', () => {
      popout.close();
      setIsTerminalPoppedOut(false);
    });

    popout.onbeforeunload = () => {
      setIsTerminalPoppedOut(false);
    };
  };

  // Configurable Execution Timeout (Tutor adjustable, synchronized to all participants)
  const [timeoutSeconds, setTimeoutSeconds] = useState<number>(10);
  const [showTimeoutDropdown, setShowTimeoutDropdown] = useState<boolean>(false);
  const [customTimeoutInput, setCustomTimeoutInput] = useState<string>('');

  const handleSetTimeout = (sec: number) => {
    const cleanSec = Math.min(180, Math.max(1, Math.round(sec)));
    setTimeoutSeconds(cleanSec);
    setShowTimeoutDropdown(false);
    getSocket().emit('ide:timeout:set', { timeoutSeconds: cleanSec });
  };

  // Exact character width measurement for cursor placement
  const [charWidth, setCharWidth] = useState<number>(7.8);
  const [scrollPos, setScrollPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [currentTime, setCurrentTime] = useState<number>(() => Date.now());

  // Periodically update current time to evaluate cursor inactivity (> 3s)
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 400);
    return () => clearInterval(timer);
  }, []);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const charMeasureRef = useRef<HTMLSpanElement>(null);

  const activeFile = files.find((f) => f.id === activeFileId) || files[0];

  // Measure character width precisely with both Canvas 2D and DOM node
  useEffect(() => {
    const updateCharWidth = () => {
      let canvasW = 0;
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.font = '13px "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
          const sample = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
          canvasW = ctx.measureText(sample).width / sample.length;
        }
      } catch {}

      let domW = 0;
      if (charMeasureRef.current) {
        const rect = charMeasureRef.current.getBoundingClientRect();
        if (rect.width > 0) {
          domW = rect.width / 100;
        }
      }

      const finalW = domW > 0 ? domW : (canvasW > 0 ? canvasW : 7.8);
      setCharWidth(finalW);
    };

    updateCharWidth();
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(updateCharWidth);
    }
    window.addEventListener('resize', updateCharWidth);
    return () => window.removeEventListener('resize', updateCharWidth);
  }, []);

  // Compute syntax highlighted HTML
  const highlightedCode = useMemo(() => {
    if (!activeFile?.content) return '';
    return highlightSyntax(activeFile.content, activeFile.language);
  }, [activeFile?.content, activeFile?.language]);

  // Sync scroll between textarea, syntax overlay and line numbers
  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    const target = e.currentTarget;
    setScrollPos({ top: target.scrollTop, left: target.scrollLeft });
    if (preRef.current) {
      preRef.current.scrollTop = target.scrollTop;
      preRef.current.scrollLeft = target.scrollLeft;
    }
  };

  // Autocomplete state
  const [autocomplete, setAutocomplete] = useState<{
    suggestions: CodeSuggestion[];
    selectedIndex: number;
    position: { top: number; left: number };
    prefix: string;
    wordStart: number;
  } | null>(null);

  // Update suggestions dynamically based on current cursor
  const updateAutocomplete = (code: string, cursorIndex: number, language: string) => {
    const result = getSuggestions(code, cursorIndex, language);
    if (!result || result.suggestions.length === 0) {
      setAutocomplete(null);
      return;
    }

    const textBefore = code.substring(0, cursorIndex);
    const lines = textBefore.split('\n');
    const curLine = lines.length;
    const curCol = lines[lines.length - 1].length + 1;

    const top = curLine * LINE_HEIGHT + PADDING_TOP - scrollPos.top + 4;
    const left = Math.max(PADDING_LEFT, (curCol - 1) * charWidth + PADDING_LEFT - scrollPos.left);

    setAutocomplete((prev) => ({
      suggestions: result.suggestions,
      selectedIndex:
        prev && prev.prefix === result.prefix
          ? Math.min(prev.selectedIndex, result.suggestions.length - 1)
          : 0,
      position: { top, left },
      prefix: result.prefix,
      wordStart: result.wordStart,
    }));
  };

  // Helper to compute string diff for concurrent typing splice
  function computeSplice(oldStr: string, newStr: string) {
    let start = 0;
    while (start < oldStr.length && start < newStr.length && oldStr[start] === newStr[start]) {
      start++;
    }
    let oldEnd = oldStr.length - 1;
    let newEnd = newStr.length - 1;
    while (oldEnd >= start && newEnd >= start && oldStr[oldEnd] === newStr[newEnd]) {
      oldEnd--;
      newEnd--;
    }
    const deleteCount = Math.max(0, oldEnd - start + 1);
    const insertText = newStr.substring(start, newEnd + 1);
    return { start, deleteCount, insertText };
  }

  // Insert selected autocomplete suggestion with snippet placeholder expansion
  const handleSelectSuggestion = (item: CodeSuggestion) => {
    if (!textareaRef.current || !activeFile || !autocomplete) return;
    const el = textareaRef.current;
    const val = el.value;
    const wordStart = autocomplete.wordStart;
    const cursorIndex = el.selectionStart;

    const expansion = expandSnippet(item.insertText);
    const nextVal = val.substring(0, wordStart) + expansion.text + val.substring(cursorIndex);

    handleContentChange(nextVal);
    setAutocomplete(null);

    setTimeout(() => {
      if (textareaRef.current) {
        const targetPos = wordStart + expansion.cursorOffset;
        textareaRef.current.focus();
        if (expansion.selectionLength > 0) {
          textareaRef.current.selectionStart = targetPos;
          textareaRef.current.selectionEnd = targetPos + expansion.selectionLength;
        } else {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = targetPos;
        }
        broadcastCursorPosition();
      }
    }, 0);
  };

  // Socket listeners for real-time code changes, file creation/deletion, cursors and terminal output
  useEffect(() => {
    const socket = getSocket();

    const handleInitResponse = (data: {
      files?: CodeFile[];
      cursors?: Record<string, CodeCursor>;
      timeoutSeconds?: number;
      plots?: CodePlot[];
    }) => {
      if (data.files && data.files.length > 0) {
        setFiles(data.files);
        setActiveFileId((prev) => {
          if (data.files!.some((f) => f.id === prev)) return prev;
          return data.files![0].id;
        });
      }
      if (data.cursors) {
        setOtherCursors(data.cursors);
      }
      if (typeof data.timeoutSeconds === 'number') {
        setTimeoutSeconds(data.timeoutSeconds);
      }
      if (Array.isArray(data.plots) && data.plots.length > 0) {
        setPlots(data.plots);
        setActivePlotId(data.plots[0].id);
      }
    };

    const handlePlotAdded = (data: { plot: CodePlot; senderName?: string }) => {
      if (!data?.plot) return;
      setPlots((prev) => {
        const existingIdx = prev.findIndex((p) => p.id === data.plot.id);
        if (existingIdx >= 0) {
          const next = [...prev];
          next[existingIdx] = data.plot;
          return next;
        }
        return [...prev, data.plot];
      });
      setActivePlotId(data.plot.id);
      setShowPlotViewer(true);
    };

    const handlePlotDeleted = (data: { plotId: string }) => {
      setPlots((prev) => prev.filter((p) => p.id !== data.plotId));
    };

    const handlePlotCleared = () => {
      setPlots([]);
      setShowPlotViewer(false);
    };

    const handleTimeoutSynced = (data: { timeoutSeconds: number }) => {
      if (typeof data?.timeoutSeconds === 'number') {
        setTimeoutSeconds(data.timeoutSeconds);
      }
    };

    const handleCodePatch = (data: {
      fileId: string;
      start: number;
      deleteCount: number;
      insertText: string;
      fullContent?: string;
      senderId: string;
    }) => {
      if (data.senderId === myUserId || (socket.id && data.senderId === socket.id)) return;

      setFiles((prev) => {
        const file = prev.find((f) => f.id === data.fileId);
        if (!file) return prev;
        const nextContent =
          typeof data.fullContent === 'string'
            ? data.fullContent
            : file.content.substring(0, data.start) +
              data.insertText +
              file.content.substring(data.start + data.deleteCount);
        return prev.map((f) => (f.id === data.fileId ? { ...f, content: nextContent } : f));
      });

      // Maintain active user cursor position without jumping or conflicts
      if (data.fileId === activeFileId && textareaRef.current) {
        const el = textareaRef.current;
        const curStart = el.selectionStart;
        const curEnd = el.selectionEnd;
        const val = el.value;

        const updated =
          typeof data.fullContent === 'string'
            ? data.fullContent
            : val.substring(0, data.start) +
              data.insertText +
              val.substring(data.start + data.deleteCount);

        const delta = data.insertText.length - data.deleteCount;
        let newStart = curStart;
        let newEnd = curEnd;

        if (data.start + data.deleteCount <= curStart) {
          newStart = Math.max(0, curStart + delta);
          newEnd = Math.max(0, curEnd + delta);
        } else if (data.start >= curEnd) {
          newStart = curStart;
          newEnd = curEnd;
        } else {
          newStart = Math.min(updated.length, data.start + data.insertText.length);
          newEnd = newStart;
        }

        el.value = updated;
        requestAnimationFrame(() => {
          if (textareaRef.current) {
            textareaRef.current.selectionStart = Math.min(updated.length, Math.max(0, newStart));
            textareaRef.current.selectionEnd = Math.min(updated.length, Math.max(0, newEnd));
          }
        });
      }

      setOtherCursors((prev) => {
        if (!prev[data.senderId]) return prev;
        return {
          ...prev,
          [data.senderId]: {
            ...prev[data.senderId],
            lastActive: Date.now(),
          },
        };
      });
    };

    const handleCodeSync = (data: { fileId: string; content: string; senderId: string }) => {
      if (data.senderId === myUserId || (socket.id && data.senderId === socket.id)) return;

      setFiles((prev) =>
        prev.map((f) => (f.id === data.fileId ? { ...f, content: data.content } : f))
      );

      // Concurrent typing safeguard: maintain active user's cursor position smoothly
      if (data.fileId === activeFileId && textareaRef.current) {
        const el = textareaRef.current;
        const isFocused = document.activeElement === el;
        const curStart = el.selectionStart;
        const curEnd = el.selectionEnd;
        const oldText = el.value;
        const newText = data.content;

        if (isFocused && oldText !== newText) {
          let prefixLen = 0;
          while (
            prefixLen < oldText.length &&
            prefixLen < newText.length &&
            oldText[prefixLen] === newText[prefixLen]
          ) {
            prefixLen++;
          }

          const diff = newText.length - oldText.length;
          let newStart = curStart;
          let newEnd = curEnd;

          if (curStart > prefixLen) {
            newStart = Math.max(prefixLen, curStart + diff);
          }
          if (curEnd > prefixLen) {
            newEnd = Math.max(prefixLen, curEnd + diff);
          }

          el.value = newText;
          requestAnimationFrame(() => {
            if (textareaRef.current) {
              textareaRef.current.selectionStart = Math.min(newText.length, Math.max(0, newStart));
              textareaRef.current.selectionEnd = Math.min(newText.length, Math.max(0, newEnd));
            }
          });
        }
      }

      setOtherCursors((prev) => {
        if (!prev[data.senderId]) return prev;
        return {
          ...prev,
          [data.senderId]: {
            ...prev[data.senderId],
            lastActive: Date.now(),
          },
        };
      });
    };

    const handleFileCreated = (data: { file: CodeFile }) => {
      setFiles((prev) => {
        if (prev.some((f) => f.id === data.file.id)) return prev;
        return [...prev, data.file];
      });
    };

    const handleFileDeleted = (data: { fileId: string }) => {
      setFiles((prev) => {
        const next = prev.filter((f) => f.id !== data.fileId);
        if (activeFileId === data.fileId && next.length > 0) {
          setActiveFileId(next[0].id);
        }
        return next;
      });
    };

    const handleCursorSync = (cursor: CodeCursor) => {
      if (cursor.userId === myUserId || (socket.id && cursor.userId === socket.id)) return;
      setOtherCursors((prev) => ({
        ...prev,
        [cursor.userId]: {
          ...cursor,
          lastActive: Date.now(),
        },
      }));
    };

    const handleCursorRemoved = (data: { userId: string }) => {
      setOtherCursors((prev) => {
        const next = { ...prev };
        delete next[data.userId];
        return next;
      });
    };

    const handleOutputSync = (data: { output: string; senderName: string }) => {
      setOutput(data.output);
    };

    const handleMouseMoved = (data: {
      userId: string;
      x: number;
      y: number;
      userName: string;
      color: string;
      avatar?: string;
      role?: string;
    }) => {
      if (data.userId === myUserId || (socket.id && data.userId === socket.id)) return;
      setOtherMouseCursors((prev) => ({
        ...prev,
        [data.userId]: {
          ...data,
          lastActive: Date.now(),
        },
      }));
    };

    const handleMouseLeft = (data: { userId: string }) => {
      setOtherMouseCursors((prev) => {
        const next = { ...prev };
        delete next[data.userId];
        return next;
      });
    };

    socket.on('ide:init:response', handleInitResponse);
    socket.on('ide:code:patch', handleCodePatch);
    socket.on('ide:code:sync', handleCodeSync);
    socket.on('ide:file:created', handleFileCreated);
    socket.on('ide:file:deleted', handleFileDeleted);
    socket.on('ide:cursor:sync', handleCursorSync);
    socket.on('ide:cursor:removed', handleCursorRemoved);
    socket.on('ide:output:sync', handleOutputSync);
    socket.on('ide:plot:added', handlePlotAdded);
    socket.on('ide:plot:deleted', handlePlotDeleted);
    socket.on('ide:plot:cleared', handlePlotCleared);
    socket.on('ide:mouse:moved', handleMouseMoved);
    socket.on('ide:mouse:left', handleMouseLeft);
    socket.on('ide:timeout:synced', handleTimeoutSynced);

    socket.emit('ide:init:request');

    return () => {
      socket.off('ide:init:response', handleInitResponse);
      socket.off('ide:code:patch', handleCodePatch);
      socket.off('ide:code:sync', handleCodeSync);
      socket.off('ide:file:created', handleFileCreated);
      socket.off('ide:file:deleted', handleFileDeleted);
      socket.off('ide:cursor:sync', handleCursorSync);
      socket.off('ide:cursor:removed', handleCursorRemoved);
      socket.off('ide:output:sync', handleOutputSync);
      socket.off('ide:plot:added', handlePlotAdded);
      socket.off('ide:plot:deleted', handlePlotDeleted);
      socket.off('ide:plot:cleared', handlePlotCleared);
      socket.off('ide:mouse:moved', handleMouseMoved);
      socket.off('ide:mouse:left', handleMouseLeft);
      socket.off('ide:timeout:synced', handleTimeoutSynced);
    };
  }, [activeFileId, myUserId]);

  // Broadcast code changes
  const handleContentChange = (newContent: string) => {
    if (!activeFile) return;

    const oldContent = activeFile.content;
    const splice = computeSplice(oldContent, newContent);

    setFiles((prev) =>
      prev.map((f) => (f.id === activeFile.id ? { ...f, content: newContent } : f))
    );

    const socket = getSocket();
    const senderId = myUserId || socket.id;

    socket.emit('ide:code:patch', {
      fileId: activeFile.id,
      start: splice.start,
      deleteCount: splice.deleteCount,
      insertText: splice.insertText,
      fullContent: newContent,
      senderId,
    });

    socket.emit('ide:code:change', {
      fileId: activeFile.id,
      content: newContent,
      senderId,
    });

    if (textareaRef.current) {
      updateAutocomplete(newContent, textareaRef.current.selectionStart, activeFile.language);
    }
  };

  // Broadcast local cursor position with line, column, and selection range
  const broadcastCursorPosition = () => {
    if (!textareaRef.current || !activeFile) return;
    const el = textareaRef.current;
    const selStart = el.selectionStart;
    const selEnd = el.selectionEnd;
    const val = el.value;

    const textBeforeStart = val.substring(0, selStart);
    const startLines = textBeforeStart.split('\n');
    const lineNumber = startLines.length;
    const column = startLines[startLines.length - 1].length + 1;

    let selection: CodeSelection | null = null;
    if (selStart !== selEnd) {
      const minSel = Math.min(selStart, selEnd);
      const maxSel = Math.max(selStart, selEnd);
      const textMin = val.substring(0, minSel);
      const textMax = val.substring(0, maxSel);
      const minLines = textMin.split('\n');
      const maxLines = textMax.split('\n');

      selection = {
        startLine: minLines.length,
        startCol: minLines[minLines.length - 1].length + 1,
        endLine: maxLines.length,
        endCol: maxLines[maxLines.length - 1].length + 1,
        selectionStart: minSel,
        selectionEnd: maxSel,
      };
    }

    getSocket().emit('ide:cursor:move', {
      userId: myUserId,
      userName,
      color: userColor,
      avatar: userAvatar,
      fileId: activeFile.id,
      fileName: activeFile.name,
      lineNumber,
      column,
      selection,
    });

    // Check autocomplete suggestions
    updateAutocomplete(val, selStart, activeFile.language);
  };

  // Keyboard navigation for Autocomplete, Auto-closing brackets, and Smart Auto-indentation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const val = el.value;

    // 1. If autocomplete popup is active, capture Arrow navigation, Tab/Enter selection, and Esc
    if (autocomplete && autocomplete.suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setAutocomplete((prev) =>
          prev
            ? {
                ...prev,
                selectedIndex: (prev.selectedIndex + 1) % prev.suggestions.length,
              }
            : null
        );
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setAutocomplete((prev) =>
          prev
            ? {
                ...prev,
                selectedIndex:
                  (prev.selectedIndex - 1 + prev.suggestions.length) % prev.suggestions.length,
              }
            : null
        );
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const selected =
          autocomplete.suggestions[autocomplete.selectedIndex] || autocomplete.suggestions[0];
        if (selected) {
          handleSelectSuggestion(selected);
          return;
        }
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setAutocomplete(null);
        return;
      }
    }

    // 2. Ctrl+Space manual trigger for autocomplete
    if ((e.ctrlKey || e.metaKey) && e.key === ' ') {
      e.preventDefault();
      if (textareaRef.current && activeFile) {
        updateAutocomplete(
          textareaRef.current.value,
          textareaRef.current.selectionStart,
          activeFile.language
        );
      }
      return;
    }

    // 3. Tab & Shift+Tab indentation handling
    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        // Shift+Tab: unindent
        const lineStart = val.lastIndexOf('\n', start - 1) + 1;
        const lineText = val.substring(lineStart);
        if (lineText.startsWith('    ')) {
          const nextVal = val.substring(0, lineStart) + val.substring(lineStart + 4);
          handleContentChange(nextVal);
          setTimeout(() => {
            el.selectionStart = el.selectionEnd = Math.max(lineStart, start - 4);
            broadcastCursorPosition();
          }, 0);
        }
      } else {
        // Tab: insert 4 spaces
        const nextVal = val.substring(0, start) + '    ' + val.substring(end);
        handleContentChange(nextVal);
        setTimeout(() => {
          el.selectionStart = el.selectionEnd = start + 4;
          broadcastCursorPosition();
        }, 0);
      }
      return;
    }

    // 4. Auto-closing brackets and quotes: (), [], {}, "", '', ``
    const openBrackets: Record<string, string> = {
      '(': ')',
      '[': ']',
      '{': '}',
      '"': '"',
      "'": "'",
      '`': '`',
    };

    // Step-over closing character if user types it directly when next char already matches
    if (
      start === end &&
      (e.key === ')' ||
        e.key === ']' ||
        e.key === '}' ||
        e.key === '"' ||
        e.key === "'" ||
        e.key === '`')
    ) {
      if (val[start] === e.key) {
        e.preventDefault();
        el.selectionStart = el.selectionEnd = start + 1;
        broadcastCursorPosition();
        return;
      }
    }

    // Auto-insert closing pair or wrap selection
    if (openBrackets[e.key]) {
      const closeChar = openBrackets[e.key];
      e.preventDefault();

      if (start !== end) {
        // Wrap active selection
        const selectedText = val.substring(start, end);
        const wrapped = e.key + selectedText + closeChar;
        const nextVal = val.substring(0, start) + wrapped + val.substring(end);
        handleContentChange(nextVal);
        setTimeout(() => {
          el.selectionStart = start + 1;
          el.selectionEnd = end + 1;
          broadcastCursorPosition();
        }, 0);
      } else {
        // Insert pair and place cursor between
        const nextVal = val.substring(0, start) + e.key + closeChar + val.substring(end);
        handleContentChange(nextVal);
        setTimeout(() => {
          el.selectionStart = el.selectionEnd = start + 1;
          broadcastCursorPosition();
        }, 0);
      }
      return;
    }

    // 5. Backspace pair deletion: if cursor is between (), [], {}, "", '', ``
    if (e.key === 'Backspace' && start === end && start > 0) {
      const charBefore = val[start - 1];
      const charAfter = val[start];
      if (
        (charBefore === '(' && charAfter === ')') ||
        (charBefore === '[' && charAfter === ']') ||
        (charBefore === '{' && charAfter === '}') ||
        (charBefore === '"' && charAfter === '"') ||
        (charBefore === "'" && charAfter === "'") ||
        (charBefore === '`' && charAfter === '`')
      ) {
        e.preventDefault();
        const nextVal = val.substring(0, start - 1) + val.substring(start + 1);
        handleContentChange(nextVal);
        setTimeout(() => {
          el.selectionStart = el.selectionEnd = start - 1;
          broadcastCursorPosition();
        }, 0);
        return;
      }
    }

    // 6. Smart Auto-Indentation on Enter (Python def/if/for/class/etc. with ':' and JS/C++ '{')
    if (e.key === 'Enter') {
      e.preventDefault();
      const lineStart = val.lastIndexOf('\n', start - 1) + 1;
      const currentLine = val.substring(lineStart, start);
      const indentMatch = currentLine.match(/^(\s*)/);
      const baseIndent = indentMatch ? indentMatch[1] : '';
      const trimmedLine = currentLine.trim();

      const charBefore = val[start - 1];
      const charAfter = val[start];

      // Case A: Enter between '{' and '}' or '(' and ')'
      if ((charBefore === '{' && charAfter === '}') || (charBefore === '(' && charAfter === ')')) {
        const extraIndent = baseIndent + '    ';
        const insertText = '\n' + extraIndent + '\n' + baseIndent;
        const nextVal = val.substring(0, start) + insertText + val.substring(end);
        handleContentChange(nextVal);
        setTimeout(() => {
          el.selectionStart = el.selectionEnd = start + 1 + extraIndent.length;
          broadcastCursorPosition();
        }, 0);
        return;
      }

      // Case B: Line ends with ':' (Python def, if, for, while, class, try, except, etc.) or '{', '(', '[', '=>'
      if (
        trimmedLine.endsWith(':') ||
        trimmedLine.endsWith('{') ||
        trimmedLine.endsWith('(') ||
        trimmedLine.endsWith('[') ||
        trimmedLine.endsWith('=>')
      ) {
        const extraIndent = baseIndent + '    ';
        const insertText = '\n' + extraIndent;
        const nextVal = val.substring(0, start) + insertText + val.substring(end);
        handleContentChange(nextVal);
        setTimeout(() => {
          el.selectionStart = el.selectionEnd = start + insertText.length;
          broadcastCursorPosition();
        }, 0);
        return;
      }

      // Case C: Standard newline preserving current indentation
      const insertText = '\n' + baseIndent;
      const nextVal = val.substring(0, start) + insertText + val.substring(end);
      handleContentChange(nextVal);
      setTimeout(() => {
        el.selectionStart = el.selectionEnd = start + insertText.length;
        broadcastCursorPosition();
      }, 0);
      return;
    }
  };

  // Create new file
  const handleCreateFile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim()) return;

    const ext = LANGUAGE_EXTENSIONS[newFileLang] || 'txt';
    const fullName = newFileName.includes('.') ? newFileName.trim() : `${newFileName.trim()}.${ext}`;

    const newFile: CodeFile = {
      id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: fullName,
      language: newFileLang,
      content:
        newFileLang === 'python'
          ? `# ${fullName}\n\ndef main():\n    print("Hello from ${fullName}!")\n\nif __name__ == "__main__":\n    main()\n`
          : newFileLang === 'cpp'
          ? `// ${fullName}\n#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello from ${fullName}!" << endl;\n    return 0;\n}\n`
          : `// ${fullName}\nconsole.log("Hello from ${fullName}!");\n`,
    };

    setFiles((prev) => [...prev, newFile]);
    setActiveFileId(newFile.id);
    setShowNewFileModal(false);
    setNewFileName('');

    getSocket().emit('ide:file:create', { file: newFile });
  };

  // Delete file
  const handleDeleteFile = (fileId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (files.length <= 1) return;

    setFiles((prev) => {
      const next = prev.filter((f) => f.id !== fileId);
      if (activeFileId === fileId && next.length > 0) {
        setActiveFileId(next[0].id);
      }
      return next;
    });

    getSocket().emit('ide:file:delete', { fileId });
  };

  // Change file language
  const handleChangeLanguage = (newLang: string) => {
    if (!activeFile) return;
    const ext = LANGUAGE_EXTENSIONS[newLang] || 'txt';
    const baseName = activeFile.name.split('.')[0] || 'script';
    const newName = `${baseName}.${ext}`;

    setFiles((prev) =>
      prev.map((f) => (f.id === activeFile.id ? { ...f, language: newLang, name: newName } : f))
    );
  };

  // Real backend execution of code via /api/code/run
  const handleRunCode = async () => {
    if (!activeFile) return;
    setIsRunning(true);
    setOutput('Запуск программы на сервере...\n');

    try {
      const res = await fetch('/api/code/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: activeFile.content,
          language: activeFile.language,
          timeout: timeoutSeconds,
        }),
      });

      const data = await res.json();
      const finalOutput = data.output || 'Выполнено без вывода.';
      setOutput(finalOutput);

      getSocket().emit('ide:output:sync', {
        output: finalOutput,
        senderName: userName,
      });

      // Handle generated plots (e.g. from matplotlib plt.show() or saved images)
      if (Array.isArray(data.plots) && data.plots.length > 0) {
        setPlots((prev) => {
          const prevMap = new Map(prev.map((p) => [p.id, p]));
          data.plots.forEach((p: CodePlot) => prevMap.set(p.id, p));
          return Array.from(prevMap.values());
        });

        // Broadcast to all participants in room
        data.plots.forEach((plot: CodePlot) => {
          getSocket().emit('ide:plot:add', { plot });
        });

        // Automatically open the first generated plot in the floating viewer
        setActivePlotId(data.plots[0].id);
        setShowPlotViewer(true);
      }
    } catch (err: any) {
      const errOutput = `[Ошибка выполнения]:\n${err.message || String(err)}`;
      setOutput(errOutput);
      getSocket().emit('ide:output:sync', {
        output: errOutput,
        senderName: userName,
      });
    } finally {
      setIsRunning(false);
    }
  };

  // Plot action helpers
  const handleOpenPlot = (plotId: string) => {
    setActivePlotId(plotId);
    setShowPlotViewer(true);
  };

  const handleDeletePlot = (plotId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setPlots((prev) => prev.filter((p) => p.id !== plotId));
    getSocket().emit('ide:plot:delete', { plotId });
    if (activePlotId === plotId) {
      const remaining = plots.filter((p) => p.id !== plotId);
      if (remaining.length > 0) {
        setActivePlotId(remaining[0].id);
      } else {
        setShowPlotViewer(false);
      }
    }
  };

  const handleClearPlots = () => {
    setPlots([]);
    setShowPlotViewer(false);
    getSocket().emit('ide:plot:clear');
  };

  const handleCopyPlotImage = async (plot: CodePlot, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const res = await fetch(plot.dataUrl);
      const blob = await res.blob();
      if (navigator.clipboard && window.ClipboardItem) {
        const item = new ClipboardItem({ [blob.type || 'image/png']: blob });
        await navigator.clipboard.write([item]);
      } else {
        await navigator.clipboard.writeText(plot.dataUrl);
      }
      setCopiedPlotId(plot.id);
      setTimeout(() => setCopiedPlotId(null), 2000);
    } catch {
      try {
        await navigator.clipboard.writeText(plot.dataUrl);
        setCopiedPlotId(plot.id);
        setTimeout(() => setCopiedPlotId(null), 2000);
      } catch {}
    }
  };

  const handleDownloadPlot = (plot: CodePlot, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const a = document.createElement('a');
    a.href = plot.dataUrl;
    a.download = plot.name || 'plot.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleSendPlotToWhiteboard = (plot: CodePlot, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (onSendPlotToBoard) {
      onSendPlotToBoard({ name: plot.name, dataUrl: plot.dataUrl });
    }
  };

  // Copy code to clipboard
  const copyCode = () => {
    if (!activeFile) return;
    navigator.clipboard.writeText(activeFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Keyboard shortcut Ctrl+Enter to Run
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleRunCode();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [activeFile]);

  // Line count for gutter
  const lineCount = activeFile?.content.split('\n').length || 1;

  return (
    <div
      id="tutorboard-ide"
      className="w-full h-full flex flex-col bg-slate-950 text-slate-200 select-none overflow-hidden font-sans"
    >
      {/* Top Header - Professional & Serious Dark VS Code Theme with Avatars */}
      <header className="h-11 bg-slate-950 border-b border-slate-800/90 px-3.5 flex items-center justify-between gap-3 shrink-0">
        {/* Left: Return to Whiteboard + Project Title */}
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToBoard}
            className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5 border border-slate-800"
            title="Вернуться к интерактивной доске"
          >
            <Layers className="w-3.5 h-3.5 text-blue-400" />
            <span>Доска</span>
          </button>

          <div className="h-4 w-px bg-slate-800" />

          <div className="flex items-center gap-2">
            <Code2 className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold text-slate-200">Среда разработки</span>
            <span className="text-[11px] text-slate-500 font-mono">[{roomId}]</span>
          </div>
        </div>

        {/* Center: Collaborators Indicator with Avatars */}
        <div className="hidden sm:flex items-center gap-2 text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5 bg-slate-900/90 px-2.5 py-1 rounded-xl border border-slate-800">
            <UserAvatar
              avatar={userAvatar}
              color={userColor}
              name={userName}
              size="xs"
              className="w-4 h-4 text-[10px]"
            />
            <span className="text-slate-200 font-medium">{userName} (Вы)</span>
          </div>

          {(Object.values(otherCursors) as CodeCursor[]).map((c) => (
            <div
              key={c.userId}
              className="flex items-center gap-1.5 bg-slate-900/90 px-2.5 py-1 rounded-xl border border-slate-800"
            >
              <UserAvatar
                avatar={c.avatar || '🎓'}
                color={c.color}
                name={c.userName}
                size="xs"
                className="w-4 h-4 text-[10px]"
              />
              <span className="text-slate-300 font-medium">
                {c.userName} <span className="text-slate-500 font-mono">:{c.lineNumber}</span>
              </span>
            </div>
          ))}
        </div>

        {/* Right: Timeout Selector (Tutor control) + Language Selector + Copy + Run */}
        <div className="flex items-center gap-2 relative">
          {/* Configurable Timeout Button & Dropdown */}
          <div className="relative">
            {userRole === 'tutor' ? (
              <button
                onClick={() => setShowTimeoutDropdown((prev) => !prev)}
                title="Настроить предельное время выполнения программ (лимит до прерывания)"
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition flex items-center gap-1.5 border ${
                  showTimeoutDropdown
                    ? 'bg-amber-950/60 border-amber-500/70 text-amber-300'
                    : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300 hover:text-white'
                }`}
              >
                <Timer className="w-3.5 h-3.5 text-amber-400" />
                <span className="font-mono">{timeoutSeconds}с</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>
            ) : (
              <div
                title="Предельное время выполнения программ (управляется преподавателем)"
                className="px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 border bg-slate-900/80 border-slate-800 text-slate-400 cursor-default"
              >
                <Timer className="w-3.5 h-3.5 text-amber-400/80" />
                <span className="font-mono">{timeoutSeconds}с</span>
              </div>
            )}

            {/* Tutor Timeout Dropdown Menu */}
            {showTimeoutDropdown && userRole === 'tutor' && (
              <div className="absolute right-0 top-full mt-1.5 w-64 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-3 z-50 animate-in fade-in zoom-in-95 duration-100 font-sans">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-xs font-semibold text-slate-200">
                  <div className="flex items-center gap-1.5">
                    <Timer className="w-3.5 h-3.5 text-amber-400" />
                    <span>Лимит времени (Тайм-аут)</span>
                  </div>
                  <span className="text-[10px] text-amber-400 font-mono font-bold bg-amber-950/70 border border-amber-800/50 px-1.5 py-0.5 rounded">
                    {timeoutSeconds} сек
                  </span>
                </div>

                <p className="text-[11px] text-slate-400 mb-2.5 leading-relaxed">
                  Программы, выполняющиеся дольше лимита (например, бесконечные циклы), будут автоматически остановлены.
                </p>

                {/* Quick Presets */}
                <div className="grid grid-cols-4 gap-1 mb-3">
                  {[3, 5, 10, 15, 30, 60, 90, 120].map((sec) => (
                    <button
                      key={sec}
                      onClick={() => handleSetTimeout(sec)}
                      className={`py-1 rounded-lg text-xs font-mono font-semibold transition border ${
                        timeoutSeconds === sec
                          ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-xs'
                          : 'bg-slate-950 hover:bg-slate-800 border-slate-800 text-slate-300'
                      }`}
                    >
                      {sec}с
                    </button>
                  ))}
                </div>

                {/* Custom seconds input */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const val = parseInt(customTimeoutInput, 10);
                    if (!isNaN(val) && val >= 1) {
                      handleSetTimeout(val);
                      setCustomTimeoutInput('');
                    }
                  }}
                  className="flex items-center gap-1.5 pt-2 border-t border-slate-800/80"
                >
                  <input
                    type="number"
                    min="1"
                    max="180"
                    placeholder="Свой (сек)"
                    value={customTimeoutInput}
                    onChange={(e) => setCustomTimeoutInput(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
                  />
                  <button
                    type="submit"
                    className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold transition"
                  >
                    Задать
                  </button>
                </form>
              </div>
            )}
          </div>

          <select
            value={activeFile?.language || 'python'}
            onChange={(e) => handleChangeLanguage(e.target.value)}
            className="bg-slate-900 border border-slate-800 text-xs font-medium text-slate-200 rounded-lg px-2.5 py-1 focus:outline-none focus:border-slate-700 font-mono cursor-pointer"
          >
            <option value="python">Python 3 (.py)</option>
            <option value="javascript">JavaScript (.js)</option>
            <option value="typescript">TypeScript (.ts)</option>
            <option value="cpp">C++ 20 (.cpp)</option>
            <option value="html">HTML / CSS</option>
            <option value="sql">SQL (.sql)</option>
          </select>

          <button
            onClick={copyCode}
            title="Скопировать исходный код"
            className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg transition border border-slate-800"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={handleRunCode}
            disabled={isRunning}
            title="Запустить код (Ctrl+Enter)"
            className="px-3.5 py-1 bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5 shadow-sm"
          >
            <Play className="w-3 h-3 fill-white" />
            <span>{isRunning ? 'Выполнение...' : 'Запустить'}</span>
          </button>
        </div>
      </header>

      {/* Main IDE Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: File Tree */}
        <aside className="w-52 bg-slate-950 border-r border-slate-800/90 flex flex-col shrink-0">
          <div className="h-9 px-3 border-b border-slate-800/80 flex items-center justify-between text-[11px] font-semibold text-slate-400 tracking-wide uppercase">
            <span className="flex items-center gap-1.5">
              <FileCode className="w-3.5 h-3.5 text-slate-500" />
              <span>Файлы проекта</span>
            </span>
            <button
              onClick={() => setShowNewFileModal(true)}
              title="Создать файл"
              className="p-1 hover:bg-slate-900 text-slate-400 hover:text-slate-200 rounded transition"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5 font-mono text-xs">
            {files.map((file) => {
              const isActive = file.id === activeFileId;
              return (
                <div
                  key={file.id}
                  onClick={() => setActiveFileId(file.id)}
                  className={`group px-2.5 py-1.5 rounded-lg cursor-pointer flex items-center justify-between transition ${
                    isActive
                      ? 'bg-slate-800/90 text-white font-semibold shadow-xs'
                      : 'text-slate-400 hover:bg-slate-900/80 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <FileText
                      className={`w-3.5 h-3.5 shrink-0 ${
                        file.name.endsWith('.py')
                          ? 'text-amber-400'
                          : file.name.endsWith('.js') || file.name.endsWith('.ts')
                          ? 'text-yellow-400'
                          : file.name.endsWith('.cpp')
                          ? 'text-blue-400'
                          : 'text-slate-400'
                      }`}
                    />
                    <span className="truncate">{file.name}</span>
                  </div>

                  {files.length > 1 && (
                    <button
                      onClick={(e) => handleDeleteFile(file.id, e)}
                      title="Удалить файл"
                      className="opacity-0 group-hover:opacity-100 hover:text-rose-400 p-0.5 rounded transition"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Left Sidebar Section 2: Generated Plots / Images */}
          {plots.length > 0 && (
            <div className="border-t border-slate-800/80 flex flex-col max-h-[48%] shrink-0 bg-slate-950/60">
              <div className="h-8 px-3 bg-slate-900/60 flex items-center justify-between text-[11px] font-semibold text-amber-400 tracking-wide">
                <span className="flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                  <span>Графики ({plots.length})</span>
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleClearPlots}
                    title="Очистить все графики"
                    className="p-1 hover:bg-slate-800 text-slate-400 hover:text-rose-400 rounded transition cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>

              <div className="overflow-y-auto p-1.5 space-y-1 font-mono text-xs">
                {plots.map((plot) => {
                  const isCurrent = showPlotViewer && activePlotId === plot.id;
                  return (
                    <div
                      key={plot.id}
                      onClick={() => handleOpenPlot(plot.id)}
                      className={`group p-1.5 rounded-lg cursor-pointer flex items-center justify-between transition border ${
                        isCurrent
                          ? 'bg-amber-950/40 text-amber-200 border-amber-500/60 shadow-xs'
                          : 'bg-slate-900/70 hover:bg-slate-800/90 text-slate-300 border-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <img
                          src={plot.dataUrl}
                          alt={plot.name}
                          className="w-6 h-6 rounded object-cover border border-slate-700 bg-white shrink-0"
                        />
                        <div className="flex flex-col min-w-0">
                          <span className="truncate text-[11px] font-semibold text-white leading-tight">
                            {plot.name}
                          </span>
                          <span className="text-[9px] text-slate-400">
                            {plot.size ? `${Math.round(plot.size / 1024)} КБ` : 'График'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
                        <button
                          onClick={(e) => handleCopyPlotImage(plot, e)}
                          title="Скопировать в буфер обмена"
                          className="p-1 hover:bg-slate-700 text-slate-300 hover:text-white rounded transition"
                        >
                          {copiedPlotId === plot.id ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                        {onSendPlotToBoard && (
                          <button
                            onClick={(e) => handleSendPlotToWhiteboard(plot, e)}
                            title="Вставить на интерактивную доску"
                            className="p-1 hover:bg-indigo-900/60 text-slate-300 hover:text-indigo-300 rounded transition"
                          >
                            <Layers className="w-3 h-3" />
                          </button>
                        )}
                        <button
                          onClick={(e) => handleDeletePlot(plot.id, e)}
                          title="Удалить график"
                          className="p-1 hover:bg-rose-900/60 text-slate-400 hover:text-rose-400 rounded transition"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Left Sidebar Footer: Microphone Toggle Button + Quick shortcut info */}
          <div className="p-2 border-t border-slate-900 flex flex-col gap-2 bg-slate-950/80">
            <button
              onClick={handleToggleMic}
              title={isMicMuted ? 'Включить микрофон' : 'Заглушить микрофон'}
              className={`w-full py-2 px-2.5 rounded-xl text-xs font-medium flex items-center justify-between transition cursor-pointer border ${
                isMicMuted
                  ? 'bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border-rose-800/50'
                  : 'bg-emerald-950/50 hover:bg-emerald-900/60 text-emerald-300 border-emerald-700/60'
              }`}
            >
              <div className="flex items-center gap-2">
                <div
                  className={`w-6 h-6 rounded-lg flex items-center justify-center transition ${
                    isMicMuted
                      ? 'bg-rose-900/70 text-rose-200'
                      : isSpeaking
                      ? 'bg-emerald-500 text-white animate-pulse shadow-sm shadow-emerald-500/50'
                      : 'bg-emerald-700/80 text-emerald-100'
                  }`}
                >
                  {isMicMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-[11px] font-semibold leading-tight">
                    {isMicMuted ? 'Микрофон выкл' : 'Микрофон вкл'}
                  </span>
                  <span className="text-[9px] text-slate-400">
                    {isMicMuted ? 'Нажмите для вкл' : isSpeaking ? 'Говорите...' : 'Слушает'}
                  </span>
                </div>
              </div>
              <span
                className={`w-2 h-2 rounded-full ${
                  isMicMuted ? 'bg-rose-500' : isSpeaking ? 'bg-emerald-400 animate-ping' : 'bg-emerald-500'
                }`}
              />
            </button>

            <div className="text-[10px] text-slate-500 text-center font-mono">
              Ctrl+Enter — запуск
            </div>
          </div>
        </aside>

        {/* Center: Editor + Bottom Console Split */}
        <main className="flex-1 flex flex-col min-w-0 bg-[#0d1117]">
          {/* File Tab Bar */}
          <div className="h-8 bg-slate-950 border-b border-slate-800/80 px-3 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 font-mono">
              <span className="text-slate-200 font-semibold">{activeFile?.name}</span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-400 text-[11px]">{activeFile?.language}</span>
            </div>
            <div className="text-[11px] text-slate-500 font-mono">
              {lineCount} {lineCount === 1 ? 'строка' : 'строк'}
            </div>
          </div>

          {/* Dual-Layer Synchronized Code Editor with Prism Syntax Highlighting */}
          <div className="flex-1 flex overflow-hidden relative bg-[#0d1117]">
            {/* Gutter Line Numbers */}
            <div
              className="w-12 bg-[#090d13] border-r border-slate-800/70 select-none py-3 text-right pr-2.5 font-mono text-[13px] text-slate-600 font-medium overflow-hidden shrink-0"
              style={{ lineHeight: `${LINE_HEIGHT}px` }}
            >
              {Array.from({ length: Math.max(lineCount, 30) }).map((_, i) => (
                <div key={i}>{i + 1}</div>
              ))}
            </div>

            {/* Code Editor Container: Syntax Highlighted Layer (Background) + Input Layer (Foreground) */}
            <div
              ref={editorContainerRef}
              onMouseMove={handleEditorMouseMove}
              onMouseLeave={handleEditorMouseLeave}
              className="flex-1 relative overflow-hidden"
            >
              {/* Syntax Highlighted Background Layer */}
              <pre
                ref={preRef}
                aria-hidden="true"
                className="absolute inset-0 m-0 p-3 pointer-events-none font-mono text-[13px] select-none overflow-hidden whitespace-pre"
                style={{
                  lineHeight: `${LINE_HEIGHT}px`,
                  tabSize: 4,
                  fontFamily:
                    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                }}
              >
                <code
                  className={`language-${getPrismLanguage(activeFile?.language || 'python')}`}
                  dangerouslySetInnerHTML={{ __html: highlightedCode + '\n' }}
                />
              </pre>

              {/* Transparent Interactive Textarea Layer */}
              <textarea
                ref={textareaRef}
                value={activeFile?.content || ''}
                onChange={(e) => handleContentChange(e.target.value)}
                onKeyDown={handleKeyDown}
                onSelect={broadcastCursorPosition}
                onKeyUp={broadcastCursorPosition}
                onClick={broadcastCursorPosition}
                onScroll={handleScroll}
                spellCheck={false}
                placeholder="// Пишите код здесь..."
                className="code-editor-textarea absolute inset-0 w-full h-full bg-transparent font-mono text-[13px] p-3 resize-none focus:outline-none border-none whitespace-pre overflow-auto z-10"
                style={{
                  tabSize: 4,
                  lineHeight: `${LINE_HEIGHT}px`,
                  fontFamily:
                    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                }}
              />

              {/* Remote Selections Overlay */}
              {(Object.values(otherCursors) as CodeCursor[]).map((c) => {
                if (c.fileId && c.fileId !== activeFile?.id) return null;
                if (!c.selection) return null;

                const color = getDistinctRemoteColor(c.color, userColor, c.userId);
                const boxes = calculateSelectionBoxes(
                  c.selection,
                  activeFile?.content || '',
                  charWidth,
                  scrollPos
                );

                return (
                  <React.Fragment key={`sel-${c.userId}`}>
                    {boxes.map((box, bIdx) => (
                      <div
                        key={`sel-${c.userId}-${bIdx}`}
                        className="absolute pointer-events-none transition-all duration-75 z-15 rounded-[2px]"
                        style={{
                          top: `${box.top}px`,
                          left: `${box.left}px`,
                          width: `${box.width}px`,
                          height: `${box.height}px`,
                          backgroundColor: `${color}40`,
                        }}
                      />
                    ))}
                  </React.Fragment>
                );
              })}

              {/* Hidden Char Width Measurement Node (High precision 100 chars) */}
              <span
                ref={charMeasureRef}
                aria-hidden="true"
                className="absolute opacity-0 pointer-events-none font-mono text-[13px] whitespace-pre select-none"
                style={{
                  fontFamily:
                    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                }}
              >
                {'0123456789'.repeat(10)}
              </span>

              {/* Pixel-Accurate Remote Carets Overlay (Clean Caret Bar, no distracting labels) */}
              {(Object.values(otherCursors) as CodeCursor[]).map((c) => {
                if (
                  c.fileId &&
                  activeFile?.id &&
                  c.fileId !== activeFile.id &&
                  c.fileName &&
                  activeFile?.name &&
                  c.fileName !== activeFile.name
                ) {
                  return null;
                }

                const topPos = (c.lineNumber - 1) * LINE_HEIGHT + PADDING_TOP - scrollPos.top;
                const leftPos = (c.column - 1) * charWidth + PADDING_LEFT - scrollPos.left;

                if (topPos < -40 || topPos > 3000 || leftPos < -40 || leftPos > 4000) {
                  return null;
                }

                const isInactive = c.lastActive ? currentTime - c.lastActive > 8000 : false;
                const color = getDistinctRemoteColor(c.color, userColor, c.userId);

                return (
                  <div
                    key={`cur-${c.userId}`}
                    className={`absolute pointer-events-none transition-all duration-75 z-20 ${
                      isInactive ? 'opacity-40' : 'opacity-100'
                    }`}
                    style={{
                      top: `${topPos}px`,
                      left: `${leftPos}px`,
                    }}
                  >
                    {/* Caret Line: Solid distinct-colored bar with glow */}
                    <div
                      className="w-[2.5px] h-[22px] rounded-xs shadow-xs"
                      style={{
                        backgroundColor: color,
                        boxShadow: `0 0 8px ${color}90`,
                      }}
                    />
                  </div>
                );
              })}

              {/* Remote Mouse Cursors Overlay (Board style with pointer + avatar and name badge) */}
              {(Object.values(otherMouseCursors) as Array<{
                userId: string;
                x: number;
                y: number;
                userName: string;
                color: string;
                avatar?: string;
                role?: string;
                lastActive: number;
              }>).map((mCur) => {
                const isInactive = currentTime - mCur.lastActive > 4000;
                if (isInactive) return null;
                const color = getDistinctRemoteColor(mCur.color, userColor, mCur.userId);

                return (
                  <div
                    key={`mcur-${mCur.userId}`}
                    className="absolute pointer-events-none transition-all duration-75 flex items-start gap-1 z-35 select-none"
                    style={{
                      transform: `translate(${mCur.x}px, ${mCur.y}px)`,
                    }}
                  >
                    <svg
                      className="w-4 h-4 drop-shadow-md"
                      viewBox="0 0 24 24"
                      fill={color}
                      stroke="#FFFFFF"
                      strokeWidth="1.5"
                    >
                      <path d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87a.5.5 0 0 0 .35-.85L6.35 2.86a.5.5 0 0 0-.85.35Z" />
                    </svg>
                    <span
                      className="px-2 py-0.5 rounded-lg text-[11px] font-semibold text-white shadow-md whitespace-nowrap flex items-center gap-1"
                      style={{ backgroundColor: color }}
                    >
                      <span>{mCur.avatar || (mCur.role === 'tutor' ? '👨‍🏫' : '🎓')}</span>
                      <span>{mCur.userName}</span>
                    </span>
                  </div>
                );
              })}

              {/* Autocomplete / IntelliSense Suggestions Popup */}
              {autocomplete && (
                <AutocompletePopup
                  suggestions={autocomplete.suggestions}
                  selectedIndex={autocomplete.selectedIndex}
                  onSelect={handleSelectSuggestion}
                  position={autocomplete.position}
                  prefix={autocomplete.prefix}
                />
              )}
            </div>
          </div>

          {/* Bottom Split: Terminal & Output Console with Drag Resizer & Popout Support */}
          {isTerminalPoppedOut ? (
            <div className="bg-[#090d13] border-t border-slate-800 p-3 flex items-center justify-between font-mono shrink-0">
              <div className="flex items-center gap-2.5 text-xs text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-semibold text-slate-200">🖥️ Терминал вынесен в отдельное окно</span>
                <span className="text-[11px] text-slate-500 hidden sm:inline">(можно переместить на второй монитор)</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setOutput('')}
                  className="text-xs text-slate-400 hover:text-slate-200 bg-slate-900 hover:bg-slate-800 border border-slate-700/70 px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3 h-3" /> Очистить
                </button>
                <button
                  onClick={handleTogglePopoutTerminal}
                  className="text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 px-3 py-1 rounded-lg transition shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <ArrowUpRight className="w-3.5 h-3.5" /> Прикрепить к IDE
                </button>
              </div>
            </div>
          ) : (
            <div
              style={{ height: `${terminalHeight}px` }}
              className="bg-[#090d13] border-t border-slate-800 flex flex-col shrink-0 font-mono relative transition-all"
            >
              {/* Drag Resizer Edge Bar */}
              <div
                onPointerDown={handleStartResize}
                onDoubleClick={() => setTerminalHeight((prev) => (prev > 100 ? 55 : 220))}
                title="Потяните вверх/вниз, чтобы изменить размер (двойной клик — скрыть/раскрыть)"
                className={`h-2 -mt-1 w-full cursor-row-resize flex items-center justify-center hover:bg-blue-500/40 active:bg-blue-500 transition-colors z-20 group ${
                  isResizingTerminal ? 'bg-blue-500' : ''
                }`}
              >
                <div className="w-12 h-1 bg-slate-700 group-hover:bg-blue-300 rounded-full transition-colors" />
              </div>

              {/* Tab Switcher & Action Header Bar */}
              <div className="px-3 py-1.5 bg-slate-950/90 border-b border-slate-800/80 flex items-center justify-between text-xs select-none">
                <div className="flex items-center gap-1.5">
                  {/* Output Console Tab */}
                  <button
                    onClick={() => setActiveBottomTab('output')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                      activeBottomTab === 'output'
                        ? 'bg-slate-800 text-emerald-400 border border-slate-700'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Вывод программы</span>
                    {output && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    )}
                  </button>

                  {/* Interactive Terminal Tab */}
                  <button
                    onClick={() => {
                      setActiveBottomTab('terminal');
                      setTimeout(() => terminalInputRef.current?.focus(), 50);
                    }}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                      activeBottomTab === 'terminal'
                        ? 'bg-slate-800 text-blue-400 border border-slate-700'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                    }`}
                  >
                    <Terminal className="w-3.5 h-3.5 text-blue-400" />
                    <span>Терминал (bash / pip)</span>
                    {isTerminalExecuting && (
                      <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
                    )}
                  </button>

                  {/* Generated Plots Tab */}
                  {plots.length > 0 && (
                    <button
                      onClick={() => setActiveBottomTab('plots')}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                        activeBottomTab === 'plots'
                          ? 'bg-amber-950/80 text-amber-300 border border-amber-500/50 shadow-xs'
                          : 'text-amber-400/80 hover:text-amber-300 hover:bg-slate-900'
                      }`}
                    >
                      <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                      <span>Графики</span>
                      <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-300 rounded text-[10px] font-mono font-bold">
                        {plots.length}
                      </span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {activeBottomTab === 'output' ? (
                    <button
                      onClick={() => setOutput('')}
                      title="Очистить вывод программы"
                      className="text-[11px] text-slate-400 hover:text-slate-200 transition flex items-center gap-1 font-medium px-2 py-0.5 rounded-md hover:bg-slate-900 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" /> Очистить
                    </button>
                  ) : activeBottomTab === 'terminal' ? (
                    <button
                      onClick={() => setTerminalLogs([])}
                      title="Очистить терминал"
                      className="text-[11px] text-slate-400 hover:text-slate-200 transition flex items-center gap-1 font-medium px-2 py-0.5 rounded-md hover:bg-slate-900 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" /> Очистить
                    </button>
                  ) : (
                    <button
                      onClick={handleClearPlots}
                      title="Очистить графики"
                      className="text-[11px] text-slate-400 hover:text-rose-300 transition flex items-center gap-1 font-medium px-2 py-0.5 rounded-md hover:bg-slate-900 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" /> Очистить все
                    </button>
                  )}

                  <button
                    onClick={handleTogglePopoutTerminal}
                    title="Вынести в отдельное окно для работы на втором мониторе"
                    className="text-[11px] text-blue-400 hover:text-blue-300 bg-blue-950/60 hover:bg-blue-900/60 border border-blue-800/60 px-2 py-0.5 rounded-md transition flex items-center gap-1 font-semibold cursor-pointer"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Вынести в окно</span>
                  </button>
                </div>
              </div>

              {/* Tab 1: Program Run Output */}
              {activeBottomTab === 'output' && (
                <div className="flex-1 p-3 text-[12px] overflow-y-auto select-text text-emerald-400 whitespace-pre-wrap leading-relaxed flex flex-col gap-3">
                  {/* Quick Plots Banner in Output if plots exist */}
                  {plots.length > 0 && (
                    <div className="p-2.5 bg-slate-900/90 border border-amber-500/40 rounded-xl flex items-center justify-between gap-3 text-slate-200 shrink-0">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="p-1.5 bg-amber-500/10 text-amber-400 rounded-lg shrink-0">
                          <ImageIcon className="w-4 h-4" />
                        </div>
                        <div className="truncate">
                          <div className="font-semibold text-xs text-amber-300 flex items-center gap-1.5">
                            <span>Сгенерировано графиков: {plots.length}</span>
                          </div>
                          <span className="text-[11px] text-slate-400 truncate block">
                            Нажмите на график, чтобы раскрыть, переместить или скопировать
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleOpenPlot(plots[plots.length - 1].id)}
                          className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-slate-950 font-semibold rounded-lg text-xs transition flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Открыть график</span>
                        </button>
                        <button
                          onClick={() => setActiveBottomTab('plots')}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-lg text-xs border border-slate-700 transition cursor-pointer"
                        >
                          Все графики
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex-1">
                    {output ? (
                      output
                    ) : (
                      <div className="text-slate-600 flex flex-col gap-1">
                        <span>Нажмите «Запустить» или Ctrl+Enter для выполнения программы...</span>
                        <span className="text-[11px] text-slate-700">
                          (Переключитесь на вкладку «Терминал», чтобы установить библиотеки через pip install)
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tab 2: Interactive Real Terminal (Pip, Bash, Python) */}
              {activeBottomTab === 'terminal' && (
                <div className="flex-1 flex flex-col min-h-0 bg-[#070b10]">
                  {/* Quick Command Chips */}
                  <div className="px-2.5 py-1.5 bg-slate-950/80 border-b border-slate-800/60 flex items-center gap-1.5 overflow-x-auto text-[11px] shrink-0 no-scrollbar">
                    <span className="text-slate-500 font-semibold mr-1 text-[10px] shrink-0 flex items-center gap-1">
                      <Box className="w-3 h-3 text-blue-400" /> Быстрые команды:
                    </span>
                    {[
                      'pip install numpy',
                      'pip install sympy',
                      'pip install requests',
                      'pip install matplotlib',
                      'pip install pandas',
                      'pip list',
                      'python main.py',
                    ].map((cmd) => (
                      <button
                        key={cmd}
                        onClick={() => handleExecuteTerminalCommand(cmd)}
                        disabled={isTerminalExecuting}
                        className="px-2 py-0.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-300 hover:text-blue-300 border border-slate-800 hover:border-blue-500/50 rounded text-[10.5px] whitespace-nowrap transition cursor-pointer flex items-center gap-1"
                      >
                        <Download className="w-2.5 h-2.5 text-blue-400" />
                        <span>{cmd}</span>
                      </button>
                    ))}
                  </div>

                  {/* Terminal Log Stream */}
                  <div
                    ref={terminalScrollRef}
                    className="flex-1 p-3 text-[12px] overflow-y-auto font-mono select-text flex flex-col gap-2.5"
                  >
                    {terminalLogs.map((log) => (
                      <div key={log.id} className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2 text-[11px]">
                          <span className="text-emerald-400 font-bold">$</span>
                          <span className="text-slate-200 font-semibold">{log.cmd}</span>
                          <span className="text-slate-600 text-[10px] ml-auto">{log.time}</span>
                          {log.exitCode === 0 ? (
                            <span className="text-[10px] text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-1 rounded flex items-center gap-0.5">
                              <CheckCircle2 className="w-2.5 h-2.5" /> 0
                            </span>
                          ) : (
                            <span className="text-[10px] text-rose-400 bg-rose-950/60 border border-rose-800/60 px-1 rounded flex items-center gap-0.5">
                              <AlertCircle className="w-2.5 h-2.5" /> {log.exitCode}
                            </span>
                          )}
                        </div>
                        {log.output && (
                          <pre className="text-slate-300 text-[11.5px] whitespace-pre-wrap pl-3 border-l border-slate-800/80 leading-relaxed break-words font-mono mt-0.5">
                            {log.output}
                          </pre>
                        )}
                      </div>
                    ))}

                    {isTerminalExecuting && (
                      <div className="flex items-center gap-2 text-[11px] text-blue-400 animate-pulse pl-1">
                        <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
                        <span>Выполняется команда...</span>
                      </div>
                    )}
                  </div>

                  {/* Command Input Prompt */}
                  <div className="p-2 bg-slate-950 border-t border-slate-800/90 flex items-center gap-2 shrink-0">
                    <span className="text-emerald-400 font-bold text-xs select-none pl-1">$</span>
                    <input
                      ref={terminalInputRef}
                      type="text"
                      value={terminalInput}
                      onChange={(e) => setTerminalInput(e.target.value)}
                      onKeyDown={handleTerminalKeyDown}
                      placeholder="pip install sympy, python main.py, pip list, ls, clear..."
                      disabled={isTerminalExecuting}
                      className="flex-1 bg-transparent text-slate-100 font-mono text-[12px] focus:outline-none placeholder-slate-600"
                    />
                    <button
                      onClick={() => handleExecuteTerminalCommand()}
                      disabled={isTerminalExecuting || !terminalInput.trim()}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded text-xs font-semibold transition cursor-pointer flex items-center gap-1 shadow-xs"
                    >
                      {isTerminalExecuting ? 'Выполняется...' : 'Выполнить'}
                    </button>
                  </div>
                </div>
              )}

              {/* Tab 3: Generated Plots Gallery Tab */}
              {activeBottomTab === 'plots' && (
                <div className="flex-1 p-3 bg-[#080d14] overflow-y-auto">
                  {plots.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-2 p-6 text-center">
                      <ImageIcon className="w-8 h-8 text-slate-600" />
                      <span className="text-xs">Графики еще не были созданы.</span>
                      <span className="text-[11px] text-slate-600 font-mono">
                        Запустите Python-код с matplotlib (plt.show() или plt.savefig('chart.png'))
                      </span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {plots.map((plot) => (
                        <div
                          key={plot.id}
                          className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-lg flex flex-col group hover:border-amber-500/50 transition"
                        >
                          <div
                            onClick={() => handleOpenPlot(plot.id)}
                            className="relative aspect-[4/3] bg-white flex items-center justify-center p-2 cursor-pointer overflow-hidden"
                          >
                            <img
                              src={plot.dataUrl}
                              alt={plot.name}
                              className="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform"
                            />
                            <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition">
                              <span className="px-2.5 py-1 bg-amber-500 text-slate-950 font-semibold text-[11px] rounded-lg shadow flex items-center gap-1">
                                <Maximize2 className="w-3 h-3" /> Раскрыть
                              </span>
                            </div>
                          </div>

                          <div className="p-2.5 bg-slate-950/90 flex flex-col gap-1.5 border-t border-slate-800/80">
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-mono text-xs font-semibold text-white truncate">
                                {plot.name}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {plot.size ? `${Math.round(plot.size / 1024)} КБ` : ''}
                              </span>
                            </div>

                            <div className="flex items-center gap-1 pt-1 border-t border-slate-800/60">
                              <button
                                onClick={(e) => handleCopyPlotImage(plot, e)}
                                title="Скопировать изображение"
                                className="flex-1 py-1 px-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg text-[11px] font-medium border border-slate-800 transition flex items-center justify-center gap-1 cursor-pointer"
                              >
                                {copiedPlotId === plot.id ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-400" />
                                    <span className="text-emerald-400">Скопировано</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3" />
                                    <span>Копировать</span>
                                  </>
                                )}
                              </button>

                              {onSendPlotToBoard && (
                                <button
                                  onClick={(e) => handleSendPlotToWhiteboard(plot, e)}
                                  title="Вставить на интерактивную доску"
                                  className="p-1 bg-indigo-950/60 hover:bg-indigo-900/80 text-indigo-300 border border-indigo-800/60 rounded-lg text-[11px] transition cursor-pointer"
                                >
                                  <Layers className="w-3.5 h-3.5" />
                                </button>
                              )}

                              <button
                                onClick={(e) => handleDownloadPlot(plot, e)}
                                title="Скачать файл PNG"
                                className="p-1 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 rounded-lg text-[11px] transition cursor-pointer"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={(e) => handleDeletePlot(plot.id, e)}
                                title="Удалить"
                                className="p-1 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 rounded-lg text-[11px] transition cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* New File Modal */}
      {showNewFileModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-[200]">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 max-w-sm w-full shadow-2xl animate-in zoom-in-95 font-sans">
            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <FilePlus2 className="w-4 h-4 text-blue-400" /> Создать новый файл
            </h3>

            <form onSubmit={handleCreateFile} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Имя файла:</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  placeholder="например: script, algo, task"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Язык программирования:</label>
                <select
                  value={newFileLang}
                  onChange={(e) => setNewFileLang(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono cursor-pointer"
                >
                  <option value="python">Python (.py)</option>
                  <option value="javascript">JavaScript (.js)</option>
                  <option value="typescript">TypeScript (.ts)</option>
                  <option value="cpp">C++ (.cpp)</option>
                  <option value="html">HTML / CSS (.html)</option>
                  <option value="sql">SQL (.sql)</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewFileModal(false)}
                  className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl text-xs transition"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl text-xs transition shadow-md shadow-blue-600/30"
                >
                  Создать
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Hidden character width measuring element */}
      <span
        ref={charMeasureRef}
        aria-hidden="true"
        className="invisible absolute pointer-events-none font-mono text-[13px] whitespace-pre"
        style={{
          fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        }}
      >
        0123456789
      </span>

      {/* Floating Interactive Plot Viewer Window (Draggable, Zoomable, Copyable, Export to Board) */}
      {showPlotViewer && plots.length > 0 && (
        <FloatingPlotViewer
          plots={plots}
          activePlotId={activePlotId || plots[0].id}
          onSelectPlot={(id) => setActivePlotId(id)}
          onClose={() => setShowPlotViewer(false)}
          onDeletePlot={handleDeletePlot}
          onSendToWhiteboard={
            onSendPlotToBoard
              ? (plot) => onSendPlotToBoard({ name: plot.name, dataUrl: plot.dataUrl })
              : undefined
          }
        />
      )}
    </div>
  );
};
