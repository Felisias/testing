import React, { useRef, useState } from 'react';
import {
  ToolType,
  BackgroundType,
  UserRole,
  ImageElement,
  ToolSpecificSettings,
} from '../../types';
import { QUICK_PALETTES, STROKE_WIDTHS } from '../../data/mathSymbols';
import { getSocket } from '../../services/socket';
import {
  MousePointer,
  Pencil,
  Highlighter,
  Eraser,
  Square,
  Circle,
  Triangle,
  Minus,
  ArrowRight,
  Grid3X3,
  Type,
  Image as ImageIcon,
  Flame,
  Hand,
  Undo2,
  Redo2,
  Trash2,
  Download,
  Layers,
  Palette,
  Sigma,
  Sliders,
  Check,
} from 'lucide-react';

interface ToolbarProps {
  tool: ToolType;
  setTool: (tool: ToolType) => void;
  toolSettings: ToolSpecificSettings;
  updateToolSetting: <K extends keyof ToolSpecificSettings>(
    toolKey: K,
    settings: Partial<ToolSpecificSettings[K]>
  ) => void;
  background: BackgroundType;
  setBackground: (bg: BackgroundType) => void;
  canEdit: boolean;
  userRole: UserRole;
  userName: string;
  userColor: string;
  onClearPage: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onImageUploaded: (imgEl: ImageElement) => void;
  onExport: () => void;
  onToggleMath?: () => void;
  isMathOpen?: boolean;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  tool,
  setTool,
  toolSettings,
  updateToolSetting,
  background,
  setBackground,
  canEdit,
  userName,
  userColor,
  onClearPage,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onImageUploaded,
  onExport,
  onToggleMath,
  isMathOpen,
}) => {
  // Popover state for specific tool click
  const [activeToolFlyout, setActiveToolFlyout] = useState<ToolType | 'bg' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const shapeTools: { id: ToolType; label: string; icon: React.ReactNode }[] = [
    { id: 'line', label: 'Прямая линия', icon: <Minus className="w-4 h-4" /> },
    { id: 'arrow', label: 'Стрелка / Вектор', icon: <ArrowRight className="w-4 h-4" /> },
    { id: 'rect', label: 'Прямоугольник', icon: <Square className="w-4 h-4" /> },
    { id: 'circle', label: 'Окружность', icon: <Circle className="w-4 h-4" /> },
    { id: 'triangle', label: 'Треугольник', icon: <Triangle className="w-4 h-4" /> },
    { id: 'coordSystem', label: 'Оси координат X-Y', icon: <Grid3X3 className="w-4 h-4" /> },
  ];

  const backgrounds: { id: BackgroundType; label: string; desc: string }[] = [
    { id: 'grid', label: 'Клетка', desc: 'Для математики и физики' },
    { id: 'dots', label: 'Точки', desc: 'Для графиков и схем' },
    { id: 'lines', label: 'Линейка', desc: 'Для русского и языков' },
    { id: 'blank', label: 'Белый лист', desc: 'Без разметки' },
    { id: 'dark-grid', label: 'Меловая доска', desc: 'Темный фон с сеткой' },
  ];

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const src = event.target?.result as string;
      const img = new Image();
      img.onload = () => {
        let width = img.naturalWidth;
        let height = img.naturalHeight;
        const maxDim = 600;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = (height / width) * maxDim;
            width = maxDim;
          } else {
            width = (width / height) * maxDim;
            height = maxDim;
          }
        }

        const newImageEl: ImageElement = {
          id: `img-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          userId: 'self',
          userName,
          userColor,
          type: 'image',
          x: 120,
          y: 120,
          width,
          height,
          src,
          aspectRatio: img.naturalWidth / img.naturalHeight,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        onImageUploaded(newImageEl);
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const isShapeActive = shapeTools.some((s) => s.id === tool);
  const activeShape = shapeTools.find((s) => s.id === tool) || shapeTools[2];

  // Tool Click Handler: selects tool AND opens its color/size popover
  const handleToolClick = (selectedTool: ToolType) => {
    if (!canEdit && selectedTool !== 'select' && selectedTool !== 'pan') return;

    if (tool === selectedTool) {
      // Toggle popover
      setActiveToolFlyout(activeToolFlyout === selectedTool ? null : selectedTool);
    } else {
      setTool(selectedTool);
      // Auto-open settings popover for customizable tools
      if (['pen', 'highlighter', 'eraser', 'text', 'line', 'arrow', 'rect', 'circle', 'triangle', 'coordSystem'].includes(selectedTool)) {
        setActiveToolFlyout(selectedTool);
      } else {
        setActiveToolFlyout(null);
      }
    }
  };

  return (
    <aside
      id="tutorboard-vertical-toolbar"
      aria-label="Панель инструментов доски"
      className="bg-white/95 backdrop-blur-md shadow-2xl border border-slate-200/90 rounded-2xl p-1.5 flex flex-col items-center gap-1.5 select-none z-40 relative"
    >
      {/* 1. Primary Navigation Tools */}
      <div className="flex flex-col items-center gap-1 w-full">
        {/* Select */}
        <button
          onClick={() => {
            setTool('select');
            setActiveToolFlyout(null);
          }}
          title="Выделение и перемещение (V)"
          className={`p-2 rounded-xl transition flex items-center justify-center cursor-pointer ${
            tool === 'select'
              ? 'bg-blue-600 text-white shadow-md'
              : 'hover:bg-slate-100 text-slate-700'
          }`}
        >
          <MousePointer className="w-4 h-4" />
        </button>

        {/* Hand / Pan */}
        <button
          onClick={() => {
            setTool('pan');
            setActiveToolFlyout(null);
          }}
          title="Рука (Панорамирование доски / ПКМ)"
          className={`p-2 rounded-xl transition flex items-center justify-center cursor-pointer ${
            tool === 'pan'
              ? 'bg-blue-600 text-white shadow-md'
              : 'hover:bg-slate-100 text-slate-700'
          }`}
        >
          <Hand className="w-4 h-4" />
        </button>
      </div>

      <div className="w-6 h-px bg-slate-200" />

      {/* 2. Drawing Tools with Click-to-Configure Flyouts */}
      <div className="flex flex-col items-center gap-1 w-full">
        {/* Pen Tool Button & Flyout */}
        <div className="relative">
          <button
            onClick={() => handleToolClick('pen')}
            title="Перо / Ручка (Нажмите для выбора цвета и толщины)"
            disabled={!canEdit}
            className={`p-2 rounded-xl transition flex items-center justify-center relative cursor-pointer ${
              tool === 'pen'
                ? 'bg-blue-600 text-white shadow-md'
                : 'hover:bg-slate-100 text-slate-700'
            } ${!canEdit ? 'opacity-40 cursor-not-allowed' : ''}`}
          >
            <Pencil className="w-4 h-4" />
            <span
              className="absolute bottom-1 right-1 w-2 h-2 rounded-full ring-1 ring-white"
              style={{ backgroundColor: toolSettings.pen.color }}
            />
          </button>

          {/* Pen Color & Size Popover */}
          {activeToolFlyout === 'pen' && canEdit && (
            <div
              className="absolute left-full top-0 ml-2.5 w-56 bg-white/98 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200 p-3 z-50 animate-in fade-in slide-in-from-left-2 text-slate-800"
              onMouseLeave={() => setActiveToolFlyout(null)}
            >
              <div className="text-[11px] font-bold text-slate-600 mb-2 uppercase tracking-wider flex items-center justify-between">
                <span>Настройки пера</span>
                <span className="font-mono text-blue-600 font-bold">{toolSettings.pen.strokeWidth}px</span>
              </div>

              {/* Color grid */}
              <div className="grid grid-cols-4 gap-1.5 mb-3">
                {QUICK_PALETTES.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => updateToolSetting('pen', { color: c.value })}
                    title={c.name}
                    className={`w-7 h-7 rounded-full transition-transform cursor-pointer ${
                      toolSettings.pen.color === c.value
                        ? 'ring-2 ring-blue-500 ring-offset-2 scale-110'
                        : 'hover:scale-105 opacity-90 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: c.value }}
                  />
                ))}
              </div>

              {/* Custom Color Input */}
              <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-100 text-xs">
                <span className="text-slate-600 font-medium">Свой цвет:</span>
                <input
                  type="color"
                  value={toolSettings.pen.color}
                  onChange={(e) => updateToolSetting('pen', { color: e.target.value })}
                  className="w-6 h-6 rounded-lg cursor-pointer border-0 p-0 bg-transparent"
                />
              </div>

              {/* Stroke Size Presets */}
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Толщина линии:
              </div>
              <div className="grid grid-cols-4 gap-1">
                {[1, 2, 3, 4, 6, 8, 10, 14].map((size) => (
                  <button
                    key={size}
                    onClick={() => updateToolSetting('pen', { strokeWidth: size })}
                    className={`py-1.5 px-1 rounded-xl text-xs font-bold transition flex flex-col items-center gap-1 cursor-pointer ${
                      toolSettings.pen.strokeWidth === size
                        ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-300'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <span>{size}px</span>
                    <div
                      className="rounded-full bg-slate-800"
                      style={{ width: `${Math.min(12, Math.max(2, size))}px`, height: `${Math.min(12, Math.max(2, size))}px` }}
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Highlighter Tool Button & Flyout */}
        <div className="relative">
          <button
            onClick={() => handleToolClick('highlighter')}
            title="Маркер / Текстовыделитель (Нажмите для настройки цвета и размера)"
            disabled={!canEdit}
            className={`p-2 rounded-xl transition flex items-center justify-center relative cursor-pointer ${
              tool === 'highlighter'
                ? 'bg-blue-600 text-white shadow-md'
                : 'hover:bg-slate-100 text-slate-700'
            } ${!canEdit ? 'opacity-40 cursor-not-allowed' : ''}`}
          >
            <Highlighter className="w-4 h-4" />
            <span
              className="absolute bottom-1 right-1 w-2 h-2 rounded-full ring-1 ring-white"
              style={{ backgroundColor: toolSettings.highlighter.color }}
            />
          </button>

          {/* Highlighter Settings Popover */}
          {activeToolFlyout === 'highlighter' && canEdit && (
            <div
              className="absolute left-full top-0 ml-2.5 w-56 bg-white/98 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200 p-3 z-50 animate-in fade-in slide-in-from-left-2 text-slate-800"
              onMouseLeave={() => setActiveToolFlyout(null)}
            >
              <div className="text-[11px] font-bold text-slate-600 mb-2 uppercase tracking-wider flex items-center justify-between">
                <span>Цвет маркера</span>
                <span className="font-mono text-blue-600 font-bold">{toolSettings.highlighter.strokeWidth}px</span>
              </div>

              {/* Highlighter Pastel Colors */}
              <div className="grid grid-cols-3 gap-1.5 mb-2.5">
                {[
                  { name: 'Желтый', val: '#EAB308' },
                  { name: 'Зеленый', val: '#22C55E' },
                  { name: 'Голубой', val: '#06B6D4' },
                  { name: 'Розовый', val: '#EC4899' },
                  { name: 'Оранжевый', val: '#F97316' },
                  { name: 'Фиолетовый', val: '#A855F7' },
                ].map((c) => (
                  <button
                    key={c.val}
                    onClick={() => updateToolSetting('highlighter', { color: c.val })}
                    title={c.name}
                    className={`h-7 rounded-xl transition cursor-pointer flex items-center justify-center font-bold text-[10px] ${
                      toolSettings.highlighter.color === c.val
                        ? 'ring-2 ring-slate-800 ring-offset-1 scale-105'
                        : 'opacity-80 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: c.val, color: '#FFFFFF' }}
                  >
                    {toolSettings.highlighter.color === c.val && <Check className="w-3.5 h-3.5" />}
                  </button>
                ))}
              </div>

              {/* Custom Highlighter Color */}
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 text-xs">
                <span className="text-slate-600 font-medium">Свой оттенок:</span>
                <input
                  type="color"
                  value={toolSettings.highlighter.color}
                  onChange={(e) => updateToolSetting('highlighter', { color: e.target.value })}
                  className="w-6 h-6 rounded-lg cursor-pointer border-0 p-0 bg-transparent"
                />
              </div>

              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Ширина маркера:
              </div>
              <div className="grid grid-cols-3 gap-1">
                {[14, 20, 32].map((size) => (
                  <button
                    key={size}
                    onClick={() => updateToolSetting('highlighter', { strokeWidth: size })}
                    className={`py-1.5 rounded-xl text-xs font-bold transition flex items-center justify-center cursor-pointer ${
                      toolSettings.highlighter.strokeWidth === size
                        ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-300'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    {size}px
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Eraser Tool Button & Flyout */}
        <div className="relative">
          <button
            onClick={() => handleToolClick('eraser')}
            title="Ластик (Нажмите для настройки размера)"
            disabled={!canEdit}
            className={`p-2 rounded-xl transition flex items-center justify-center cursor-pointer ${
              tool === 'eraser'
                ? 'bg-blue-600 text-white shadow-md'
                : 'hover:bg-slate-100 text-slate-700'
            } ${!canEdit ? 'opacity-40 cursor-not-allowed' : ''}`}
          >
            <Eraser className="w-4 h-4" />
          </button>

          {/* Eraser Size Popover */}
          {activeToolFlyout === 'eraser' && canEdit && (
            <div
              className="absolute left-full top-0 ml-2.5 w-48 bg-white rounded-2xl shadow-2xl border border-slate-200 p-3 z-50 animate-in fade-in slide-in-from-left-2 text-slate-800"
              onMouseLeave={() => setActiveToolFlyout(null)}
            >
              <div className="text-[11px] font-bold text-slate-600 mb-2 uppercase tracking-wider flex items-center justify-between">
                <span>Размер ластика</span>
                <span className="font-mono text-blue-600 font-bold">{toolSettings.eraser.strokeWidth}px</span>
              </div>
              <div className="space-y-1">
                {[
                  { label: 'Малый (8px)', size: 8 },
                  { label: 'Средний (16px)', size: 16 },
                  { label: 'Крупный (28px)', size: 28 },
                  { label: 'Широкий (44px)', size: 44 },
                ].map((item) => (
                  <button
                    key={item.size}
                    onClick={() => {
                      updateToolSetting('eraser', { strokeWidth: item.size });
                      setActiveToolFlyout(null);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs transition cursor-pointer ${
                      toolSettings.eraser.strokeWidth === item.size
                        ? 'bg-blue-50 text-blue-700 font-bold'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span>{item.label}</span>
                    <div
                      className="rounded-full bg-slate-800"
                      style={{ width: `${Math.min(16, item.size / 2 + 2)}px`, height: `${Math.min(16, item.size / 2 + 2)}px` }}
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Shapes Menu Flyout */}
        <div className="relative">
          <button
            onClick={() => {
              if (isShapeActive) {
                setActiveToolFlyout(activeToolFlyout === tool ? null : tool);
              } else {
                setTool(activeShape.id);
                setActiveToolFlyout(activeShape.id);
              }
            }}
            title="Геометрические фигуры (Нажмите для выбора фигуры, цвета и толщины)"
            disabled={!canEdit}
            className={`p-2 rounded-xl transition flex items-center justify-center relative cursor-pointer ${
              isShapeActive
                ? 'bg-blue-600 text-white shadow-md'
                : 'hover:bg-slate-100 text-slate-700'
            } ${!canEdit ? 'opacity-40 cursor-not-allowed' : ''}`}
          >
            {activeShape.icon}
            <span
              className="absolute bottom-1 right-1 w-2 h-2 rounded-full ring-1 ring-white"
              style={{ backgroundColor: toolSettings.shapes.color }}
            />
          </button>

          {/* Shapes Selector & Styling Popover */}
          {isShapeActive && activeToolFlyout === tool && canEdit && (
            <div
              className="absolute left-full top-0 ml-2.5 w-60 bg-white rounded-2xl shadow-2xl border border-slate-200 p-3 z-50 animate-in fade-in slide-in-from-left-2 text-slate-800"
              onMouseLeave={() => setActiveToolFlyout(null)}
            >
              <div className="text-[11px] font-bold text-slate-600 px-1 mb-1.5 uppercase tracking-wider flex items-center justify-between">
                <span>Фигуры и линии</span>
                <span className="font-mono text-blue-600 font-bold">{toolSettings.shapes.strokeWidth}px</span>
              </div>
              <div className="grid grid-cols-2 gap-1 mb-3">
                {shapeTools.map((shape) => (
                  <button
                    key={shape.id}
                    onClick={() => {
                      setTool(shape.id);
                      setActiveToolFlyout(shape.id);
                    }}
                    className={`flex items-center gap-1.5 px-2 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                      tool === shape.id
                        ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span className="p-0.5">{shape.icon}</span>
                    <span className="truncate">{shape.label}</span>
                  </button>
                ))}
              </div>

              {/* Color picker for shapes */}
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Цвет контура:
              </div>
              <div className="grid grid-cols-4 gap-1.5 mb-2.5">
                {QUICK_PALETTES.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => updateToolSetting('shapes', { color: c.value })}
                    className={`w-6 h-6 rounded-full transition-transform cursor-pointer ${
                      toolSettings.shapes.color === c.value
                        ? 'ring-2 ring-blue-500 ring-offset-1 scale-110'
                        : 'opacity-85 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: c.value }}
                  />
                ))}
              </div>

              {/* Custom Color for Shapes */}
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 text-xs">
                <span className="text-slate-600 font-medium">Свой цвет:</span>
                <input
                  type="color"
                  value={toolSettings.shapes.color}
                  onChange={(e) => updateToolSetting('shapes', { color: e.target.value })}
                  className="w-6 h-6 rounded-lg cursor-pointer border-0 p-0 bg-transparent"
                />
              </div>

              {/* Width for shapes */}
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Толщина контура:
              </div>
              <div className="grid grid-cols-4 gap-1">
                {[1, 2, 4, 8].map((size) => (
                  <button
                    key={size}
                    onClick={() => updateToolSetting('shapes', { strokeWidth: size })}
                    className={`py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                      toolSettings.shapes.strokeWidth === size
                        ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-300'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    {size}px
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Text Tool Button & Flyout */}
        <div className="relative">
          <button
            onClick={() => handleToolClick('text')}
            title="Текст и формулы (Нажмите для настройки шрифта и цвета)"
            disabled={!canEdit}
            className={`p-2 rounded-xl transition flex items-center justify-center relative cursor-pointer ${
              tool === 'text'
                ? 'bg-blue-600 text-white shadow-md'
                : 'hover:bg-slate-100 text-slate-700'
            } ${!canEdit ? 'opacity-40 cursor-not-allowed' : ''}`}
          >
            <Type className="w-4 h-4" />
            <span
              className="absolute bottom-1 right-1 w-2 h-2 rounded-full ring-1 ring-white"
              style={{ backgroundColor: toolSettings.text.color }}
            />
          </button>

          {activeToolFlyout === 'text' && canEdit && (
            <div
              className="absolute left-full top-0 ml-2.5 w-56 bg-white rounded-2xl shadow-2xl border border-slate-200 p-3 z-50 animate-in fade-in slide-in-from-left-2 text-slate-800"
              onMouseLeave={() => setActiveToolFlyout(null)}
            >
              <div className="text-[11px] font-bold text-slate-600 mb-2 uppercase tracking-wider flex items-center justify-between">
                <span>Цвет и размер текста</span>
                <span className="font-mono text-blue-600 font-bold">{toolSettings.text.fontSize}px</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5 mb-2.5">
                {QUICK_PALETTES.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => updateToolSetting('text', { color: c.value })}
                    className={`w-6 h-6 rounded-full transition-transform cursor-pointer ${
                      toolSettings.text.color === c.value
                        ? 'ring-2 ring-blue-500 ring-offset-1 scale-110'
                        : 'opacity-85 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: c.value }}
                  />
                ))}
              </div>

              {/* Custom Color for Text */}
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 text-xs">
                <span className="text-slate-600 font-medium">Свой цвет:</span>
                <input
                  type="color"
                  value={toolSettings.text.color}
                  onChange={(e) => updateToolSetting('text', { color: e.target.value })}
                  className="w-6 h-6 rounded-lg cursor-pointer border-0 p-0 bg-transparent"
                />
              </div>

              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Размер шрифта:
              </div>
              <div className="grid grid-cols-3 gap-1">
                {[
                  { label: 'S (18px)', size: 18 },
                  { label: 'M (24px)', size: 24 },
                  { label: 'L (36px)', size: 36 },
                ].map((item) => (
                  <button
                    key={item.size}
                    onClick={() => updateToolSetting('text', { fontSize: item.size })}
                    className={`py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                      toolSettings.text.fontSize === item.size
                        ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-300'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Image upload */}
        <button
          onClick={() => {
            setActiveToolFlyout(null);
            fileInputRef.current?.click();
          }}
          title="Вставить фото / задачу / рисунок"
          disabled={!canEdit}
          className={`p-2 rounded-xl transition flex items-center justify-center hover:bg-slate-100 text-slate-700 cursor-pointer ${
            !canEdit ? 'opacity-40 cursor-not-allowed' : ''
          }`}
        >
          <ImageIcon className="w-4 h-4" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageFileChange}
        />

        {/* Laser Pointer */}
        <button
          onClick={() => {
            setTool('laser');
            setActiveToolFlyout(null);
          }}
          title="Лазерная указка (для объяснения)"
          className={`p-2 rounded-xl transition flex items-center justify-center cursor-pointer ${
            tool === 'laser'
              ? 'bg-rose-600 text-white shadow-md animate-pulse'
              : 'hover:bg-slate-100 text-slate-700'
          }`}
        >
          <Flame className="w-4 h-4 text-rose-500" />
        </button>

        {/* Math Toolbar Toggle */}
        {onToggleMath && (
          <button
            onClick={onToggleMath}
            title="Математические формулы и символы"
            className={`p-2 rounded-xl transition flex items-center justify-center cursor-pointer ${
              isMathOpen
                ? 'bg-indigo-600 text-white shadow-md'
                : 'hover:bg-slate-100 text-slate-700'
            }`}
          >
            <Sigma className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="w-6 h-px bg-slate-200" />

      {/* 3. Background Board Styles */}
      <div className="flex flex-col items-center gap-1.5 w-full">
        {/* Background button & flyout */}
        <div className="relative">
          <button
            onClick={() => setActiveToolFlyout(activeToolFlyout === 'bg' ? null : 'bg')}
            title="Сменить фон доски (Клетка, Линейка, Меловая)"
            className="p-1.5 rounded-xl text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <Layers className="w-4 h-4" />
          </button>

          {activeToolFlyout === 'bg' && (
            <div
              className="absolute left-full top-0 ml-2.5 w-56 bg-white rounded-2xl shadow-2xl border border-slate-200 p-2 z-50 animate-in fade-in slide-in-from-left-2 text-slate-800"
              onMouseLeave={() => setActiveToolFlyout(null)}
            >
              <div className="text-[11px] font-bold text-slate-600 px-2 py-1 uppercase tracking-wider">
                Фон доски
              </div>
              <div className="space-y-1">
                {backgrounds.map((bg) => (
                  <button
                    key={bg.id}
                    onClick={() => {
                      setBackground(bg.id);
                      getSocket().emit('board:background:set', { background: bg.id });
                      setActiveToolFlyout(null);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-xl transition flex flex-col cursor-pointer ${
                      background === bg.id
                        ? 'bg-blue-50 text-blue-900 font-semibold'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span className="text-xs font-semibold">{bg.label}</span>
                    <span className="text-[10px] text-slate-500">{bg.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="w-6 h-px bg-slate-200" />

      {/* 4. Board State & Utility Actions */}
      <div className="flex flex-col items-center gap-1 w-full">
        {/* Undo */}
        <button
          onClick={onUndo}
          disabled={!canUndo || !canEdit}
          title="Отменить (Ctrl+Z)"
          className="p-2 rounded-xl text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
        >
          <Undo2 className="w-4 h-4" />
        </button>

        {/* Redo */}
        <button
          onClick={onRedo}
          disabled={!canRedo || !canEdit}
          title="Повторить (Ctrl+Y)"
          className="p-2 rounded-xl text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
        >
          <Redo2 className="w-4 h-4" />
        </button>

        {/* Clear Board */}
        <button
          onClick={onClearPage}
          disabled={!canEdit}
          title="Очистить доску"
          className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl transition disabled:opacity-30 cursor-pointer"
        >
          <Trash2 className="w-4 h-4" />
        </button>

        {/* Export PNG */}
        <button
          onClick={onExport}
          title="Скачать доску (PNG)"
          className="p-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs transition shadow-sm cursor-pointer"
        >
          <Download className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
};
