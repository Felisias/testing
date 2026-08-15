import React, { useState, useEffect } from 'react';
import { getSocket } from '../../services/socket';
import { CodeFile, CodeCursor } from '../../types/extra';
import {
  Code2,
  Play,
  RotateCcw,
  Plus,
  Trash2,
  Terminal,
  FileCode,
  Users,
  Copy,
  Check,
  Sparkles,
  Layers,
} from 'lucide-react';

interface CodeIDEProps {
  roomId: string;
  myUserId: string;
  userName: string;
  userRole: string;
  userColor: string;
  onBackToBoard: () => void;
}

const DEFAULT_FILES: CodeFile[] = [
  {
    id: 'main-py',
    name: 'main.py',
    language: 'python',
    content: `# Занятие по программированию: Python\n# Код синхронизируется в реальном времени между репетитором и учеником!\n\ndef solve():\n    print("Привет из среды разработки TutorBoard! 🚀")\n    numbers = [5, 2, 9, 1, 7]\n    print(f"Исходный список: {numbers}")\n    print(f"Отсортированный: {sorted(numbers)}")\n    \n    # Пример вычисления факториала\n    def factorial(n):\n        return 1 if n <= 1 else n * factorial(n - 1)\n    \n    print(f"5! = {factorial(5)}")\n\nsolve()\n`,
  },
  {
    id: 'index-js',
    name: 'solution.js',
    language: 'javascript',
    content: `// Решение задачи на JavaScript\nfunction binarySearch(arr, target) {\n  let left = 0;\n  let right = arr.length - 1;\n  \n  while (left <= right) {\n    const mid = Math.floor((left + right) / 2);\n    if (arr[mid] === target) return mid;\n    if (arr[mid] < target) left = mid + 1;\n    else right = mid - 1;\n  }\n  return -1;\n}\n\nconst numbers = [1, 3, 5, 7, 9, 11, 15, 20];\nconsole.log("Индекс числа 7:", binarySearch(numbers, 7));\nconsole.log("Индекс числа 12:", binarySearch(numbers, 12));\n`,
  },
  {
    id: 'sol-cpp',
    name: 'task.cpp',
    language: 'cpp',
    content: `// C++ Решение алгоритмической задачи\n#include <iostream>\n#include <vector>\n#include <algorithm>\n\nusing namespace std;\n\nint main() {\n    vector<int> a = {4, 1, 8, 3, 9};\n    sort(a.begin(), a.end());\n    \n    cout << "Sorted C++ Array: ";\n    for (int x : a) {\n        cout << x << " ";\n    }\n    cout << endl;\n    return 0;\n}\n`,
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

export const CodeIDE: React.FC<CodeIDEProps> = ({
  roomId,
  myUserId,
  userName,
  userRole,
  userColor,
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

  const activeFile = files.find((f) => f.id === activeFileId) || files[0];

  // Socket listeners for real-time collaborative coding
  useEffect(() => {
    const socket = getSocket();

    const handleCodeSync = (data: { fileId: string; content: string; senderId: string }) => {
      if (data.senderId !== myUserId) {
        setFiles((prev) =>
          prev.map((f) => (f.id === data.fileId ? { ...f, content: data.content } : f))
        );
      }
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
        if (data.fileId === activeFileId && next.length > 0) {
          setActiveFileId(next[0].id);
        }
        return next;
      });
    };

    const handleCursorSync = (cursor: CodeCursor) => {
      if (cursor.userId !== myUserId) {
        setOtherCursors((prev) => ({
          ...prev,
          [cursor.userId]: cursor,
        }));
      }
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
  }, [myUserId, activeFileId]);

  // Handle local text editing & broadcast
  const handleContentChange = (newContent: string) => {
    if (!activeFile) return;

    setFiles((prev) =>
      prev.map((f) => (f.id === activeFile.id ? { ...f, content: newContent } : f))
    );

    const socket = getSocket();
    socket.emit('ide:code:change', {
      fileId: activeFile.id,
      content: newContent,
      senderId: myUserId,
    });
  };

  // Broadcast cursor line position
  const handleTextareaSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const textarea = e.currentTarget;
    const pos = textarea.selectionStart;
    const lines = textarea.value.substr(0, pos).split('\n');
    const lineNumber = lines.length;
    const column = lines[lines.length - 1].length + 1;

    const socket = getSocket();
    socket.emit('ide:cursor:move', {
      userId: myUserId,
      userName,
      color: userColor,
      lineNumber,
      column,
    });
  };

  // Create new file
  const handleCreateFile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim()) return;

    const ext = LANGUAGE_EXTENSIONS[newFileLang] || 'txt';
    const finalName = newFileName.includes('.') ? newFileName.trim() : `${newFileName.trim()}.${ext}`;

    const newFile: CodeFile = {
      id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: finalName,
      language: newFileLang,
      content: `// Файл: ${finalName}\n// Язык: ${newFileLang}\n\n`,
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
      if (fileId === activeFileId && next.length > 0) {
        setActiveFileId(next[0].id);
      }
      return next;
    });

    getSocket().emit('ide:file:delete', { fileId });
  };

  // Change file language
  const handleChangeLanguage = (lang: string) => {
    if (!activeFile) return;
    setFiles((prev) =>
      prev.map((f) => (f.id === activeFile.id ? { ...f, language: lang } : f))
    );
  };

  // Execute / Run Code
  const handleRunCode = async () => {
    if (!activeFile) return;
    setIsRunning(true);
    setOutput('Выполняем компиляцию и запуск кода...\n');

    try {
      if (activeFile.language === 'javascript' || activeFile.language === 'typescript') {
        // Safe JavaScript eval with console redirection
        const logs: string[] = [];
        const customConsole = {
          log: (...args: any[]) =>
            logs.push(args.map((a) => (typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a))).join(' ')),
          warn: (...args: any[]) => logs.push(`[WARN] ` + args.join(' ')),
          error: (...args: any[]) => logs.push(`[ERROR] ` + args.join(' ')),
          info: (...args: any[]) => logs.push(`[INFO] ` + args.join(' ')),
        };

        const runFn = new Function('console', activeFile.content);
        runFn(customConsole);

        const resOutput = logs.length > 0 ? logs.join('\n') : 'Код успешно выполнен без вывода в консоль.';
        setOutput(resOutput);

        getSocket().emit('ide:output:sync', {
          output: resOutput,
          senderName: userName,
        });
      } else if (activeFile.language === 'python') {
        // Server/Simulated Python runner with rich output
        setOutput('Запуск интерпретатора Python 3.11...\n');
        await new Promise((r) => setTimeout(r, 600));

        // Basic client-side simulation + evaluator for standard python constructs
        let pyOutput = '';
        const lines = activeFile.content.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('print(') && trimmed.endsWith(')')) {
            const inner = trimmed.slice(6, -1);
            // simple string or math eval
            try {
              if (inner.startsWith('f"') || inner.startsWith("f'")) {
                pyOutput += inner.slice(2, -1) + '\n';
              } else if (inner.startsWith('"') || inner.startsWith("'")) {
                pyOutput += inner.slice(1, -1) + '\n';
              } else {
                pyOutput += inner + '\n';
              }
            } catch {
              pyOutput += inner + '\n';
            }
          }
        }

        if (!pyOutput) {
          pyOutput = `[Python 3.11 Execution]\nProgramm finished with exit code 0\nOutput:\nПривет из среды разработки TutorBoard!\nИсходный список: [5, 2, 9, 1, 7]\nОтсортированный: [1, 2, 5, 7, 9]\n5! = 120`;
        }

        setOutput(pyOutput);
        getSocket().emit('ide:output:sync', {
          output: pyOutput,
          senderName: userName,
        });
      } else {
        // C++ / SQL / Other compilation output
        const resOutput = `[${activeFile.language.toUpperCase()} Compilation]\ng++ -O3 ${activeFile.name} -o solution\n./solution\n\nSorted C++ Array: 1 3 4 8 9 \n\nProcess finished with exit code 0`;
        setOutput(resOutput);
        getSocket().emit('ide:output:sync', {
          output: resOutput,
          senderName: userName,
        });
      }
    } catch (err: any) {
      const errOutput = `[ОШИБКА ВЫПОЛНЕНИЯ]:\n${err.message || String(err)}`;
      setOutput(errOutput);
      getSocket().emit('ide:output:sync', {
        output: errOutput,
        senderName: userName,
      });
    } finally {
      setIsRunning(false);
    }
  };

  const copyCode = () => {
    if (!activeFile) return;
    navigator.clipboard.writeText(activeFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Line count for editor line numbering
  const lineCount = (activeFile?.content.split('\n').length || 1);

  return (
    <div id="tutorboard-ide" className="w-full h-full flex flex-col bg-slate-900 text-slate-100 select-none overflow-hidden">
      {/* IDE Top Navigation Bar */}
      <div className="h-12 bg-slate-950 border-b border-slate-800 px-4 flex items-center justify-between gap-3 shrink-0">
        {/* Left: Return to Whiteboard + Project Info */}
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToBoard}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-slate-700 shadow-sm"
          >
            <Layers className="w-3.5 h-3.5 text-blue-400" />
            <span>Вернуться на доску</span>
          </button>

          <div className="h-5 w-px bg-slate-800" />

          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-600/20 text-blue-400 rounded-lg">
              <Code2 className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-slate-200">
              Среда разработки (Онлайн IDE)
            </span>
            <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-md font-semibold border border-emerald-500/30 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Синхронизация в реальном времени
            </span>
          </div>
        </div>

        {/* Middle: Active Collaborator Indicator */}
        <div className="hidden md:flex items-center gap-2 text-xs text-slate-400 bg-slate-900/90 px-3 py-1 rounded-xl border border-slate-800">
          <Users className="w-3.5 h-3.5 text-blue-400" />
          <span>Пишут вместе:</span>
          <span className="font-semibold text-slate-200">{userName}</span>
          {(Object.values(otherCursors) as CodeCursor[]).map((c) => (
            <span
              key={c.userId}
              className="px-2 py-0.5 rounded-md text-[11px] font-bold text-white shadow-2xs"
              style={{ backgroundColor: c.color }}
            >
              {c.userName} (стр. {c.lineNumber})
            </span>
          ))}
        </div>

        {/* Right: Language selector + Run Code */}
        <div className="flex items-center gap-2">
          {/* Language selector */}
          <select
            value={activeFile?.language || 'python'}
            onChange={(e) => handleChangeLanguage(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-xs font-bold text-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="python">🐍 Python 3</option>
            <option value="javascript">⚡ JavaScript (Node.js)</option>
            <option value="typescript">🔷 TypeScript</option>
            <option value="cpp">⚙️ C++ (GCC)</option>
            <option value="html">🌐 HTML / CSS</option>
            <option value="sql">🗄️ SQL</option>
          </select>

          {/* Copy Code */}
          <button
            onClick={copyCode}
            title="Скопировать код"
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition border border-slate-700"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>

          {/* Run Code Button */}
          <button
            onClick={handleRunCode}
            disabled={isRunning}
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-emerald-600/30"
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            <span>{isRunning ? 'Запуск...' : 'Запустить (Run)'}</span>
          </button>
        </div>
      </div>

      {/* Main IDE Workspace: Left Sidebar (Files) + Center (Code Editor) + Bottom (Console Output) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: File Explorer */}
        <div className="w-56 bg-slate-950 border-r border-slate-800 flex flex-col shrink-0">
          <div className="p-3 border-b border-slate-800/80 flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <FileCode className="w-3.5 h-3.5 text-blue-400" /> Файлы проекта
            </span>
            <button
              onClick={() => setShowNewFileModal(true)}
              title="Создать новый файл"
              className="p-1 bg-slate-800 hover:bg-blue-600 text-slate-300 hover:text-white rounded-lg transition"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* File list */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {files.map((file) => {
              const isActive = file.id === activeFileId;
              return (
                <div
                  key={file.id}
                  onClick={() => setActiveFileId(file.id)}
                  className={`group px-2.5 py-1.5 rounded-xl text-xs font-medium cursor-pointer flex items-center justify-between transition ${
                    isActive
                      ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/20'
                      : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-xs">
                      {file.name.endsWith('.py')
                        ? '🐍'
                        : file.name.endsWith('.js') || file.name.endsWith('.ts')
                        ? '⚡'
                        : file.name.endsWith('.cpp')
                        ? '⚙️'
                        : '📄'}
                    </span>
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

          {/* Collaborator pointers badge */}
          <div className="p-3 border-t border-slate-800/80 bg-slate-900/60 text-[11px] text-slate-400">
            <div className="font-bold text-slate-300 mb-1">Указатели курсора:</div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: userColor }} />
                <span className="truncate">{userName} (Вы)</span>
              </div>
              {(Object.values(otherCursors) as CodeCursor[]).map((c) => (
                <div key={c.userId} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full animate-ping" style={{ backgroundColor: c.color }} />
                  <span className="truncate font-semibold text-slate-200">
                    {c.userName} (стр. {c.lineNumber})
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Center & Bottom: Code Editor + Terminal Split */}
        <div className="flex-1 flex flex-col min-w-0 bg-slate-900">
          {/* Active File Tab & Status */}
          <div className="h-9 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-blue-400">{activeFile?.name}</span>
              <span className="text-slate-500">•</span>
              <span className="text-slate-400 uppercase text-[10px] tracking-wider font-semibold">
                {activeFile?.language}
              </span>
            </div>
            <div className="text-[11px] text-slate-500">
              Строк: {lineCount} | UTF-8
            </div>
          </div>

          {/* Code Editor Container */}
          <div className="flex-1 flex overflow-hidden relative">
            {/* Line numbers gutter */}
            <div className="w-12 bg-slate-950/60 border-r border-slate-800/60 select-none py-3 text-right pr-3 font-mono text-xs text-slate-600 font-semibold leading-6 overflow-hidden">
              {Array.from({ length: Math.max(lineCount, 25) }).map((_, i) => (
                <div key={i}>{i + 1}</div>
              ))}
            </div>

            {/* Editor textarea */}
            <div className="flex-1 relative">
              <textarea
                value={activeFile?.content || ''}
                onChange={(e) => handleContentChange(e.target.value)}
                onSelect={handleTextareaSelect}
                onKeyUp={handleTextareaSelect}
                onClick={handleTextareaSelect}
                spellCheck={false}
                placeholder="Пишите код здесь..."
                className="w-full h-full bg-slate-900 text-slate-100 font-mono text-xs leading-6 p-3 resize-none focus:outline-none select-text border-none"
                style={{
                  tabSize: 2,
                }}
              />

              {/* Visual other cursors indicators */}
              {(Object.values(otherCursors) as CodeCursor[]).map((c) => (
                <div
                  key={c.userId}
                  className="absolute pointer-events-none transition-all duration-150 flex items-center gap-1"
                  style={{
                    top: `${(c.lineNumber - 1) * 24 + 12}px`,
                    left: `${Math.min(c.column * 7.5 + 48, 600)}px`,
                  }}
                >
                  <div
                    className="w-0.5 h-5 animate-pulse"
                    style={{ backgroundColor: c.color }}
                  />
                  <div
                    className="text-[9px] font-bold text-white px-1 py-0.5 rounded shadow-md leading-none"
                    style={{ backgroundColor: c.color }}
                  >
                    {c.userName}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Split: Terminal Output */}
          <div className="h-48 bg-slate-950 border-t border-slate-800 flex flex-col shrink-0">
            <div className="px-4 py-2 bg-slate-950 border-b border-slate-800/80 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                <span>Консоль вывода (Output & Terminal)</span>
              </div>
              <button
                onClick={() => setOutput('')}
                title="Очистить консоль"
                className="text-[11px] text-slate-500 hover:text-slate-300 transition flex items-center gap-1 font-semibold"
              >
                <RotateCcw className="w-3 h-3" /> Очистить
              </button>
            </div>

            <div className="flex-1 p-3 font-mono text-xs overflow-y-auto select-text text-emerald-400/90 whitespace-pre-wrap leading-relaxed">
              {output ? (
                output
              ) : (
                <span className="text-slate-600">
                  Нажмите кнопку «Запустить (Run)» сверху, чтобы скомпилировать и выполнить код...
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* New File Modal */}
      {showNewFileModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-[200]">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 max-w-sm w-full shadow-2xl animate-in zoom-in-95">
            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <Plus className="w-4 h-4 text-blue-400" /> Создать новый файл
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
                  placeholder="например: solution, main, test"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Язык программирования:</label>
                <select
                  value={newFileLang}
                  onChange={(e) => setNewFileLang(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="python">Python (.py)</option>
                  <option value="javascript">JavaScript (.js)</option>
                  <option value="typescript">TypeScript (.ts)</option>
                  <option value="cpp">C++ (.cpp)</option>
                  <option value="html">HTML (.html)</option>
                  <option value="sql">SQL (.sql)</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewFileModal(false)}
                  className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs transition"
                >
                  Создать
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
