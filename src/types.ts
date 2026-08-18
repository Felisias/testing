export type UserRole = 'tutor' | 'student';

export interface UserAccount {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  avatar?: string;
  createdAt: number;
}

export interface SavedBoard {
  id: string; // roomId
  title: string;
  subject: string;
  role: UserRole;
  lastVisited: number;
  totalPages?: number;
}

export interface Participant {
  id: string; // socket.id
  userId?: string;
  name: string;
  role: UserRole;
  avatar?: string;
  color: string;
  micMuted: boolean;
  isSpeaking: boolean;
  joinedAt: number;
}

export interface ToolSpecificSettings {
  pen: {
    color: string;
    strokeWidth: number;
  };
  highlighter: {
    color: string;
    strokeWidth: number;
  };
  eraser: {
    strokeWidth: number;
  };
  shapes: {
    color: string;
    strokeWidth: number;
  };
  text: {
    color: string;
    fontSize: number;
  };
}

export const DEFAULT_TOOL_SETTINGS: ToolSpecificSettings = {
  pen: {
    color: '#1E293B',
    strokeWidth: 3,
  },
  highlighter: {
    color: '#EAB308',
    strokeWidth: 20,
  },
  eraser: {
    strokeWidth: 16,
  },
  shapes: {
    color: '#1E293B',
    strokeWidth: 3,
  },
  text: {
    color: '#1E293B',
    fontSize: 24,
  },
};

export type ToolType =
  | 'select'
  | 'pen'
  | 'highlighter'
  | 'eraser'
  | 'line'
  | 'arrow'
  | 'rect'
  | 'circle'
  | 'triangle'
  | 'coordSystem'
  | 'text'
  | 'laser'
  | 'pan';

export type BackgroundType = 'grid' | 'dots' | 'lines' | 'blank' | 'dark-grid';

export interface Point {
  x: number;
  y: number;
}

export interface BaseElement {
  id: string;
  userId: string;
  userName: string;
  userColor: string;
  createdAt: number;
  updatedAt: number;
}

export interface StrokeElement extends BaseElement {
  type: 'stroke';
  tool: 'pen' | 'highlighter';
  points: Point[];
  color: string;
  strokeWidth: number;
  opacity: number;
}

export interface ShapeElement extends BaseElement {
  type: 'shape';
  shapeType: 'line' | 'arrow' | 'rect' | 'circle' | 'triangle' | 'coordSystem';
  x: number;
  y: number;
  width: number;
  height: number;
  strokeColor: string;
  fillColor?: string;
  strokeWidth: number;
  isDashed?: boolean;
}

export interface TextElement extends BaseElement {
  type: 'text';
  x: number;
  y: number;
  text: string;
  fontSize: number;
  color: string;
  fontWeight?: string;
  backgroundColor?: string;
}

export interface ImageElement extends BaseElement {
  type: 'image';
  x: number;
  y: number;
  width: number;
  height: number;
  src: string; // base64 or url
  aspectRatio?: number;
}

export type WhiteboardElement =
  | StrokeElement
  | ShapeElement
  | TextElement
  | ImageElement;

export interface LaserPoint {
  userId: string;
  userName: string;
  color: string;
  avatar?: string;
  x: number;
  y: number;
  timestamp: number;
}

export interface CursorPosition {
  userId: string;
  userName: string;
  role: UserRole;
  avatar?: string;
  color: string;
  x: number;
  y: number;
  lastActive?: number;
}

export interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  role: UserRole;
  avatar?: string;
  text: string;
  formula?: string;
  timestamp: number;
}

export interface RoomState {
  id: string;
  title: string;
  subject: string;
  createdAt: number;
  tutorId: string;
  isLocked: boolean; // if true, only tutor can draw
  activePageIndex: number;
  totalPages: number;
  background: BackgroundType;
  pages: {
    [pageIndex: number]: WhiteboardElement[];
  };
  participants: {
    [socketId: string]: Participant;
  };
  chatMessages: ChatMessage[];
}

export interface VoiceSignalData {
  to: string;
  from: string;
  signal: any;
  type: 'offer' | 'answer' | 'ice-candidate';
}

export interface InviteCodeRecord {
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

export interface UserWithBoards {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  avatar: string;
  createdAt: number;
  savedBoards: SavedBoard[];
}

export type WhiteboardAction =
  | {
      type: 'create';
      elements: WhiteboardElement[];
    }
  | {
      type: 'delete';
      elements: WhiteboardElement[];
    }
  | {
      type: 'update';
      before: WhiteboardElement[];
      after: WhiteboardElement[];
    };

