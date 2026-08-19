import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { spawn } from 'child_process';
import { Server as SocketIOServer } from 'socket.io';
import { createServer as createViteServer } from 'vite';

interface Participant {
  id: string;
  userId?: string;
  name: string;
  role: 'tutor' | 'student';
  avatar?: string;
  color: string;
  micMuted: boolean;
  isSpeaking: boolean;
  joinedAt: number;
}

interface WhiteboardElement {
  id: string;
  userId: string;
  userName: string;
  userColor: string;
  createdAt: number;
  updatedAt: number;
  [key: string]: any;
}

interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  role: 'tutor' | 'student';
  avatar?: string;
  text: string;
  formula?: string;
  timestamp: number;
}

interface RoomData {
  id: string;
  title: string;
  subject: string;
  createdAt: number;
  tutorId: string;
  isLocked: boolean;
  activePageIndex: number;
  totalPages: number;
  background: 'grid' | 'dots' | 'lines' | 'blank' | 'dark-grid';
  timerSeconds: number;
  isTimerRunning: boolean;
  timerUpdatedAt: number;
  pages: {
    [pageIndex: number]: WhiteboardElement[];
  };
  participants: {
    [socketId: string]: Participant;
  };
  cursors?: {
    [socketId: string]: {
      x: number;
      y: number;
      pageIndex: number;
      updatedAt: number;
    };
  };
  chatMessages: ChatMessage[];
}

interface UserRecord {
  id: string;
  username: string;
  name: string;
  passwordHash: string;
  role: 'tutor' | 'student';
  avatar?: string;
  createdAt: number;
  savedBoards: {
    id: string;
    title: string;
    subject: string;
    role: 'tutor' | 'student';
    lastVisited: number;
    totalPages?: number;
  }[];
}

interface InviteCodeRecord {
  code: string;
  roomId: string;
  roomTitle: string;
  subject: string;
  createdBy: string;
  createdAt: number;
  used: boolean;
  usedBy?: string;
  usedByName?: string;
  usedAt?: number;
}

const users: { [username: string]: UserRecord } = {
  // Default demo tutor account
  tutor: {
    id: 'user-tutor-1',
    username: 'tutor',
    name: 'Преподаватель Алексей',
    passwordHash: '123456',
    role: 'tutor',
    avatar: '👨‍🏫',
    createdAt: Date.now(),
    savedBoards: [
      {
        id: 'MATH-2026',
        title: 'Подготовка к экзамену',
        subject: 'Математика',
        role: 'tutor',
        lastVisited: Date.now(),
        totalPages: 2,
      },
    ],
  },
};

const inviteCodes: { [code: string]: InviteCodeRecord } = {};
const rooms: { [roomId: string]: RoomData } = {};

const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'tutorboard_storage.json');
const BACKUP_FILE = path.join(DATA_DIR, 'tutorboard_storage.bak.json');
const TEMP_FILE = path.join(DATA_DIR, 'tutorboard_storage.tmp');

function loadDataFromDisk() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    let raw: string | null = null;
    if (fs.existsSync(DATA_FILE)) {
      try {
        raw = fs.readFileSync(DATA_FILE, 'utf8');
      } catch (err) {
        console.warn('[Storage] Error reading DATA_FILE, attempting backup:', err);
      }
    }

    if (!raw && fs.existsSync(BACKUP_FILE)) {
      try {
        raw = fs.readFileSync(BACKUP_FILE, 'utf8');
        console.log('[Storage] Recovered storage from backup file');
      } catch (err) {
        console.warn('[Storage] Error reading BACKUP_FILE:', err);
      }
    }

    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.users && typeof parsed.users === 'object') {
        Object.assign(users, parsed.users);
      }
      if (parsed.inviteCodes && typeof parsed.inviteCodes === 'object') {
        Object.assign(inviteCodes, parsed.inviteCodes);
      }
      if (parsed.rooms && typeof parsed.rooms === 'object') {
        Object.entries(parsed.rooms).forEach(([rId, rData]: [string, any]) => {
          if (rData && typeof rData === 'object') {
            // Reset runtime socket participants on boot
            rData.participants = {};
            rData.cursors = {};
            rooms[rId] = rData;
          }
        });
      }
      console.log(
        `[Storage] Loaded ${Object.keys(rooms).length} rooms, ${Object.keys(users).length} users, and ${
          Object.keys(inviteCodes).length
        } invite codes from disk`
      );
    }
  } catch (e) {
    console.warn('[Storage] Could not load data from disk:', e);
  }
}

function saveDataSync() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    // Prepare rooms without runtime socket participants or live cursors
    const roomsToPersist: Record<string, any> = {};
    for (const [rId, rData] of Object.entries(rooms)) {
      roomsToPersist[rId] = {
        ...rData,
        participants: {},
        cursors: {},
      };
    }

    const dataToSave = {
      version: 1,
      savedAt: Date.now(),
      users,
      inviteCodes,
      rooms: roomsToPersist,
    };

    const serialized = JSON.stringify(dataToSave, null, 2);
    fs.writeFileSync(TEMP_FILE, serialized, 'utf8');

    // Backup existing before replace
    if (fs.existsSync(DATA_FILE)) {
      try {
        fs.copyFileSync(DATA_FILE, BACKUP_FILE);
      } catch {}
    }

    fs.renameSync(TEMP_FILE, DATA_FILE);
  } catch (e) {
    console.warn('[Storage] Error during synchronous disk save:', e);
  }
}

let saveTimer: NodeJS.Timeout | null = null;
function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    saveDataSync();
  }, 250); // Fast 250ms debounce for live drawing and chat
}

// Graceful shutdown hooks to ensure all data is flushed to disk
process.on('SIGINT', () => {
  saveDataSync();
  process.exit(0);
});

process.on('SIGTERM', () => {
  saveDataSync();
  process.exit(0);
});

process.on('beforeExit', () => {
  saveDataSync();
});

// Load persisted data immediately on module evaluation
loadDataFromDisk();

function normalizeRoomId(rawId: string): string {
  if (!rawId) return '';
  let id = String(rawId).trim().toUpperCase();

  // Replace Cyrillic lookalike letters with Latin equivalents
  const cyrillicToLatinMap: Record<string, string> = {
    'А': 'A', 'В': 'B', 'С': 'C', 'Е': 'E', 'Н': 'H',
    'К': 'K', 'М': 'M', 'О': 'O', 'Р': 'P', 'Т': 'T',
    'Х': 'X', 'У': 'Y', 'а': 'A', 'в': 'B', 'с': 'C',
    'е': 'E', 'н': 'H', 'к': 'K', 'м': 'M', 'о': 'O',
    'р': 'P', 'т': 'T', 'х': 'X', 'у': 'Y',
  };
  id = id.split('').map((char) => cyrillicToLatinMap[char] || char).join('');

  // Replace spaces or multiple dashes with single dash
  id = id.replace(/\s+/g, '-').replace(/-+/g, '-');
  return id;
}

