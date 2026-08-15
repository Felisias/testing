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

export interface CodeCursor {
  userId: string;
  userName: string;
  color: string;
  avatar?: string;
  lineNumber: number;
  column: number;
}
