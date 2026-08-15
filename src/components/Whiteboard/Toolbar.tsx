import React, { useRef, useState } from 'react';
import {
  ToolType,
  BackgroundType,
  UserRole,
  ImageElement,
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
  ChevronRight,
  Undo2,
  Redo2,
  Trash2,
  Download,
  Plus,
  ChevronLeft,
  Layers,
  Palette,
  Sigma,
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
  onToggleMath?: () => void;
  isMathOpen?: boolean;
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
  onToggleMath,
  isMathOpen,
}) => {
  const [showShapeMenu, setShowShapeMenu] = useState(false);
  const [showBgMenu, setShowBgMenu] = useState(false);
  const [showColorMenu, setShowColorMenu] = useState(false);
  const [showStrokeMenu, setShowStrokeMenu] = useState(false);
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

  const closeAllMenus = () => {
    setShowShapeMenu(false);
    setShowBgMenu(false);
    setShowColorMenu(false);
    setShowStrokeMenu(false);
  };

  return (
    <aside
      id="tutorboard-vertical-toolbar"
      aria-label="Панель инструментов доски"
      className="bg-white/95 backdrop-blur-md shadow-2xl border border-slate-200/90 rounded-2xl p-1.5 flex flex-col items-center gap-1.5 select-none z-40"
    >
      {/* 1. Primary Navigation Tools */}
      <div className="flex flex-col items-center gap-1 w-full">
        {/* Select */}
        <button
          onClick={() => {
            setTool('select');
            closeAllMenus();
          }}
          title="Выделение и перемещение (V)"
          className={`p-2 rounded-xl transition flex items-center justify-center ${
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
            closeAllMenus();
          }}
          title="Рука (Панорамирование доски / ПКМ)"
          className={`p-2 rounded-xl transition flex items-center justify-center ${
            tool === 'pan'
              ? 'bg-blue-600 text-white shadow-md'
              : 'hover:bg-slate-100 text-slate-700'
          }`}
        >
          <Hand className="w-4 h-4" />
        </button>
      </div>

      <div className="w-6 h-px bg-slate-200" />

      {/* 2. Drawing Tools */}
      <div className="flex flex-col items-center gap-1 w-full">
        {/* Pen */}
        <button
          onClick={() => {
            setTool('pen');
            closeAllMenus();
          }}
          title="Перо / Ручка (P)"
          disabled={!canEdit}
          className={`p-2 rounded-xl transition flex items-center justify-center ${
            tool === 'pen'
              ? 'bg-blue-600 text-white shadow-md'
              : 'hover:bg-slate-100 text-slate-700'
          } ${!canEdit ? 'opacity-40 cursor-not-allowed' : ''}`}
        >
          <Pencil className="w-4 h-4" />
        </button>

        {/* Highlighter */}
        <button
          onClick={() => {
            setTool('highlighter');
            closeAllMenus();
          }}
          title="Маркер / Текстовыделитель"
          disabled={!canEdit}
          className={`p-2 rounded-xl transition flex items-center justify-center ${
            tool === 'highlighter'
              ? 'bg-blue-600 text-white shadow-md'
              : 'hover:bg-slate-100 text-slate-700'
          } ${!canEdit ? 'opacity-40 cursor-not-allowed' : ''}`}
        >
          <Highlighter className="w-4 h-4" />
        </button>

        {/* Eraser */}
        <button
          onClick={() => {
            setTool('eraser');
            closeAllMenus();
          }}
          title="Ластик (E)"
          disabled={!canEdit}
          className={`p-2 rounded-xl transition flex items-center justify-center ${
            tool === 'eraser'
              ? 'bg-blue-600 text-white shadow-md'
              : 'hover:bg-slate-100 text-slate-700'
          } ${!canEdit ? 'opacity-40 cursor-not-allowed' : ''}`}
        >
          <Eraser className="w-4 h-4" />
        </button>

        {/* Shapes Menu Flyout */}
        <div className="relative">
          <button
            onClick={() => {
              if (isShapeActive) {
                setShowShapeMenu(!showShapeMenu);
              } else {
                setTool(activeShape.id);
                setShowShapeMenu(true);
              }
              setShowBgMenu(false);
              setShowColorMenu(false);
              setShowStrokeMenu(false);
            }}
            title="Геометрические фигуры"
            disabled={!canEdit}
            className={`p-2 rounded-xl transition flex items-center justify-center ${
              isShapeActive
                ? 'bg-blue-600 text-white shadow-md'
                : 'hover:bg-slate-100 text-slate-700'
            } ${!canEdit ? 'opacity-40 cursor-not-allowed' : ''}`}
          >
            {activeShape.icon}
          </button>

          {showShapeMenu && canEdit && (
            <div
              className="absolute left-full top-0 ml-2 w-56 bg-white rounded-2xl shadow-2xl border border-slate-200 p-2 z-50 animate-in fade-in slide-in-from-left-2"
              onMouseLeave={() => setShowShapeMenu(false)}
            >
              <div className="text-[11px] font-bold text-slate-600 px-2 py-1 uppercase tracking-wider">
                Фигуры и Графика
              </div>
              <div className="space-y-1">
                {shapeTools.map((shape) => (
                  <button
                    key={shape.id}
                    onClick={() => {
                      setTool(shape.id);
                      setShowShapeMenu(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition ${
                      tool === shape.id
                        ? 'bg-blue-50 text-blue-700 font-semibold'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span className="p-1 rounded-lg bg-slate-100 text-slate-700">{shape.icon}</span>
                    <span>{shape.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Text */}
        <button
          onClick={() => {
            setTool('text');
            closeAllMenus();
          }}
          title="Текст и формулы (T)"
          disabled={!canEdit}
          className={`p-2 rounded-xl transition flex items-center justify-center ${
            tool === 'text'
              ? 'bg-blue-600 text-white shadow-md'
              : 'hover:bg-slate-100 text-slate-700'
          } ${!canEdit ? 'opacity-40 cursor-not-allowed' : ''}`}
        >
          <Type className="w-4 h-4" />
        </button>

        {/* Image upload */}
        <button
          onClick={() => {
            closeAllMenus();
            fileInputRef.current?.click();
          }}
          title="Вставить фото / задачу / рисунок"
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
          onClick={() => {
            setTool('laser');
            closeAllMenus();
          }}
          title="Лазерная указка (для объяснения)"
          className={`p-2 rounded-xl transition flex items-center justify-center ${
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
            className={`p-2 rounded-xl transition flex items-center justify-center ${
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

      {/* 3. Color & Stroke Flyouts */}
      <div className="flex flex-col items-center gap-1.5 w-full">
        {/* Active Color button & flyout */}
        <div className="relative">
          <button
            onClick={() => {
              setShowColorMenu(!showColorMenu);
              setShowShapeMenu(false);
              setShowBgMenu(false);
              setShowStrokeMenu(false);
            }}
            title="Палитра цветов"
            className="w-7 h-7 rounded-full shadow-inner ring-2 ring-slate-300 ring-offset-1 transition hover:scale-105"
            style={{ backgroundColor: color }}
          />

          {showColorMenu && (
            <div
              className="absolute left-full top-0 ml-2 w-48 bg-white rounded-2xl shadow-2xl border border-slate-200 p-3 z-50 animate-in fade-in slide-in-from-left-2"
              onMouseLeave={() => setShowColorMenu(false)}
            >
              <div className="text-[11px] font-bold text-slate-600 mb-2 uppercase tracking-wider">
                Цвет маркера
              </div>
              <div className="grid grid-cols-4 gap-2">
                {QUICK_PALETTES.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => {
                      setColor(c.value);
                      setShowColorMenu(false);
                    }}
                    title={c.name}
                    className={`w-7 h-7 rounded-full transition-transform ${
                      color === c.value
                        ? 'ring-2 ring-blue-500 ring-offset-2 scale-110'
                        : 'hover:scale-105 opacity-90 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: c.value }}
                  />
                ))}
              </div>
              <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-600">Свой цвет:</span>
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-6 h-6 rounded-full cursor-pointer border-0 p-0 bg-transparent"
                />
              </div>
            </div>
          )}
        </div>

        {/* Stroke Width button & flyout */}
        <div className="relative">
          <button
            onClick={() => {
              setShowStrokeMenu(!showStrokeMenu);
              setShowColorMenu(false);
              setShowShapeMenu(false);
              setShowBgMenu(false);
            }}
            title="Толщина линии"
            className="w-7 h-7 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-700 transition"
          >
            <div
              className="rounded-full bg-slate-800"
              style={{
                width: `${Math.max(3, Math.min(14, strokeWidth / 2 + 2))}px`,
                height: `${Math.max(3, Math.min(14, strokeWidth / 2 + 2))}px`,
              }}
            />
          </button>

          {showStrokeMenu && (
            <div
              className="absolute left-full top-0 ml-2 w-40 bg-white rounded-2xl shadow-2xl border border-slate-200 p-2 z-50 animate-in fade-in slide-in-from-left-2"
              onMouseLeave={() => setShowStrokeMenu(false)}
            >
              <div className="text-[11px] font-bold text-slate-600 px-2 py-1 uppercase tracking-wider">
                Толщина линии
              </div>
              <div className="space-y-1">
                {STROKE_WIDTHS.map((sw) => (
                  <button
                    key={sw.size}
                    onClick={() => {
                      setStrokeWidth(sw.size);
                      setShowStrokeMenu(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs transition ${
                      strokeWidth === sw.size
                        ? 'bg-blue-50 text-blue-700 font-bold'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span>{sw.label}</span>
                    <div
                      className="rounded-full bg-current"
                      style={{
                        width: `${Math.max(3, Math.min(16, sw.size / 2 + 3))}px`,
                        height: `${Math.max(3, Math.min(16, sw.size / 2 + 3))}px`,
                      }}
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Background button & flyout */}
        <div className="relative">
          <button
            onClick={() => {
              setShowBgMenu(!showBgMenu);
              setShowColorMenu(false);
              setShowStrokeMenu(false);
              setShowShapeMenu(false);
            }}
            title="Сменить фон доски (Клетка, Линейка, Меловая)"
            className="p-1.5 rounded-xl text-slate-700 hover:bg-slate-100 transition"
          >
            <Layers className="w-4 h-4" />
          </button>

          {showBgMenu && (
            <div
              className="absolute left-full top-0 ml-2 w-56 bg-white rounded-2xl shadow-2xl border border-slate-200 p-2 z-50 animate-in fade-in slide-in-from-left-2"
              onMouseLeave={() => setShowBgMenu(false)}
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
                      setShowBgMenu(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-xl transition flex flex-col ${
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
          className="p-2 rounded-xl text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition"
        >
          <Undo2 className="w-4 h-4" />
        </button>

        {/* Redo */}
        <button
          onClick={onRedo}
          disabled={!canRedo || !canEdit}
          title="Повторить (Ctrl+Y)"
          className="p-2 rounded-xl text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition"
        >
          <Redo2 className="w-4 h-4" />
        </button>

        {/* Page Switcher */}
        <div className="flex flex-col items-center bg-slate-100 rounded-xl p-1 w-full">
          <span className="text-[10px] font-bold text-slate-700 mb-0.5">
            {pageIndex + 1}/{totalPages}
          </span>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => onPageChange(Math.max(0, pageIndex - 1))}
              disabled={pageIndex === 0}
              title="Предыдущая страница"
              className="p-1 rounded text-slate-600 hover:text-slate-900 disabled:opacity-20 transition"
            >
              <ChevronLeft className="w-3 h-3" />
            </button>
            <button
              onClick={() => onPageChange(Math.min(totalPages - 1, pageIndex + 1))}
              disabled={pageIndex >= totalPages - 1}
              title="Следующая страница"
              className="p-1 rounded text-slate-600 hover:text-slate-900 disabled:opacity-20 transition"
            >
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <button
            onClick={onAddPage}
            title="Добавить страницу"
            className="w-full mt-1 py-0.5 bg-white hover:bg-blue-50 text-blue-600 rounded text-[10px] font-bold shadow-xs transition flex items-center justify-center"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>

        {/* Clear Page */}
        <button
          onClick={onClearPage}
          disabled={!canEdit}
          title="Очистить доску"
          className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl transition disabled:opacity-30"
        >
          <Trash2 className="w-4 h-4" />
        </button>

        {/* Export PNG */}
        <button
          onClick={onExport}
          title="Скачать доску (PNG)"
          className="p-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs transition shadow-sm"
        >
          <Download className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
};