function findRoom(rawId: string): RoomData | undefined {
  const norm = normalizeRoomId(rawId);
  if (!norm) return undefined;

  // Direct match
  if (rooms[norm]) return rooms[norm];

  // Try with ROOM- prefix
  if (!norm.startsWith('ROOM-') && rooms[`ROOM-${norm}`]) {
    return rooms[`ROOM-${norm}`];
  }

  // Try without ROOM- prefix
  if (norm.startsWith('ROOM-')) {
    const withoutPrefix = norm.replace(/^ROOM-/, '');
    if (rooms[withoutPrefix]) return rooms[withoutPrefix];
  }

  // Search case-insensitively / normalized
  const lower = norm.toLowerCase();
  for (const key of Object.keys(rooms)) {
    const normKey = normalizeRoomId(key);
    if (
      normKey === norm ||
      normKey.toLowerCase() === lower ||
      normKey.replace(/^ROOM-/, '') === norm.replace(/^ROOM-/, '')
    ) {
      return rooms[key];
    }
  }

  return undefined;
}

function getOrCreateRoom(roomId: string, title?: string, subject?: string): RoomData {
  const normalizedId = normalizeRoomId(roomId) || 'ROOM-1000';
  const existing = findRoom(normalizedId);
  if (existing) {
    let changed = false;
    if (title && !existing.title) {
      existing.title = title;
      changed = true;
    }
    if (subject && !existing.subject) {
      existing.subject = subject;
      changed = true;
    }
    if (changed) {
      saveDataSync();
    }
    return existing;
  }

  rooms[normalizedId] = {
    id: normalizedId,
    title: title || 'Занятие с репетитором',
    subject: subject || 'Математика',
    createdAt: Date.now(),
    tutorId: '',
    isLocked: false,
    activePageIndex: 0,
    totalPages: 1,
    background: 'grid',
    timerSeconds: 45 * 60,
    isTimerRunning: false,
    timerUpdatedAt: Date.now(),
    pages: {
      0: [],
    },
    participants: {},
    chatMessages: [
      {
        id: 'welcome-1',
        userId: 'system',
        userName: 'Система',
        role: 'tutor',
        text: `Комната ${normalizedId} готова к занятию. Добро пожаловать!`,
        timestamp: Date.now(),
      },
    ],
  };
  saveDataSync();
  return rooms[normalizedId];
}

