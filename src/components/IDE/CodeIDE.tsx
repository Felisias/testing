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
import { CodeFile, CodeCursor } from '../../types/extra';
import { Participant } from '../../types';
import { UserAvatar } from '../Common/UserAvatar';
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
}

const DEFAULT_FILES: CodeFile[] = [
  {
    id: 'main-py',
    name: 'main.py',
    language: 'python',
    content: `# Занятие по программированию: Python 🐍

def solve():
    print("Привет из среды разработки TutorBoard! 🚀")
    numbers = [5, 2, 9, 1, 7, 3, 8]
    print(f"Исходный список: {numbers}")
    print(f"Отсортированный: {sorted(numbers)}")
    
    # Пример вычисления факториала
    def factorial(n: int) -> int:
        return 1 if n <= 1 else n * factorial(n - 1)
    
    for i in range(1, 6):
        print(f"Факториал {i}! = {factorial(i)}")

if __name__ == "__main__":
    solve()
`,
  },
  {
    id: 'index-js',
    name: 'solution.js',
    language: 'javascript',
    content: `// Решение алгоритмической задачи на JavaScript ⚡
function binarySearch(arr, target) {
  let left = 0;
  let right = arr.length - 1;
  
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    if (arr[mid] === target) return mid;
    if (arr[mid] < target) left = mid + 1;
    else right = mid - 1;
  }
  return -1;
}

const numbers = [1, 3, 5, 7, 9, 11, 15, 20];
console.log("Исходный массив:", numbers);
console.log("Поиск числа 7 -> Индекс:", binarySearch(numbers, 7));
console.log("Поиск числа 12 -> Индекс:", binarySearch(numbers, 12));
`,
  },
  {
    id: 'sol-cpp',
    name: 'task.cpp',
    language: 'cpp',
    content: `// C++ Решение задачи 🚀
#include <iostream>
#include <vector>
#include <algorithm>

using namespace std;

int main() {
    vector<int> a = {4, 1, 8, 3, 9, 2};
    sort(a.begin(), a.end());
    
    cout << "Sorted Array: ";
    for (int x : a) {
        cout << x << " ";
    }
    cout << endl;
    return 0;
}
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
}) => {
  const [files, setFiles] = useState<CodeFile[]>(DEFAULT_FILES);
  const [activeFileId, setActiveFileId] = useState<string>('main-py');
  const [output, setOutput] = useState<string>('');
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [otherCursors, setOtherCursors] = useState<Record<string, CodeCursor>>({});
  const [newFileName, setNewFileName] = useState<string>('');
  const [newFileLang, setNewFileLang] = useState<string>('python');
  const [showNewFileModal, setShowNewFileModal] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  // Exact character width measurement for cursor placement
  const [charWidth, setCharWidth] = useState<number>(7.8);
  const [scrollPos, setScrollPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const charMeasureRef = useRef<HTMLSpanElement>(null);

  const activeFile = files.find((f) => f.id === activeFileId) || files[0];

  // Measure character width precisely on mount and window resize
  useEffect(() => {
    const updateCharWidth = () => {
      if (charMeasureRef.current) {
        const width = charMeasureRef.current.getBoundingClientRect().width / 10;
        if (width > 0) {
          setCharWidth(width);
        }
      }
    };

    updateCharWidth();
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

  // Socket listeners for real-time code changes, file creation/deletion, cursors and terminal output
  useEffect(() => {
    const socket = getSocket();

    const handleCodeSync = (data: { fileId: string; content: string; senderId: string }) => {
      if (data.senderId === myUserId) return;
      setFiles((prev) =>
        prev.map((f) => (f.id === data.fileId ? { ...f, content: data.content } : f))
      );
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
      if (cursor.userId === myUserId) return;
      setOtherCursors((prev) => ({
        ...prev,
        [cursor.userId]: cursor,
      }));
    };

    const handleOutputSync = (data: { output: string; senderName: string }) => {
      setOutput(data.output);
    };

    socket.on('ide:code:sync', handleCodeSync);
    socket.on('ide:file:created', handleFileCreated);
    socket.on('ide:file:deleted', handleFileDeleted);
    socket.on('ide:cursor:sync', handleCursorSync);
    socket.on('ide:output:sync', handleOutputSync);

    return () => {
      socket.off('ide:code:sync', handleCodeSync);
      socket.off('ide:file:created', handleFileCreated);
      socket.off('ide:file:deleted', handleFileDeleted);
      socket.off('ide:cursor:sync', handleCursorSync);
      socket.off('ide:output:sync', handleOutputSync);
    };
  }, [activeFileId, myUserId]);

  // Broadcast code changes
  const handleContentChange = (newContent: string) => {
    if (!activeFile) return;

    setFiles((prev) =>
      prev.map((f) => (f.id === activeFile.id ? { ...f, content: newContent } : f))
    );

    getSocket().emit('ide:code:change', {
      fileId: activeFile.id,
      content: newContent,
      senderId: myUserId,
    });
  };

  // Broadcast local cursor position with line and column
  const broadcastCursorPosition = () => {
    if (!textareaRef.current || !activeFile) return;
    const el = textareaRef.current;
    const selStart = el.selectionStart;
    const textBefore = el.value.substring(0, selStart);
    const lines = textBefore.split('\n');
    const lineNumber = lines.length;
    const column = lines[lines.length - 1].length + 1;

    getSocket().emit('ide:cursor:move', {
      userId: myUserId,
      userName,
      color: userColor,
      avatar: userAvatar,
      lineNumber,
      column,
    });
  };

  // Tab key handling for code indentation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const el = e.currentTarget;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const val = el.value;

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
        }),
      });

      const data = await res.json();
      const finalOutput = data.output || 'Выполнено без вывода.';
      setOutput(finalOutput);

      getSocket().emit('ide:output:sync', {
        output: finalOutput,
        senderName: userName,
      });
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
      {/* Hidden character width measurement */}
      <span
        ref={charMeasureRef}
        className="font-mono text-[13px] absolute opacity-0 pointer-events-none -z-50"
        style={{
          fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        }}
      >
        0123456789
      </span>

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

        {/* Right: Language Selector + Copy + Run */}
        <div className="flex items-center gap-2">
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

          {/* Quick shortcut info */}
          <div className="p-2 border-t border-slate-900 text-[10px] text-slate-500 text-center font-mono">
            Ctrl+Enter — запуск
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
            <div className="flex-1 relative overflow-hidden">
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

              {/* Pixel-Accurate Remote Cursors Overlay with Collaborator Avatars */}
              {(Object.values(otherCursors) as CodeCursor[]).map((c) => {
                const topPos = (c.lineNumber - 1) * LINE_HEIGHT + PADDING_TOP - scrollPos.top;
                const leftPos = (c.column - 1) * charWidth + PADDING_LEFT - scrollPos.left;

                if (topPos < 0 || topPos > 1400 || leftPos < 0 || leftPos > 2600) {
                  return null;
                }

                return (
                  <div
                    key={c.userId}
                    className="absolute pointer-events-none transition-all duration-75 z-20"
                    style={{
                      top: `${topPos}px`,
                      left: `${leftPos}px`,
                    }}
                  >
                    {/* Caret Line */}
                    <div
                      className="w-[2px] h-[22px]"
                      style={{ backgroundColor: c.color }}
                    />
                    {/* User Label Flag with Avatar */}
                    <div
                      className="absolute -top-4 left-0 text-[10px] font-mono font-semibold text-white px-1.5 py-0.2 rounded-md shadow-md whitespace-nowrap flex items-center gap-1"
                      style={{ backgroundColor: c.color }}
                    >
                      <span className="text-[10px]">{c.avatar || '🎓'}</span>
                      <span>{c.userName}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom Split: Terminal Console */}
          <div className="h-44 bg-[#090d13] border-t border-slate-800 flex flex-col shrink-0 font-mono">
            <div className="px-3.5 py-1.5 bg-slate-950 border-b border-slate-800/80 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-slate-300 font-semibold text-[11px]">
                <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                <span>Терминал / Консоль вывода</span>
              </div>
              <button
                onClick={() => setOutput('')}
                title="Очистить терминал"
                className="text-[11px] text-slate-500 hover:text-slate-300 transition flex items-center gap-1 font-medium"
              >
                <RotateCcw className="w-3 h-3" /> Очистить
              </button>
            </div>

            <div className="flex-1 p-3 text-[12px] overflow-y-auto select-text text-emerald-400 whitespace-pre-wrap leading-relaxed">
              {output ? (
                output
              ) : (
                <span className="text-slate-600">
                  Нажмите «Запустить» или Ctrl+Enter для выполнения программы...
                </span>
              )}
            </div>
          </div>
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
    </div>
  );
};
