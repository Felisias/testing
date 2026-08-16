import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io({
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 1000,
      transports: ['websocket', 'polling'],
    });
  } else if (!socket.connected) {
    socket.connect();
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