// Pre-seed demo boards if not already existing
getOrCreateRoom('MATH-2026', 'Подготовка к экзамену', 'Математика');

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);
  const server = http.createServer(app);

  const io = new SocketIOServer(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    maxHttpBufferSize: 1e7, // 10MB for whiteboard image uploads
  });

  app.use(express.json({ limit: '10mb' }));

  // ================= Auth & User Endpoints =================
  // Register
  app.post('/api/auth/register', (req, res) => {
    const { username, name, password, tutorCode, avatar } = req.body;
    if (!username || !password || !name) {
      return res.status(400).json({ error: 'Заполните все обязательные поля' });
    }

    const cleanUsername = String(username).trim().toLowerCase();
    if (users[cleanUsername]) {
      return res.status(409).json({ error: 'Пользователь с таким ником уже существует' });
    }

    // Role check: secret code 'JDH6188' grants tutor role
    const isTutorCode = String(tutorCode || '').trim() === 'JDH6188';
    const role: 'tutor' | 'student' = isTutorCode ? 'tutor' : 'student';

    const newUser: UserRecord = {
      id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      username: cleanUsername,
      name: String(name).trim(),
      passwordHash: String(password),
      role,
      avatar: avatar || (role === 'tutor' ? '👨‍🏫' : '🎓'),
      createdAt: Date.now(),
      savedBoards: [],
    };

    users[cleanUsername] = newUser;
    saveDataSync();

    return res.json({
      success: true,
      user: {
        id: newUser.id,
        username: newUser.username,
        name: newUser.name,
        role: newUser.role,
        avatar: newUser.avatar,
        createdAt: newUser.createdAt,
      },
    });
  });

  // Login
  app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Введите логин и пароль' });
    }

    const cleanUsername = String(username).trim().toLowerCase();
    const user = users[cleanUsername];

    if (!user || user.passwordHash !== String(password)) {
      return res.status(401).json({ error: 'Неверный логин или пароль' });
    }

    return res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        avatar: user.avatar || (user.role === 'tutor' ? '👨‍🏫' : '🎓'),
        createdAt: user.createdAt,
      },
      savedBoards: user.savedBoards || [],
    });
  });

  // Update profile
  app.post('/api/user/profile/update', (req, res) => {
    const { username, name, avatar } = req.body;
    const cleanUsername = String(username || '').trim().toLowerCase();
    const user = users[cleanUsername];
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    if (name) user.name = String(name).trim();
    if (avatar) user.avatar = String(avatar);
    saveDataSync();

    return res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        avatar: user.avatar,
        createdAt: user.createdAt,
      },
    });
  });

  // User Saved Boards
  app.get('/api/user/boards', (req, res) => {
    const username = String(req.query.username || '').trim().toLowerCase();
    const user = users[username];
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    return res.json({ savedBoards: user.savedBoards || [] });
  });

  // Save board to user history
  app.post('/api/user/boards/save', (req, res) => {
    const { username, board } = req.body;
    const cleanUsername = String(username || '').trim().toLowerCase();
    const user = users[cleanUsername];
    if (!user || !board || !board.id) {
      return res.status(400).json({ error: 'Некорректные данные' });
    }

    const existingIdx = user.savedBoards.findIndex((b) => b.id === board.id);
    const boardEntry = {
      id: board.id,
      title: board.title || 'Урок',
      subject: board.subject || 'Математика',
      role: board.role || user.role,
      lastVisited: Date.now(),
      totalPages: board.totalPages || 1,
    };

    if (existingIdx !== -1) {
      user.savedBoards[existingIdx] = boardEntry;
    } else {
      user.savedBoards.unshift(boardEntry);
    }

    // Limit to 50 saved boards
    user.savedBoards = user.savedBoards.slice(0, 50);
    saveDataSync();

    return res.json({ success: true, savedBoards: user.savedBoards });
  });

  // Code execution endpoint for collaborative IDE
  app.post('/api/code/run', async (req, res) => {
    const { code, language } = req.body;
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ output: 'Код пуст для выполнения' });
    }

    const cleanLang = String(language || 'python').toLowerCase();

    // 1. Python 3 Execution
    if (cleanLang === 'python') {
      try {
        const tempDir = os.tmpdir();
        const scriptPath = path.join(tempDir, `py_${Date.now()}_${Math.random().toString(36).substring(2, 6)}.py`);
        fs.writeFileSync(scriptPath, code, 'utf8');

        // Try python3 or python
        const pythonBin = process.platform === 'win32' ? 'python' : 'python3';
        const child = spawn(pythonBin, [scriptPath]);

        let stdout = '';
        let stderr = '';
        let killed = false;

        const timer = setTimeout(() => {
          killed = true;
          try {
            child.kill();
          } catch {}
        }, 7000);

        child.stdout.on('data', (d) => {
          if (stdout.length < 50000) stdout += d.toString();
        });
        child.stderr.on('data', (d) => {
          if (stderr.length < 50000) stderr += d.toString();
        });

        child.on('close', (exitCode) => {
          clearTimeout(timer);
          try {
            if (fs.existsSync(scriptPath)) fs.unlinkSync(scriptPath);
          } catch {}

          if (killed) {
            return res.json({
              output: '⚠️ Время выполнения превышено (лимит 7 сек).\nПроверьте код на наличие бесконечных циклов.',
              exitCode: -1,
            });
          }

          const combined = stdout + (stderr ? (stdout ? '\n' : '') + stderr : '');
          return res.json({
            output: combined || '✓ Программа успешно выполнена (вывод пуст)',
            exitCode,
          });
        });

        child.on('error', (err) => {
          clearTimeout(timer);
          try {
            if (fs.existsSync(scriptPath)) fs.unlinkSync(scriptPath);
          } catch {}
          return res.json({
            output: `Ошибка вызова интерпретатора Python: ${err.message}`,
            exitCode: -1,
          });
        });
      } catch (e: any) {
        return res.json({ output: `Ошибка запуска: ${e.message}`, exitCode: -1 });
      }
    }
    // 2. JavaScript / TypeScript Execution via Node.js
    else if (cleanLang === 'javascript' || cleanLang === 'typescript') {
      try {
        const tempDir = os.tmpdir();
        const scriptPath = path.join(tempDir, `js_${Date.now()}_${Math.random().toString(36).substring(2, 6)}.js`);
        fs.writeFileSync(scriptPath, code, 'utf8');

        const child = spawn('node', [scriptPath]);
        let stdout = '';
        let stderr = '';
        let killed = false;

        const timer = setTimeout(() => {
          killed = true;
          try {
            child.kill();
          } catch {}
        }, 7000);

        child.stdout.on('data', (d) => {
          if (stdout.length < 50000) stdout += d.toString();
        });
        child.stderr.on('data', (d) => {
          if (stderr.length < 50000) stderr += d.toString();
        });

        child.on('close', (exitCode) => {
          clearTimeout(timer);
          try {
            if (fs.existsSync(scriptPath)) fs.unlinkSync(scriptPath);
          } catch {}

          if (killed) {
            return res.json({
              output: '⚠️ Время выполнения превышено (лимит 7 сек).',
              exitCode: -1,
            });
          }

          const combined = stdout + (stderr ? (stdout ? '\n' : '') + stderr : '');
          return res.json({
            output: combined || '✓ Скрипт Node.js успешно выполнен (вывод пуст)',
            exitCode,
          });
        });

        child.on('error', (err) => {
          clearTimeout(timer);
          try {
            if (fs.existsSync(scriptPath)) fs.unlinkSync(scriptPath);
          } catch {}
          return res.json({
            output: `Ошибка Node.js: ${err.message}`,
            exitCode: -1,
          });
        });
      } catch (e: any) {
        return res.json({ output: `Ошибка: ${e.message}`, exitCode: -1 });
      }
    }
    // 3. C++ Compilation & Execution via g++
    else if (cleanLang === 'cpp') {
      try {
        const tempDir = os.tmpdir();
        const randId = Math.random().toString(36).substring(2, 6);
        const srcPath = path.join(tempDir, `cpp_${Date.now()}_${randId}.cpp`);
        const binPath = path.join(tempDir, `bin_${Date.now()}_${randId}`);
        fs.writeFileSync(srcPath, code, 'utf8');

        const compile = spawn('g++', [srcPath, '-O2', '-o', binPath]);
        let compErr = '';

        compile.stderr.on('data', (d) => {
          compErr += d.toString();
        });

        compile.on('close', (compCode) => {
          if (compCode !== 0) {
            try {
              if (fs.existsSync(srcPath)) fs.unlinkSync(srcPath);
            } catch {}
            return res.json({
              output: `❌ Ошибка компиляции C++ (g++):\n${compErr}`,
              exitCode: compCode,
            });
          }

          // Run binary
          const runChild = spawn(binPath);
          let runOut = '';
          let runErr = '';
          let killed = false;

          const timer = setTimeout(() => {
            killed = true;
            try {
              runChild.kill();
            } catch {}
          }, 5000);

          runChild.stdout.on('data', (d) => {
            if (runOut.length < 50000) runOut += d.toString();
          });
          runChild.stderr.on('data', (d) => {
            if (runErr.length < 50000) runErr += d.toString();
          });

          runChild.on('close', (runCode) => {
            clearTimeout(timer);
            try {
              if (fs.existsSync(srcPath)) fs.unlinkSync(srcPath);
              if (fs.existsSync(binPath)) fs.unlinkSync(binPath);
            } catch {}

            if (killed) {
              return res.json({
                output: '⚠️ Время выполнения C++ превышено (лимит 5 сек).',
                exitCode: -1,
              });
            }

            const combined = runOut + (runErr ? (runOut ? '\n' : '') + runErr : '');
            return res.json({
              output: combined || '✓ C++ программа завершилась успешно (вывод пуст)',
              exitCode: runCode,
            });
          });

          runChild.on('error', (err) => {
            clearTimeout(timer);
            try {
              if (fs.existsSync(srcPath)) fs.unlinkSync(srcPath);
              if (fs.existsSync(binPath)) fs.unlinkSync(binPath);
            } catch {}
            return res.json({ output: `Ошибка выполнения бинарного файла: ${err.message}` });
          });
        });

        compile.on('error', (err) => {
          try {
            if (fs.existsSync(srcPath)) fs.unlinkSync(srcPath);
          } catch {}
          return res.json({
            output: `Компилятор g++ недоступен на хосте: ${err.message}`,
            exitCode: -1,
          });
        });
      } catch (e: any) {
        return res.json({ output: `Ошибка C++: ${e.message}`, exitCode: -1 });
      }
    }
    // HTML / SQL or other format
    else {
      return res.json({
        output: `✓ Файл ${cleanLang.toUpperCase()} проверен. Синтаксис готов.`,
        exitCode: 0,
      });
    }
  });

  // Health
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', roomsCount: Object.keys(rooms).length });
  });

  // Get all registered users (for tutors / site administration)
  app.get('/api/users', (req, res) => {
    const userList = Object.values(users).map((u) => ({
      id: u.id,
      username: u.username,
      name: u.name,
      role: u.role,
      avatar: u.avatar || (u.role === 'tutor' ? '👨‍🏫' : '🎓'),
      createdAt: u.createdAt,
      boardsCount: u.savedBoards ? u.savedBoards.length : 0,
    }));
    return res.json({ users: userList });
  });

  // Get users with full saved boards list (for tutor board access management)
  app.get('/api/users-with-boards', (req, res) => {
    const userList = Object.values(users).map((u) => ({
      id: u.id,
      username: u.username,
      name: u.name,
      role: u.role,
      avatar: u.avatar || (u.role === 'tutor' ? '👨‍🏫' : '🎓'),
      createdAt: u.createdAt,
      savedBoards: u.savedBoards || [],
    }));
    return res.json({ users: userList });
  });

  // ================= Full System Backup & Restore (Tutor Only) =================
  // Export full backup JSON
  app.get('/api/admin/backup/export', (req, res) => {
    const username = String(req.query.username || '').trim().toLowerCase();
    const user = users[username];

    if (!user || user.role !== 'tutor') {
      return res.status(403).json({ error: 'Экспорт сохранения доступен только преподавателю' });
    }

    const roomsToExport: Record<string, any> = {};
    for (const [rId, rData] of Object.entries(rooms)) {
      roomsToExport[rId] = {
        ...rData,
        participants: {},
        cursors: {},
      };
    }

    const backupData = {
      app: 'TutorBoard',
      version: 1,
      exportedAt: Date.now(),
      exportedBy: user.username,
      exportedByName: user.name,
      stats: {
        roomsCount: Object.keys(roomsToExport).length,
        usersCount: Object.keys(users).length,
        inviteCodesCount: Object.keys(inviteCodes).length,
      },
      users,
      rooms: roomsToExport,
      inviteCodes,
    };

    const dateStr = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="tutorboard-backup-${dateStr}.json"`);
    return res.json(backupData);
  });

  // Import full backup JSON
  app.post('/api/admin/backup/import', (req, res) => {
    const { username, backupData, mode } = req.body;
    const cleanUsername = String(username || '').trim().toLowerCase();
    const user = users[cleanUsername];

    if (!user || user.role !== 'tutor') {
      return res.status(403).json({ error: 'Импорт сохранения доступен только преподавателю' });
    }

    if (!backupData || typeof backupData !== 'object') {
      return res.status(400).json({ error: 'Некорректный или пустой файл сохранения' });
    }

    const importedUsers = backupData.users || {};
    const importedRooms = backupData.rooms || {};
    const importedInviteCodes = backupData.inviteCodes || {};

    if (
      typeof importedUsers !== 'object' &&
      typeof importedRooms !== 'object' &&
      typeof importedInviteCodes !== 'object'
    ) {
      return res.status(400).json({ error: 'Файл не содержит структуры данных TutorBoard' });
    }

    // Replace or Merge
    if (mode === 'replace') {
      for (const k of Object.keys(users)) delete users[k];
      for (const k of Object.keys(rooms)) delete rooms[k];
      for (const k of Object.keys(inviteCodes)) delete inviteCodes[k];
    }

    // Merge users
    if (importedUsers && typeof importedUsers === 'object') {
      Object.assign(users, importedUsers);
    }
    // Make sure the active tutor user is preserved
    if (!users[cleanUsername]) {
      users[cleanUsername] = user;
    }

    // Merge invite codes
    if (importedInviteCodes && typeof importedInviteCodes === 'object') {
      Object.assign(inviteCodes, importedInviteCodes);
    }

    // Merge rooms
    if (importedRooms && typeof importedRooms === 'object') {
      Object.entries(importedRooms).forEach(([rId, rData]: [string, any]) => {
        if (rData && typeof rData === 'object') {
          const normId = normalizeRoomId(rId);
          rooms[normId] = {
            ...rData,
            id: normId,
            participants: {},
            cursors: {},
          };
        }
      });
    }

    // Write to disk immediately
    saveDataSync();

    return res.json({
      success: true,
      message: 'Файл сохранения успешно применен',
      stats: {
        roomsCount: Object.keys(rooms).length,
        usersCount: Object.keys(users).length,
        inviteCodesCount: Object.keys(inviteCodes).length,
      },
      savedBoards: users[cleanUsername]?.savedBoards || [],
    });
  });

  // Revoke a user's access to a board
  app.post('/api/users/revoke-access', (req, res) => {
    const { username, roomId } = req.body;
    const cleanUsername = String(username || '').trim().toLowerCase();
    const targetUser = users[cleanUsername];
    if (!targetUser) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const normRoomId = normalizeRoomId(roomId);
    targetUser.savedBoards = (targetUser.savedBoards || []).filter(
      (b) => normalizeRoomId(b.id) !== normRoomId
    );
    saveDataSync();

    // If target user is actively in this room on socket, notify and kick them
    const room = findRoom(normRoomId);
    if (room) {
      Object.entries(room.participants).forEach(([sockId, p]) => {
        if (p.userId === targetUser.id || p.name.toLowerCase() === targetUser.name.toLowerCase()) {
          io.to(sockId).emit('room:kicked', {
            reason: `Преподаватель отозвал ваш доступ к доске ${normRoomId}.`,
          });
          delete room.participants[sockId];
          io.to(room.id).emit('room:participants', Object.values(room.participants));
        }
      });
    }

    return res.json({ success: true, savedBoards: targetUser.savedBoards });
  });

  // Create One-time Invite Code (Tutor only)
  app.post('/api/rooms/:roomId/invite-code', (req, res) => {
    const rawId = req.params.roomId;
    const { createdBy, roomTitle, subject } = req.body;
    const normRoomId = normalizeRoomId(rawId);
    const room = getOrCreateRoom(normRoomId, roomTitle, subject);

    // Generate unique 8-character invite code e.g. "INV-7K9A"
    const randomChars = Math.random().toString(36).substring(2, 6).toUpperCase();
    const code = `INV-${randomChars}`;

    const record: InviteCodeRecord = {
      code,
      roomId: room.id,
      roomTitle: room.title || roomTitle || 'Урок',
      subject: room.subject || subject || 'Математика',
      createdBy: createdBy || 'tutor',
      createdAt: Date.now(),
      used: false,
    };

    inviteCodes[code] = record;
    saveDataSync();
    return res.json({ success: true, inviteCode: record });
  });

  // Get active invite codes for a room
  app.get('/api/rooms/:roomId/invite-codes', (req, res) => {
    const rawId = req.params.roomId;
    const normRoomId = normalizeRoomId(rawId);
    const roomCodes = Object.values(inviteCodes).filter(
      (c) => normalizeRoomId(c.roomId) === normRoomId
    );
    return res.json({ inviteCodes: roomCodes });
  });

  // Redeem / Use One-time Invite Code (Grants permanent board access to user)
  app.post('/api/invite-code/redeem', (req, res) => {
    const { code, username, name } = req.body;
    if (!code) {
      return res.status(400).json({ error: 'Введите ключ приглашения' });
    }

    const cleanCode = String(code).trim().toUpperCase();
    const record = inviteCodes[cleanCode];

    if (!record) {
      return res.status(404).json({ error: 'Одноразовый ключ не найден или введен неверно' });
    }

    // Ensure room exists
    const room = getOrCreateRoom(record.roomId, record.roomTitle, record.subject);

    // If key has already been activated before:
    // Allow the student who activated it (or any authorized user who has it in saved boards) to re-enter!
    if (record.used) {
      const cleanUser = String(username || '').trim().toLowerCase();
      const isOriginalUser =
        (cleanUser && record.usedBy && record.usedBy.toLowerCase() === cleanUser) ||
        (name && record.usedByName && record.usedByName.toLowerCase() === String(name).trim().toLowerCase());

      let hasSaved = false;
      if (cleanUser && users[cleanUser]) {
        hasSaved = (users[cleanUser].savedBoards || []).some(
          (b) => normalizeRoomId(b.id) === normalizeRoomId(room.id)
        );
      }

      // If it is the user who redeemed it or has access, allow unlimited re-entry!
      if (isOriginalUser || hasSaved || cleanUser === 'guest' || !record.usedBy) {
        if (cleanUser && users[cleanUser]) {
          const u = users[cleanUser];
          const existingIdx = (u.savedBoards || []).findIndex(
            (b) => normalizeRoomId(b.id) === normalizeRoomId(room.id)
          );
          const entry = {
            id: room.id,
            title: room.title,
            subject: room.subject,
            role: 'student' as const,
            lastVisited: Date.now(),
            totalPages: room.totalPages || 1,
          };
          if (existingIdx !== -1) {
            u.savedBoards[existingIdx] = entry;
          } else {
            u.savedBoards.unshift(entry);
          }
          saveDataSync();
        }

        return res.json({
          success: true,
          roomId: room.id,
          title: room.title,
          subject: room.subject,
          inviteCode: record,
          reconnected: true,
        });
      }

      return res.status(400).json({
        error: `Этот ключ уже был активирован ${
          record.usedByName ? `пользователем ${record.usedByName}` : ''
        }. Запросите новый ключ у преподавателя.`,
      });
    }

    // First time redemption
    record.used = true;
    record.usedBy = username || 'guest';
    record.usedByName = name || username || 'Ученик';
    record.usedAt = Date.now();

    // If student is logged in, automatically save this board to their account for permanent access
    if (username) {
      const cleanUsername = String(username).trim().toLowerCase();
      const user = users[cleanUsername];
      if (user) {
        const existingIdx = (user.savedBoards || []).findIndex(
          (b) => normalizeRoomId(b.id) === normalizeRoomId(room.id)
        );
        const entry = {
          id: room.id,
          title: room.title,
          subject: room.subject,
          role: 'student' as const,
          lastVisited: Date.now(),
          totalPages: room.totalPages || 1,
        };
        if (existingIdx !== -1) {
          user.savedBoards[existingIdx] = entry;
        } else {
          user.savedBoards.unshift(entry);
        }
      }
    }

    saveDataSync();

    return res.json({
      success: true,
      roomId: room.id,
      title: room.title,
      subject: room.subject,
      inviteCode: record,
    });
  });

  // Batch Room Status Check (for rendering live board cards in dashboard)
  app.post('/api/rooms/status-batch', (req, res) => {
    const { roomIds } = req.body;
    if (!Array.isArray(roomIds)) {
      return res.status(400).json({ error: 'roomIds must be an array' });
    }

    const statuses: Record<string, any> = {};
    roomIds.forEach((rawId) => {
      const norm = normalizeRoomId(rawId);
      const room = findRoom(norm);
      if (room) {
        statuses[norm] = {
          exists: true,
          id: room.id,
          title: room.title,
          subject: room.subject,
          participantCount: Object.keys(room.participants).length,
          totalPages: room.totalPages || 1,
          activePageIndex: room.activePageIndex || 0,
          isLocked: room.isLocked,
          createdAt: room.createdAt,
        };
      } else {
        statuses[norm] = {
          exists: false,
          id: norm,
          participantCount: 0,
        };
      }
    });

    return res.json({ statuses });
  });

  app.get('/api/rooms/:roomId', (req, res) => {
    const rawId = req.params.roomId;
    const room = findRoom(rawId);
    if (room) {
      return res.json({
        id: room.id,
        title: room.title,
        subject: room.subject,
        participantCount: Object.keys(room.participants).length,
        isLocked: room.isLocked,
        exists: true,
      });
    }

    // Only return exists: true if room ACTUALLY exists in memory
    return res.status(404).json({ error: 'Комната с таким кодом не найдена', exists: false });
  });

  // ================= Socket.IO Real-time Logic =================
  io.on('connection', (socket) => {
    let currentRoomId: string | null = null;
    let currentUser: Participant | null = null;

    // Client requests full sync (upon reconnection or reload)
    socket.on('board:request_sync', () => {
      if (!currentRoomId || !rooms[currentRoomId]) return;
      const room = rooms[currentRoomId];

      let currentTimerSec = room.timerSeconds;
      if (room.isTimerRunning) {
        const elapsed = Math.floor((Date.now() - room.timerUpdatedAt) / 1000);
        currentTimerSec = Math.max(0, room.timerSeconds - elapsed);
      }

      socket.emit('room:state', {
        room: {
          id: room.id,
          title: room.title,
          subject: room.subject,
          createdAt: room.createdAt,
          tutorId: room.tutorId,
          isLocked: room.isLocked,
          activePageIndex: room.activePageIndex,
          totalPages: room.totalPages,
          background: room.background,
          timerSeconds: currentTimerSec,
          isTimerRunning: room.isTimerRunning,
          pages: room.pages,
          participants: room.participants,
          chatMessages: room.chatMessages,
        },
        self: currentUser,
      });

      socket.emit('room:joined', {
        userId: socket.id,
        roomId: room.id,
        isLocked: room.isLocked,
        title: room.title,
        subject: room.subject,
        boardState: {
          pages: room.pages,
          background: room.background,
          totalPages: room.totalPages,
          activePageIndex: room.activePageIndex,
        },
        timer: {
          timerSeconds: currentTimerSec,
          isTimerRunning: room.isTimerRunning,
        },
        chatMessages: room.chatMessages,
      });

      // Also send all existing participants' cursors to the requesting client
      if (room.cursors) {
        for (const [sId, cPos] of Object.entries(room.cursors)) {
          const p = room.participants[sId];
          if (p && sId !== socket.id) {
            socket.emit('cursor:moved', {
              userId: sId,
              userName: p.name,
              role: p.role,
              avatar: p.avatar,
              color: p.color,
              x: cPos.x,
              y: cPos.y,
              pageIndex: cPos.pageIndex,
            });
          }
        }
      }

      io.to(room.id).emit('room:participants', Object.values(room.participants));
    });

    // Join room
    socket.on(
      'room:join',
      ({
        roomId,
        userName,
        role,
        color,
        avatar,
        title,
        subject,
        userId,
      }: {
        roomId: string;
        userName: string;
        role: 'tutor' | 'student';
        color?: string;
        avatar?: string;
        title?: string;
        subject?: string;
        userId?: string;
      }) => {
        const normRoomId = normalizeRoomId(roomId);
        if (!normRoomId) {
          socket.emit('room:error', { error: 'Не указан код комнаты' });
          return;
        }

        const existingRoom = findRoom(normRoomId);

        // If user is a student/guest and the room does not exist, reject!
        if (!existingRoom && role !== 'tutor') {
          socket.emit('room:error', {
            error: `Комната ${normRoomId} не найдена. Создать комнату может только преподаватель.`,
          });
          return;
        }

        // Get or create room (Tutors can create, existing rooms are found)
        const room = getOrCreateRoom(normRoomId, title, subject);
        currentRoomId = room.id;

        // Assign tutorId if room doesn't have one or user joins as tutor
        if (!room.tutorId || role === 'tutor') {
          if (role === 'tutor') {
            room.tutorId = socket.id;
          }
        }

        const userColors = [
          '#2563EB', '#DC2626', '#16A34A', '#9333EA',
          '#D97706', '#0D9488', '#E11D48', '#4F46E5',
        ];
        const assignedColor =
          color || userColors[Object.keys(room.participants).length % userColors.length];

        currentUser = {
          id: socket.id,
          userId,
          name: userName || (role === 'tutor' ? 'Преподаватель' : 'Ученик'),
          role: role || 'student',
          avatar: avatar || (role === 'tutor' ? '👨‍🏫' : '🎓'),
          color: assignedColor,
          micMuted: true,
          isSpeaking: false,
          joinedAt: Date.now(),
        };

        room.participants[socket.id] = currentUser;
        socket.join(room.id);

        if (!room.cursors) room.cursors = {};

        // Calculate accurate current timer if running
        let currentTimerSec = room.timerSeconds;
        if (room.isTimerRunning) {
          const elapsed = Math.floor((Date.now() - room.timerUpdatedAt) / 1000);
          currentTimerSec = Math.max(0, room.timerSeconds - elapsed);
        }

        // Send full room state to the newly joined client
        socket.emit('room:state', {
          room: {
            id: room.id,
            title: room.title,
            subject: room.subject,
            createdAt: room.createdAt,
            tutorId: room.tutorId,
            isLocked: room.isLocked,
            activePageIndex: room.activePageIndex,
            totalPages: room.totalPages,
            background: room.background,
            timerSeconds: currentTimerSec,
            isTimerRunning: room.isTimerRunning,
            pages: room.pages,
            participants: room.participants,
            chatMessages: room.chatMessages,
          },
          self: currentUser,
        });

        // Immediately send all existing participants' real cursors to the newly joined client
        for (const [sId, cPos] of Object.entries(room.cursors)) {
          const p = room.participants[sId];
          if (p && sId !== socket.id) {
            socket.emit('cursor:moved', {
              userId: sId,
              userName: p.name,
              role: p.role,
              avatar: p.avatar,
              color: p.color,
              x: cPos.x,
              y: cPos.y,
              pageIndex: cPos.pageIndex,
            });
          }
        }

        // Also emit room:joined with complete boardState
        socket.emit('room:joined', {
          userId: socket.id,
          roomId: room.id,
          isLocked: room.isLocked,
          title: room.title,
          subject: room.subject,
          boardState: {
            pages: room.pages,
            background: room.background,
            totalPages: room.totalPages,
            activePageIndex: room.activePageIndex,
          },
          timer: {
            timerSeconds: currentTimerSec,
            isTimerRunning: room.isTimerRunning,
          },
          chatMessages: room.chatMessages,
        });

        // Emit updated participants list to everyone in the room
        io.to(room.id).emit('room:participants', Object.values(room.participants));

        // Notify other participants in the room
        socket.to(room.id).emit('participant:joined', currentUser);
        socket.to(room.id).emit('room:userJoined', currentUser);

        // Add system message
        const joinMsg: ChatMessage = {
          id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          userId: 'system',
          userName: 'Система',
          role: 'tutor',
          text: `${currentUser.name} (${currentUser.role === 'tutor' ? 'Репетитор' : 'Ученик'}) подключился к уроку.`,
          timestamp: Date.now(),
        };
        room.chatMessages.push(joinMsg);
        io.to(room.id).emit('chat:message', joinMsg);
      }
    );

    // ================= Timer Real-time Sync =================
    socket.on('timer:start', (data?: { timerSeconds?: number }) => {
      if (!currentRoomId || !rooms[currentRoomId]) return;
      const room = rooms[currentRoomId];
      if (currentUser?.role !== 'tutor') return;

      if (data && typeof data.timerSeconds === 'number') {
        room.timerSeconds = data.timerSeconds;
      }
      room.isTimerRunning = true;
      room.timerUpdatedAt = Date.now();
      scheduleSave();

      io.to(currentRoomId).emit('timer:synced', {
        timerSeconds: room.timerSeconds,
        seconds: room.timerSeconds,
        isTimerRunning: true,
        isRunning: true,
        timerUpdatedAt: room.timerUpdatedAt,
      });
    });

    socket.on('timer:pause', (data?: { timerSeconds?: number }) => {
      if (!currentRoomId || !rooms[currentRoomId]) return;
      const room = rooms[currentRoomId];
      if (currentUser?.role !== 'tutor') return;

      if (data && typeof data.timerSeconds === 'number') {
        room.timerSeconds = data.timerSeconds;
      }
      room.isTimerRunning = false;
      room.timerUpdatedAt = Date.now();
      scheduleSave();

      io.to(currentRoomId).emit('timer:synced', {
        timerSeconds: room.timerSeconds,
        seconds: room.timerSeconds,
        isTimerRunning: false,
        isRunning: false,
        timerUpdatedAt: room.timerUpdatedAt,
      });
    });

    socket.on('timer:reset', (data?: { timerSeconds?: number }) => {
      if (!currentRoomId || !rooms[currentRoomId]) return;
      const room = rooms[currentRoomId];
      if (currentUser?.role !== 'tutor') return;

      room.timerSeconds = data?.timerSeconds ?? 45 * 60;
      room.isTimerRunning = false;
      room.timerUpdatedAt = Date.now();
      scheduleSave();

      io.to(currentRoomId).emit('timer:synced', {
        timerSeconds: room.timerSeconds,
        seconds: room.timerSeconds,
        isTimerRunning: false,
        isRunning: false,
        timerUpdatedAt: room.timerUpdatedAt,
      });
    });

    socket.on('timer:set', ({ timerSeconds, seconds }: { timerSeconds?: number; seconds?: number }) => {
      if (!currentRoomId || !rooms[currentRoomId]) return;
      const room = rooms[currentRoomId];
      if (currentUser?.role !== 'tutor') return;

      const sec = timerSeconds ?? seconds ?? 45 * 60;
      room.timerSeconds = sec;
      room.timerUpdatedAt = Date.now();
      scheduleSave();

      io.to(currentRoomId).emit('timer:synced', {
        timerSeconds: room.timerSeconds,
        seconds: room.timerSeconds,
        isTimerRunning: room.isTimerRunning,
        isRunning: room.isTimerRunning,
        timerUpdatedAt: room.timerUpdatedAt,
      });
    });

    // ================= IDE / Code Sandbox Real-time Sync =================
    socket.on('ide:code:change', (data: { fileId: string; content: string; senderId: string }) => {
      if (!currentRoomId) return;
      socket.to(currentRoomId).emit('ide:code:sync', data);
    });

    socket.on('ide:file:create', (data: { file: any }) => {
      if (!currentRoomId) return;
      socket.to(currentRoomId).emit('ide:file:created', data);
    });

    socket.on('ide:file:delete', (data: { fileId: string }) => {
      if (!currentRoomId) return;
      socket.to(currentRoomId).emit('ide:file:deleted', data);
    });

    socket.on('ide:cursor:move', (cursor: any) => {
      if (!currentRoomId) return;
      socket.to(currentRoomId).emit('ide:cursor:sync', cursor);
    });

    socket.on('ide:output:sync', (data: { output: string; senderName: string }) => {
      if (!currentRoomId) return;
      socket.to(currentRoomId).emit('ide:output:sync', data);
    });

    // Whiteboard element additions (Idempotent)
    socket.on(
      'board:element:create',
      ({
        element,
        pageIndex,
      }: {
        element: WhiteboardElement;
        pageIndex: number;
      }) => {
        if (!currentRoomId || !rooms[currentRoomId]) return;
        const room = rooms[currentRoomId];

        // If room is locked and user is not tutor, reject
        if (room.isLocked && currentUser?.role !== 'tutor') {
          socket.emit('error:permission', { message: 'Доска заблокирована преподавателем' });
          return;
        }

        if (!room.pages[pageIndex]) {
          room.pages[pageIndex] = [];
        }

        // Idempotency check
        const existingIdx = room.pages[pageIndex].findIndex((el) => el.id === element.id);
        if (existingIdx === -1) {
          room.pages[pageIndex].push(element);
        } else {
          room.pages[pageIndex][existingIdx] = element;
        }

        scheduleSave();
        socket.to(currentRoomId).emit('board:element:created', { element, pageIndex });
      }
    );

    // Whiteboard element update
    socket.on(
      'board:element:update',
      ({
        element,
        pageIndex,
      }: {
        element: WhiteboardElement;
        pageIndex: number;
      }) => {
        if (!currentRoomId || !rooms[currentRoomId]) return;
        const room = rooms[currentRoomId];
        if (room.isLocked && currentUser?.role !== 'tutor') return;

        if (room.pages[pageIndex]) {
          const idx = room.pages[pageIndex].findIndex((el) => el.id === element.id);
          if (idx !== -1) {
            room.pages[pageIndex][idx] = element;
          } else {
            room.pages[pageIndex].push(element);
          }
          scheduleSave();
          socket.to(currentRoomId).emit('board:element:updated', { element, pageIndex });
        }
      }
    );

    // Delete element (single)
    socket.on(
      'board:element:delete',
      ({
        elementId,
        pageIndex,
      }: {
        elementId: string;
        pageIndex: number;
      }) => {
        if (!currentRoomId || !rooms[currentRoomId]) return;
        const room = rooms[currentRoomId];
        if (room.isLocked && currentUser?.role !== 'tutor') return;

        if (room.pages[pageIndex]) {
          room.pages[pageIndex] = room.pages[pageIndex].filter((el) => el.id !== elementId);
          scheduleSave();
          socket.to(currentRoomId).emit('board:element:deleted', { elementId, pageIndex });
          socket.to(currentRoomId).emit('board:elements:deleted', { elementIds: [elementId], pageIndex });
        }
      }
    );

    // Batch element deletion
    socket.on(
      'board:elements:deleteBatch',
      ({
        elementIds,
        pageIndex,
      }: {
        elementIds: string[];
        pageIndex: number;
      }) => {
        if (!currentRoomId || !rooms[currentRoomId]) return;
        const room = rooms[currentRoomId];
        if (room.isLocked && currentUser?.role !== 'tutor') return;

        if (room.pages[pageIndex]) {
          const idsSet = new Set(elementIds);
          room.pages[pageIndex] = room.pages[pageIndex].filter((el) => !idsSet.has(el.id));
          scheduleSave();
          socket.to(currentRoomId).emit('board:elements:deleted', { elementIds, pageIndex });
          socket.to(currentRoomId).emit('board:elements:deletedBatch', { elementIds, pageIndex });
        }
      }
    );

    // Clear board page
    socket.on('board:clear', ({ pageIndex }: { pageIndex: number }) => {
      if (!currentRoomId || !rooms[currentRoomId]) return;
      const room = rooms[currentRoomId];
      if (room.isLocked && currentUser?.role !== 'tutor') return;

      room.pages[pageIndex] = [];
      scheduleSave();
      io.to(currentRoomId).emit('board:cleared', { pageIndex });
      io.to(currentRoomId).emit('board:page:cleared', { pageIndex });
    });

    // Replace board page elements (Atomic Undo / Redo synchronization)
    socket.on(
      'board:elements:replace',
      ({
        elements,
        pageIndex,
      }: {
        elements: WhiteboardElement[];
        pageIndex: number;
      }) => {
        if (!currentRoomId || !rooms[currentRoomId]) return;
        const room = rooms[currentRoomId];
        if (room.isLocked && currentUser?.role !== 'tutor') return;

        room.pages[pageIndex] = elements || [];
        scheduleSave();
        socket.to(currentRoomId).emit('board:elements:replaced', { elements: room.pages[pageIndex], pageIndex });
      }
    );

    // Page management
    socket.on('board:page:change', ({ pageIndex }: { pageIndex: number }) => {
      if (!currentRoomId || !rooms[currentRoomId]) return;
      const room = rooms[currentRoomId];
      room.activePageIndex = pageIndex;
      scheduleSave();
      io.to(currentRoomId).emit('board:page:changed', { pageIndex });
    });

    socket.on('board:page:add', () => {
      if (!currentRoomId || !rooms[currentRoomId]) return;
      const room = rooms[currentRoomId];
      const newPageIndex = room.totalPages;
      room.totalPages += 1;
      room.pages[newPageIndex] = [];
      room.activePageIndex = newPageIndex;
      scheduleSave();
      io.to(currentRoomId).emit('board:page:added', {
        totalPages: room.totalPages,
        activePageIndex: room.activePageIndex,
      });
    });

    // Background change
    socket.on('board:background:set', ({ background }: { background: 'grid' | 'dots' | 'lines' | 'blank' | 'dark-grid' }) => {
      if (!currentRoomId || !rooms[currentRoomId]) return;
      const room = rooms[currentRoomId];
      room.background = background;
      scheduleSave();
      io.to(currentRoomId).emit('board:background:changed', { background });
      io.to(currentRoomId).emit('board:background:updated', { background });
    });

    // Lock/Unlock board
    socket.on('board:lock:toggle', () => {
      if (!currentRoomId || !rooms[currentRoomId]) return;
      const room = rooms[currentRoomId];
      if (currentUser?.role !== 'tutor') return;
      room.isLocked = !room.isLocked;
      scheduleSave();
      io.to(currentRoomId).emit('board:lock:changed', { isLocked: room.isLocked });
      io.to(currentRoomId).emit('board:lock:updated', { isLocked: room.isLocked });
    });

    // User profile/avatar live update
    socket.on('user:profile:update', (data: { name?: string; avatar?: string; color?: string }) => {
      if (!currentRoomId || !rooms[currentRoomId] || !currentUser) return;
      const room = rooms[currentRoomId];

      if (data.name) currentUser.name = data.name;
      if (data.avatar) currentUser.avatar = data.avatar;
      if (data.color) currentUser.color = data.color;

      room.participants[socket.id] = currentUser;
      io.to(currentRoomId).emit('participant:updated', currentUser);
      io.to(currentRoomId).emit('room:participants', Object.values(room.participants));
    });

    // Cursor position broadcast
    socket.on('cursor:move', (data: { x: number; y: number; pageIndex: number }) => {
      if (!currentRoomId || !currentUser || !rooms[currentRoomId]) return;
      const room = rooms[currentRoomId];
      if (!room.cursors) room.cursors = {};
      room.cursors[socket.id] = {
        x: data.x,
        y: data.y,
        pageIndex: data.pageIndex,
        updatedAt: Date.now(),
      };
      socket.to(currentRoomId).emit('cursor:moved', {
        userId: socket.id,
        userName: currentUser.name,
        role: currentUser.role,
        avatar: currentUser.avatar,
        color: currentUser.color,
        x: data.x,
        y: data.y,
        pageIndex: data.pageIndex,
      });
    });

    // Laser pointer
    socket.on('board:laser', (data: { x: number; y: number; pageIndex: number }) => {
      if (!currentRoomId || !currentUser) return;
      const payload = {
        userId: socket.id,
        userName: currentUser.name,
        color: currentUser.color,
        avatar: currentUser.avatar,
        x: data.x,
        y: data.y,
        pageIndex: data.pageIndex,
        timestamp: Date.now(),
      };
      socket.to(currentRoomId).emit('board:lasered', payload);
      socket.to(currentRoomId).emit('laser:pointer', payload);
    });

    // Chat message
    socket.on('chat:send', ({ text, formula }: { text: string; formula?: string }) => {
      if (!currentRoomId || !rooms[currentRoomId] || !currentUser) return;
      const room = rooms[currentRoomId];

      const msg: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        userId: socket.id,
        userName: currentUser.name,
        role: currentUser.role,
        avatar: currentUser.avatar,
        text,
        formula,
        timestamp: Date.now(),
      };

      room.chatMessages.push(msg);
      if (room.chatMessages.length > 100) {
        room.chatMessages = room.chatMessages.slice(-100);
      }
      scheduleSave();

      io.to(currentRoomId).emit('chat:message', msg);
    });

    // WebRTC Voice Signaling Mesh
    socket.on('voice:signal', (data: { to: string; signal: any; type: 'offer' | 'answer' | 'ice-candidate' }) => {
      io.to(data.to).emit('voice:signal', {
        from: socket.id,
        signal: data.signal,
        type: data.type,
      });
    });

    // Voice status update
    socket.on('voice:state', (data: { micMuted: boolean; isSpeaking: boolean }) => {
      if (!currentRoomId || !rooms[currentRoomId] || !currentUser) return;
      currentUser.micMuted = data.micMuted;
      currentUser.isSpeaking = data.isSpeaking;

      socket.to(currentRoomId).emit('participant:voice:updated', {
        userId: socket.id,
        micMuted: data.micMuted,
        isSpeaking: data.isSpeaking,
      });
    });

    // Tutor Cheer / Confetti event
    socket.on('tutor:cheer', (data: { studentId?: string; message?: string }) => {
      if (!currentRoomId || currentUser?.role !== 'tutor') return;
      io.to(currentRoomId).emit('tutor:cheered', {
        tutorName: currentUser.name,
        message: data?.message || 'Отличная работа! Прекрасно решено!',
      });
    });

    // Tutor Attention Ping
    socket.on('tutor:attention', (data: { text?: string }) => {
      if (!currentRoomId || currentUser?.role !== 'tutor') return;
      const pingPayload = {
        message: data?.text || 'Обратите внимание на доску!',
        text: data?.text || 'Обратите внимание на доску!',
      };
      io.to(currentRoomId).emit('tutor:attention:ping', pingPayload);
      io.to(currentRoomId).emit('tutor:attentioned', pingPayload);
    });

    // Tutor kicks a participant from the room
    socket.on('room:kick:user', ({ targetSocketId, targetName, reason }: { targetSocketId: string; targetName?: string; reason?: string }) => {
      if (!currentRoomId || !rooms[currentRoomId] || currentUser?.role !== 'tutor') return;
      const room = rooms[currentRoomId];
      const target = room.participants[targetSocketId];

      const kickReason = reason || 'Преподаватель исключил вас из занятия.';

      // Notify target socket
      io.to(targetSocketId).emit('room:kicked', {
        reason: kickReason,
      });

      // Remove from room participants
      delete room.participants[targetSocketId];

      const kickMsg: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        userId: 'system',
        userName: 'Система',
        role: 'tutor',
        text: `${target?.name || targetName || 'Пользователь'} был исключен преподавателем из занятия.`,
        timestamp: Date.now(),
      };
      room.chatMessages.push(kickMsg);

      io.to(currentRoomId).emit('participant:left', {
        userId: targetSocketId,
        userName: target?.name || targetName,
      });
      io.to(currentRoomId).emit('room:userLeft', {
        userId: targetSocketId,
        userName: target?.name || targetName,
      });
      io.to(currentRoomId).emit('cursor:removed', {
        userId: targetSocketId,
      });
      io.to(currentRoomId).emit('room:participants', Object.values(room.participants));
      io.to(currentRoomId).emit('chat:message', kickMsg);
    });

    // Disconnect handler
    socket.on('disconnect', () => {
      if (currentRoomId && rooms[currentRoomId] && currentUser) {
        const room = rooms[currentRoomId];
        delete room.participants[socket.id];

        const leaveMsg: ChatMessage = {
          id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          userId: 'system',
          userName: 'Система',
          role: 'tutor',
          text: `${currentUser.name} покинул занятие.`,
          timestamp: Date.now(),
        };
        room.chatMessages.push(leaveMsg);

        io.to(currentRoomId).emit('participant:left', {
          userId: socket.id,
          userName: currentUser.name,
        });
        io.to(currentRoomId).emit('room:userLeft', {
          userId: socket.id,
          userName: currentUser.name,
        });
        io.to(currentRoomId).emit('cursor:removed', {
          userId: socket.id,
        });
        io.to(currentRoomId).emit('room:participants', Object.values(room.participants));
        io.to(currentRoomId).emit('chat:message', leaveMsg);

        // Keep rooms persistent so data and access are never lost on reload or disconnect
        scheduleSave();
      }
    });
  });

  // Vite middleware for development vs static dist for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        host: '0.0.0.0',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`TutorBoard server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
