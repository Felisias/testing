export interface KeybindSettings {
  select: string;
  pan: string;
  pen: string;
  highlighter: string;
  eraser: string;
  line: string;
  rect: string;
  circle: string;
  triangle: string;
  text: string;
  laser: string;
  undo: string;
  redo: string;
  clear: string;
}

export const DEFAULT_KEYBINDS: KeybindSettings = {
  select: 'v',
  pan: 'h',
  pen: 'p',
  highlighter: 'm',
  eraser: 'e',
  line: 'l',
  rect: 'r',
  circle: 'c',
  triangle: 'g',
  text: 't',
  laser: 'x',
  undo: 'z', // Ctrl+Z
  redo: 'y', // Ctrl+Y
  clear: 'k',
};

export interface CodeFile {
  id: string;
  name: string;
  language: string;
  content: string;
}

export interface CodeSelection {
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
  selectionStart: number;
  selectionEnd: number;
}

export interface CodeCursor {
  userId: string;
  userName: string;
  color: string;
  avatar?: string;
  fileId?: string;
  fileName?: string;
  lineNumber: number;
  column: number;
  selection?: CodeSelection | null;
  lastActive?: number;
}

export interface CodePlot {
  id: string;
  name: string;
  dataUrl: string;
  size?: number;
  createdAt: number;
  authorName?: string;
}

export interface ToolSkinConfig {
  pen?: string;
  highlighter?: string;
  eraser?: string;
  laser?: string;
  shapes?: string;
  text?: string;
  select?: string;
  pan?: string;
}

export interface ToolTransform {
  x: number; // offset X in px
  y: number; // offset Y in px
  scale: number; // scale multiplier, e.g. 1.0, 1.5, 2.0
  rotation?: number; // degrees, default -45
}

export type ToolLayoutConfig = Record<string, ToolTransform>;

export const DEFAULT_TOOL_TRANSFORMS: ToolLayoutConfig = {
  pen: { x: 0, y: 0, scale: 1.5, rotation: -45 },
  highlighter: { x: 0, y: 0, scale: 1.5, rotation: -45 },
  eraser: { x: 0, y: 0, scale: 1.5, rotation: -45 },
  laser: { x: 0, y: 0, scale: 1.5, rotation: -45 },
  rect: { x: 0, y: 0, scale: 1.5, rotation: -45 },
  text: { x: 0, y: 0, scale: 1.5, rotation: -45 },
  select: { x: 0, y: 0, scale: 1.5, rotation: -45 },
  pan: { x: 0, y: 0, scale: 1.5, rotation: -45 },
};

export interface ExperimentalSkinSettings {
  enabled: boolean;
  toolSkins: ToolSkinConfig;
  toolLayouts?: ToolLayoutConfig;
}

export const DEFAULT_EXPERIMENTAL_SKINS: ExperimentalSkinSettings = {
  enabled: false,
  toolSkins: {},
  toolLayouts: DEFAULT_TOOL_TRANSFORMS,
};

