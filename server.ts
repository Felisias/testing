import express from 'express';
import http from 'http';
import path from 'path';
import { Server as SocketIOServer } from 'socket.io';
import { createServer as createViteServer } from 'vite';

interface Participant {
  id: string;
  name: string;
  role: 'tutor' | 'student';
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
  pages: {
    [pageIndex: number]: WhiteboardElement[];
  };
  participants: {
    [socketId: string]: Participant;
  };
  chatMessages: ChatMessage[];
}

const rooms: { [roomId: string]: RoomData } = {};

function getOrCreateRoom(roomId: string, title?: string, subject?: string): RoomData {
  const normalizedId = roomId.trim().toUpperCase();
  if (!rooms[normalizedId]) {
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
          text: `Комната ${normalizedId} создана. Добро пожаловать на урок!`,
          timestamp: Date.now(),
        },
      ],
    };
  }
  return rooms[normalizedId];
}

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

  // API endpoints
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', roomsCount: Object.keys(rooms).length });
  });

  app.get('/api/rooms/:roomId', (req, res) => {
    const roomId = req.params.roomId.toUpperCase();
    const room = rooms[roomId];
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    return res.json({
      id: room.id,
      title: room.title,
      subject: room.subject,
      participantCount: Object.keys(room.participants).length,
      isLocked: room.isLocked,
    });
  });

  // Socket.IO Logic
  io.on('connection', (socket) => {
    let currentRoomId: string | null = null;
    let currentUser: Participant | null = null;

    // Join room
    socket.on(
      'room:join',
      ({
        roomId,
        userName,
        role,
        color,
        title,
        subject,
      }: {
        roomId: string;
        userName: string;
        role: 'tutor' | 'student';
        color?: string;
        title?: string;
        subject?: string;
      }) => {
        const normRoomId = roomId.trim().toUpperCase();
        currentRoomId = normRoomId;

        const room = getOrCreateRoom(normRoomId, title, subject);

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
          name: userName || (role === 'tutor' ? 'Преподаватель' : 'Ученик'),
          role: role || 'student',
          color: assignedColor,
          micMuted: false,
          isSpeaking: false,
          joinedAt: Date.now(),
        };

        room.participants[socket.id] = currentUser;
        socket.join(normRoomId);

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
            pages: room.pages,
            participants: room.participants,
            chatMessages: room.chatMessages,
          },
          self: currentUser,
        });

        // Notify other participants in the room
        socket.to(normRoomId).emit('participant:joined', currentUser);

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
        io.to(normRoomId).emit('chat:message', joinMsg);
      }
    );

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

        // Idempotency check: only add if ID doesn't already exist
        const existingIdx = room.pages[pageIndex].findIndex((el) => el.id === element.id);
        if (existingIdx === -1) {
          room.pages[pageIndex].push(element);
        } else {
          room.pages[pageIndex][existingIdx] = element;
        }

        // Broadcast to others in the room
        socket.to(currentRoomId).emit('board:element:created', { element, pageIndex });
      }
    );

    // Whiteboard element update (e.g. moving/resizing an image or shape)
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
          socket.to(currentRoomId).emit('board:element:updated', { element, pageIndex });
        }
      }
    );

    // Delete element
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
          socket.to(currentRoomId).emit('board:element:deleted', { elementId, pageIndex });
        }
      }
    );

    // Batch element deletion (e.g. eraser area)
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
      io.to(currentRoomId).emit('board:cleared', { pageIndex });
    });

    // Page management
    socket.on('board:page:change', ({ pageIndex }: { pageIndex: number }) => {
      if (!currentRoomId || !rooms[currentRoomId]) return;
      const room = rooms[currentRoomId];
      room.activePageIndex = pageIndex;
      io.to(currentRoomId).emit('board:page:changed', { pageIndex });
    });

    socket.on('board:page:add', () => {
      if (!currentRoomId || !rooms[currentRoomId]) return;
      const room = rooms[currentRoomId];
      const newPageIndex = room.totalPages;
      room.totalPages += 1;
      room.pages[newPageIndex] = [];
      room.activePageIndex = newPageIndex;
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
      io.to(currentRoomId).emit('board:background:changed', { background });
    });

    // Lock/Unlock board
    socket.on('board:lock:toggle', () => {
      if (!currentRoomId || !rooms[currentRoomId]) return;
      const room = rooms[currentRoomId];
      if (currentUser?.role !== 'tutor') return;
      room.isLocked = !room.isLocked;
      io.to(currentRoomId).emit('board:lock:changed', { isLocked: room.isLocked });
    });

    // Cursor position broadcast (ephemeral)
    socket.on('cursor:move', (data: { x: number; y: number; pageIndex: number }) => {
      if (!currentRoomId || !currentUser) return;
      socket.to(currentRoomId).emit('cursor:moved', {
        userId: socket.id,
        userName: currentUser.name,
        role: currentUser.role,
        color: currentUser.color,
        x: data.x,
        y: data.y,
        pageIndex: data.pageIndex,
      });
    });

    // Laser pointer (ephemeral laser beam)
    socket.on('board:laser', (data: { x: number; y: number; pageIndex: number }) => {
      if (!currentRoomId || !currentUser) return;
      socket.to(currentRoomId).emit('board:lasered', {
        userId: socket.id,
        userName: currentUser.name,
        color: currentUser.color,
        x: data.x,
        y: data.y,
        pageIndex: data.pageIndex,
        timestamp: Date.now(),
      });
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
        text,
        formula,
        timestamp: Date.now(),
      };

      room.chatMessages.push(msg);
      // Keep chat to last 100 messages
      if (room.chatMessages.length > 100) {
        room.chatMessages = room.chatMessages.slice(-100);
      }

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

    // Voice status update (Mute/Unmute/Speaking)
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
      socket.to(currentRoomId).emit('tutor:attention:ping', {
        message: data.text || 'Обратите внимание на доску!',
      });
    });

    // Disconnect handler
    socket.on('disconnect', () => {
      if (currentRoomId && rooms[currentRoomId] && currentUser) {
        const room = rooms[currentRoomId];
        delete room.participants[socket.id];

        // Leave message
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
        io.to(currentRoomId).emit('chat:message', leaveMsg);

        // If room is empty, clean up after 1 hour
        if (Object.keys(room.participants).length === 0) {
          setTimeout(() => {
            if (rooms[currentRoomId!] && Object.keys(rooms[currentRoomId!].participants).length === 0) {
              delete rooms[currentRoomId!];
            }
          }, 3600000);
        }
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
