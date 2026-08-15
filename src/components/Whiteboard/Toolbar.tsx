import React, { useRef, useState } from 'react';
import {
  ToolType,
  BackgroundType,
  UserRole,
  ImageElement,
  WhiteboardElement,
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
  ChevronDown,
  Undo2,
  Redo2,
  Trash2,
  Download,
  Plus,
  ChevronLeft,
  ChevronRight,
  Layers,
  Sparkles,
} from 'lucide-react';

interface ToolbarProps {
  tool: ToolType;
  setTool: (tool: ToolType) => void;
  color: string;
  setColor: (color: string) => void;
  strokeWidth: number;
  setStrokeWidth: (w: number) => void;
  background: BackgroundType;
  setBackground: (bg: BackgroundType) => void;
  canEdit: boolean;
  userRole: UserRole;
  userName: string;
  userColor: string;
  pageIndex: number;
  totalPages: number;
  onPageChange: (index: number) => void;
  onAddPage: () => void;
  onClearPage: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onImageUploaded: (imgEl: ImageElement) => void;
  onExport: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  tool,
  setTool,
  color,
  setColor,
  strokeWidth,
  setStrokeWidth,
  background,
  setBackground,
  canEdit,
  userRole,
  userName,
  userColor,
  pageIndex,
  totalPages,
  onPageChange,
  onAddPage,
  onClearPage,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onImageUploaded,
  onExport,
}) => {
  const [showShapeMenu, setShowShapeMenu] = useState(false);
  const [showBgMenu, setShowBgMenu] = useState(false);
  const [showColorMenu, setShowColorMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const shapeTools: { id: ToolType; label: string; icon: React.ReactNode }[] = [
    { id: 'line', label: 'Прямая линия', icon: <Minus className="w-4 h-4" /> },
    { id: 'arrow', label: 'Стрелка / Вектор', icon: <ArrowRight className="w-4 h-4" /> },
    { id: 'rect', label: 'Прямоугольник', icon: <Square className="w-4 h-4" /> },
    { id: 'circle', label: 'Окружность / Эллипс', icon: <Circle className="w-4 h-4" /> },
    { id: 'triangle', label: 'Треугольник', icon: <Triangle className="w-4 h-4" /> },
    { id: 'coordSystem', label: 'Система координат X-Y', icon: <Grid3X3 className="w-4 h-4" /> },
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
        // Calculate nice dimensions
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
          id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          userId: 'self',
          userName,
          userColor,
          type: 'image',
          x: 100,
          y: 100,
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

  return (
    <aside
      id="tutorboard-toolbar"
      aria-label="Панель инструментов доски"
      className="bg-white/95 backdrop-blur-md shadow-lg border border-slate-200/80 rounded-2xl p-1.5 flex flex-wrap items-center justify-between gap-2 max-w-full"
    >
      {/* Left tool group: Primary tools */}
      <div className="flex items-center gap-1">
        {/* Select */}
        <button
          onClick={() => setTool('select')}
          title="Выделение и перемещение"
          className={`p-2 rounded-xl text-slate-700 transition flex items-center justify-center ${
            tool === 'select'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'hover:bg-slate-100 text-slate-700'
          }`}
        >
          <MousePointer className="w-4 h-4" />
        </button>

        {/* Hand / Pan */}
        <button
          onClick={() => setTool('pan')}
          title="Рука (Панорамирование доски)"
          className={`p-2 rounded-xl text-slate-700 transition flex items-center justify-center ${
            tool === 'pan'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'hover:bg-slate-100 text-slate-700'
          }`}
        >
          <Hand className="w-4 h-4" />
        </button>

        <div className="h-6 w-px bg-slate-200 mx-0.5" />

        {/* Pen */}
        <button
          onClick={() => setTool('pen')}
          title="Перо / Ручка (Рисование)"
          disabled={!canEdit}
          className={`p-2 rounded-xl transition flex items-center justify-center ${
            tool === 'pen'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'hover:bg-slate-100 text-slate-700'
          } ${!canEdit ? 'opacity-40 cursor-not-allowed' : ''}`}
        >
          <Pencil className="w-4 h-4" />
        </button>

        {/* Highlighter */}
        <button
          onClick={() => setTool('highlighter')}
          title="Маркер / Текстовыделитель"
          disabled={!canEdit}
          className={`p-2 rounded-xl transition flex items-center justify-center ${
            tool === 'highlighter'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'hover:bg-slate-100 text-slate-700'
          } ${!canEdit ? 'opacity-40 cursor-not-allowed' : ''}`}
        >
          <Highlighter className="w-4 h-4" />
        </button>

        {/* Eraser */}
        <button
          onClick={() => setTool('eraser')}
          title="Ластик"
          disabled={!canEdit}
          className={`p-2 rounded-xl transition flex items-center justify-center ${
            tool === 'eraser'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'hover:bg-slate-100 text-slate-700'
          } ${!canEdit ? 'opacity-40 cursor-not-allowed' : ''}`}
        >
          <Eraser className="w-4 h-4" />
        </button>

        {/* Shapes Menu */}
        <div className="relative">
          <button
            onClick={() => {
              if (isShapeActive) {
                setShowShapeMenu(!showShapeMenu);
              } else {
                setTool(activeShape.id);
                setShowShapeMenu(true);
              }
            }}
            title="Геометрические фигуры"
            disabled={!canEdit}
            className={`p-2 rounded-xl transition flex items-center gap-1 ${
              isShapeActive
                ? 'bg-blue-600 text-white shadow-sm'
                : 'hover:bg-slate-100 text-slate-700'
            } ${!canEdit ? 'opacity-40 cursor-not-allowed' : ''}`}
          >
            {activeShape.icon}
            <ChevronDown className="w-3 h-3 opacity-70" />
          </button>

          {showShapeMenu && canEdit && (
            <div
              className="absolute left-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 p-1.5 z-50 animate-in fade-in"
              onMouseLeave={() => setShowShapeMenu(false)}
            >
              <div className="text-[11px] font-semibold text-slate-600 px-2 py-1 uppercase tracking-wider">
                Фигуры и Графика
              </div>
              {shapeTools.map((shape) => (
                <button
                  key={shape.id}
                  onClick={() => {
                    setTool(shape.id);
                    setShowShapeMenu(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
                    tool === shape.id
                      ? 'bg-blue-50 text-blue-700 font-semibold'
                      : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <span className="p-1 rounded bg-slate-100 text-slate-700">{shape.icon}</span>
                  {shape.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Text */}
        <button
          onClick={() => setTool('text')}
          title="Текст и формулы"
          disabled={!canEdit}
          className={`p-2 rounded-xl transition flex items-center justify-center ${
            tool === 'text'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'hover:bg-slate-100 text-slate-700'
          } ${!canEdit ? 'opacity-40 cursor-not-allowed' : ''}`}
        >
          <Type className="w-4 h-4" />
        </button>

        {/* Image upload */}
        <button
          onClick={() => fileInputRef.current?.click()}
          title="Загрузить изображение (задача, фото, схема)"
          disabled={!canEdit}
          className={`p-2 rounded-xl transition flex items-center justify-center hover:bg-slate-100 text-slate-700 ${
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
          onClick={() => setTool('laser')}
          title="Лазерная указка (для объяснения формул)"
          className={`p-2 rounded-xl transition flex items-center justify-center ${
            tool === 'laser'
              ? 'bg-rose-600 text-white shadow-sm animate-pulse'
              : 'hover:bg-slate-100 text-slate-700'
          }`}
        >
          <Flame className="w-4 h-4 text-rose-500" />
        </button>
      </div>

      {/* Middle: Color palette & Stroke width */}
      <div className="flex items-center gap-2">
        {/* Colors */}
        <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200">
          {QUICK_PALETTES.slice(0, 6).map((c) => (
            <button
              key={c.value}
              onClick={() => setColor(c.value)}
              title={c.name}
              className={`w-6 h-6 rounded-full transition-transform ${
                color === c.value
                  ? 'ring-2 ring-blue-500 ring-offset-2 scale-110'
                  : 'hover:scale-105 opacity-85 hover:opacity-100'
              }`}
              style={{ backgroundColor: c.value }}
            />
          ))}

          {/* Color picker */}
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            title="Выбрать любой цвет"
            className="w-6 h-6 rounded-full cursor-pointer border-0 p-0 bg-transparent"
          />
        </div>

        {/* Stroke width selector */}
        <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-xl border border-slate-200">
          {STROKE_WIDTHS.map((sw) => (
            <button
              key={sw.size}
              onClick={() => setStrokeWidth(sw.size)}
              title={`${sw.label} (${sw.size}px)`}
              className={`p-1.5 rounded-lg flex items-center justify-center transition ${
                strokeWidth === sw.size
                  ? 'bg-white shadow-sm text-blue-600'
                  : 'text-slate-600 hover:text-slate-700'
              }`}
            >
              <div
                className="rounded-full bg-current"
                style={{
                  width: `${Math.max(3, Math.min(14, sw.size / 2 + 2))}px`,
                  height: `${Math.max(3, Math.min(14, sw.size / 2 + 2))}px`,
                }}
              />
            </button>
          ))}
        </div>

        {/* Background Selector */}
        <div className="relative">
          <button
            onClick={() => setShowBgMenu(!showBgMenu)}
            title="Фон доски (Клетка, Линейка, Меловая доска)"
            className="px-2.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <Layers className="w-3.5 h-3.5 text-blue-600" />
            <span className="hidden sm:inline">
              {backgrounds.find((b) => b.id === background)?.label || 'Фон'}
            </span>
            <ChevronDown className="w-3 h-3 text-slate-600" />
          </button>

          {showBgMenu && (
            <div
              className="absolute right-0 top-full mt-2 w-60 bg-white rounded-xl shadow-xl border border-slate-200 p-1.5 z-50 animate-in fade-in"
              onMouseLeave={() => setShowBgMenu(false)}
            >
              <div className="text-[11px] font-semibold text-slate-600 px-2 py-1 uppercase tracking-wider">
                Тип фона доски
              </div>
              {backgrounds.map((bg) => (
                <button
                  key={bg.id}
                  onClick={() => {
                    setBackground(bg.id);
                    getSocket().emit('board:background:set', { background: bg.id });
                    setShowBgMenu(false);
                  }}
                  className={`w-full text-left px-2.5 py-2 rounded-lg transition flex flex-col ${
                    background === bg.id
                      ? 'bg-blue-50 text-blue-900 font-semibold'
                      : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <span className="text-xs font-semibold">{bg.label}</span>
                  <span className="text-[10px] text-slate-600">{bg.desc}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: Pages, Undo/Redo, Export, Clear */}
      <div className="flex items-center gap-1">
        {/* Undo / Redo */}
        <button
          onClick={onUndo}
          disabled={!canUndo || !canEdit}
          title="Отменить (Ctrl+Z)"
          className="p-1.5 rounded-lg text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition"
        >
          <Undo2 className="w-4 h-4" />
        </button>

        <button
          onClick={onRedo}
          disabled={!canRedo || !canEdit}
          title="Повторить (Ctrl+Y)"
          className="p-1.5 rounded-lg text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition"
        >
          <Redo2 className="w-4 h-4" />
        </button>

        <div className="h-6 w-px bg-slate-200 mx-0.5" />

        {/* Multi-page Navigation */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => onPageChange(Math.max(0, pageIndex - 1))}
            disabled={pageIndex === 0}
            title="Предыдущая страница"
            className="p-1 rounded text-slate-600 hover:text-slate-900 disabled:opacity-30 transition"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs font-semibold text-slate-700 px-1 whitespace-nowrap">
            {pageIndex + 1} / {totalPages}
          </span>
          <button
            onClick={() => onPageChange(Math.min(totalPages - 1, pageIndex + 1))}
            disabled={pageIndex >= totalPages - 1}
            title="Следующая страница"
            className="p-1 rounded text-slate-600 hover:text-slate-900 disabled:opacity-30 transition"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onAddPage}
            title="Добавить новую страницу доски"
            className="p-1 bg-white rounded shadow-sm text-blue-600 hover:bg-blue-50 transition"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="h-6 w-px bg-slate-200 mx-0.5" />

        {/* Clear Page */}
        <button
          onClick={onClearPage}
          disabled={!canEdit}
          title="Очистить текущую страницу"
          className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl transition disabled:opacity-30"
        >
          <Trash2 className="w-4 h-4" />
        </button>

        {/* Export */}
        <button
          onClick={onExport}
          title="Скачать доску (PNG изображение)"
          className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition flex items-center gap-1.5 shadow-sm"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Экспорт</span>
        </button>
      </div>
    </aside>
  );
};
