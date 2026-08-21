import React, { useRef, useState, useEffect } from 'react';
import {
  ToolType,
  BackgroundType,
  UserRole,
  ImageElement,
  ToolSpecificSettings,
} from '../../types';
import {
  ToolSkinConfig,
  ToolLayoutConfig,
  ToolTransform,
  DEFAULT_TOOL_TRANSFORMS,
  ExperimentalSkinSettings,
} from '../../types/extra';
import { QUICK_PALETTES, STROKE_WIDTHS } from '../../data/mathSymbols';
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
  Layers,
  Sigma,
  Check,
  Move,
  RotateCcw,
  RotateCw,
  Upload,
  Download,
  Sliders,
  CheckCircle2,
  Compass,
} from 'lucide-react';

interface ExperimentalToolbarProps {
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
  toolSkins?: ToolSkinConfig;
  toolLayouts?: ToolLayoutConfig;
  onSaveLayouts?: (layouts: ToolLayoutConfig) => void;
  onSaveFullSettings?: (settings: ExperimentalSkinSettings) => void;
  onShowToast?: (message: string) => void;
}

interface ToolItemDef {
  id: ToolType;
  skinKey: keyof ToolSkinConfig;
  name: string;
  category: 'primary' | 'drawing' | 'utility';
  icon: React.ReactNode;
  tipType: 'sharp' | 'chisel' | 'block' | 'glow' | 'pointer' | 'ruler' | 'text';
}

const EXPERIMENTAL_TOOLS: ToolItemDef[] = [
  {
    id: 'pen',
    skinKey: 'pen',
    name: 'Карандаш / Перо',
    category: 'drawing',
    icon: <Pencil className="w-3.5 h-3.5" />,
    tipType: 'sharp',
  },
  {
    id: 'highlighter',
    skinKey: 'highlighter',
    name: 'Маркер / Выделитель',
    category: 'drawing',
    icon: <Highlighter className="w-3.5 h-3.5" />,
    tipType: 'chisel',
  },
  {
    id: 'eraser',
    skinKey: 'eraser',
    name: 'Ластик',
    category: 'drawing',
    icon: <Eraser className="w-3.5 h-3.5" />,
    tipType: 'block',
  },
  {
    id: 'laser',
    skinKey: 'laser',
    name: 'Лазерная указка',
    category: 'utility',
    icon: <Flame className="w-3.5 h-3.5" />,
    tipType: 'glow',
  },
  {
    id: 'rect', // represents shapes / ruler
    skinKey: 'shapes',
    name: 'Линейка и фигуры',
    category: 'drawing',
    icon: <Square className="w-3.5 h-3.5" />,
    tipType: 'ruler',
  },
  {
    id: 'text',
    skinKey: 'text',
    name: 'Текст / Формулы',
    category: 'utility',
    icon: <Type className="w-3.5 h-3.5" />,
    tipType: 'text',
  },
  {
    id: 'select',
    skinKey: 'select',
    name: 'Курсор / Выбор',
    category: 'primary',
    icon: <MousePointer className="w-3.5 h-3.5" />,
    tipType: 'pointer',
  },
  {
    id: 'pan',
    skinKey: 'pan',
    name: 'Рука / Панорама',
    category: 'primary',
    icon: <Hand className="w-3.5 h-3.5" />,
    tipType: 'pointer',
  },
];

export const ExperimentalToolbar: React.FC<ExperimentalToolbarProps> = ({
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
  toolSkins = {},
  toolLayouts = DEFAULT_TOOL_TRANSFORMS,
  onSaveLayouts,
  onSaveFullSettings,
  onShowToast,
}) => {
  const [activeToolFlyout, setActiveToolFlyout] = useState<ToolType | 'bg' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const jsonImportRef = useRef<HTMLInputElement>(null);

  // Interactive Layout Customization State
  const [isLayoutEditMode, setIsLayoutEditMode] = useState(false);
  const [currentLayouts, setCurrentLayouts] = useState<ToolLayoutConfig>(() => ({
    ...DEFAULT_TOOL_TRANSFORMS,
    ...(toolLayouts || {}),
  }));
  const [activeDraggingTool, setActiveDraggingTool] = useState<string | null>(null);
  const dragStartRef = useRef<{ toolId: string; startX: number; startY: number; origX: number; origY: number } | null>(null);

  // Keep currentLayouts in sync if prop changes from outside
  useEffect(() => {
    if (toolLayouts) {
      setCurrentLayouts((prev) => ({
        ...DEFAULT_TOOL_TRANSFORMS,
        ...prev,
        ...toolLayouts,
      }));
    }
  }, [toolLayouts]);

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

  const isShapeToolActive = ['rect', 'line', 'arrow', 'circle', 'triangle', 'coordSystem'].includes(tool);

  const handleSelectTool = (targetTool: ToolType) => {
    if (isLayoutEditMode) return; // Prevent selecting tool during layout edit mode
    if (!canEdit && targetTool !== 'select' && targetTool !== 'pan') return;

    if (tool === targetTool || (targetTool === 'rect' && isShapeToolActive)) {
      // Toggle flyout
      setActiveToolFlyout(activeToolFlyout === targetTool ? null : targetTool);
    } else {
      setTool(targetTool);
      if (['pen', 'highlighter', 'eraser', 'text', 'line', 'arrow', 'rect', 'circle', 'triangle', 'coordSystem'].includes(targetTool)) {
        setActiveToolFlyout(targetTool);
      } else {
        setActiveToolFlyout(null);
      }
    }
  };

  // Helper to get sanitized transform for tool
  const getToolTransform = (toolId: string): ToolTransform => {
    const custom = currentLayouts[toolId];
    return {
      x: custom?.x ?? 0,
      y: custom?.y ?? 0,
      scale: custom?.scale ?? 1.5,
      rotation: custom?.rotation !== undefined ? custom.rotation : -45,
    };
  };

  // Dragging logic for tools in Edit Mode
  const handleToolPointerDown = (e: React.PointerEvent, toolId: string) => {
    if (!isLayoutEditMode) return;
    e.preventDefault();
    e.stopPropagation();

    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);

    const currentT = getToolTransform(toolId);
    dragStartRef.current = {
      toolId,
      startX: e.clientX,
      startY: e.clientY,
      origX: currentT.x,
      origY: currentT.y,
    };
    setActiveDraggingTool(toolId);
  };

  const handleToolPointerMove = (e: React.PointerEvent) => {
    if (!isLayoutEditMode || !dragStartRef.current) return;
    e.preventDefault();

    const { toolId, startX, startY, origX, origY } = dragStartRef.current;
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;

    setCurrentLayouts((prev) => {
      const existing = prev[toolId] || { x: 0, y: 0, scale: 1.5, rotation: -45 };
      return {
        ...prev,
        [toolId]: {
          ...existing,
          x: Math.round(origX + deltaX),
          y: Math.round(origY + deltaY),
        },
      };
    });
  };

  const handleToolPointerUp = (e: React.PointerEvent) => {
    if (!isLayoutEditMode || !dragStartRef.current) return;
    try {
      const target = e.currentTarget as HTMLElement;
      target.releasePointerCapture(e.pointerId);
    } catch {}
    dragStartRef.current = null;
    setActiveDraggingTool(null);
  };

  // Adjust Tool Scale
  const handleAdjustScale = (toolId: string, delta: number) => {
    setCurrentLayouts((prev) => {
      const existing = prev[toolId] || { x: 0, y: 0, scale: 1.5, rotation: -45 };
      const currentScale = existing.scale ?? 1.5;
      const newScale = Math.max(0.4, Math.min(3.5, Number((currentScale + delta).toFixed(2))));
      return {
        ...prev,
        [toolId]: {
          ...existing,
          scale: newScale,
        },
      };
    });
  };

  // Adjust Tool Rotation
  const handleAdjustRotation = (toolId: string, deltaDeg: number) => {
    setCurrentLayouts((prev) => {
      const existing = prev[toolId] || { x: 0, y: 0, scale: 1.5, rotation: -45 };
      const curRot = existing.rotation !== undefined ? existing.rotation : -45;
      let newRot = curRot + deltaDeg;
      // Normalize angle between -180 and 180 degrees
      while (newRot > 180) newRot -= 360;
      while (newRot <= -180) newRot += 360;
      return {
        ...prev,
        [toolId]: {
          ...existing,
          rotation: Math.round(newRot),
        },
      };
    });
  };

  // Adjust Wheel on Tool (Scale or Shift+Rotate)
  const handleToolWheel = (e: React.WheelEvent, toolId: string) => {
    if (!isLayoutEditMode) return;
    e.stopPropagation();
    e.preventDefault();
    if (e.shiftKey || e.altKey) {
      const deltaAngle = e.deltaY < 0 ? 5 : -5;
      handleAdjustRotation(toolId, deltaAngle);
    } else {
      const deltaScale = e.deltaY < 0 ? 0.1 : -0.1;
      handleAdjustScale(toolId, deltaScale);
    }
  };

  // Reset individual tool position, scale and rotation
  const handleResetSingleTool = (toolId: string) => {
    setCurrentLayouts((prev) => ({
      ...prev,
      [toolId]: { x: 0, y: 0, scale: 1.5, rotation: -45 },
    }));
  };

  // Reset all tool positions
  const handleResetAllLayouts = () => {
    setCurrentLayouts(DEFAULT_TOOL_TRANSFORMS);
    if (onShowToast) onShowToast('Все положения, размеры и углы инструментов сброшены');
  };

  // Export complete JSON toolpack (Layouts + Transforms + Custom Tool PNG Skins)
  const exportFullToolPackFile = (layoutsToExport: ToolLayoutConfig) => {
    const configData = {
      appName: 'TutorBoard',
      format: 'tutorboard-3d-toolpack',
      version: '1.0',
      exportedAt: new Date().toISOString(),
      enabled: true,
      toolLayouts: layoutsToExport,
      toolSkins: toolSkins || {},
    };

    const jsonStr = JSON.stringify(configData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `tutorboard-3d-toolpack-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Toggle layout edit mode & save / download file
  const handleToggleLayoutEditMode = () => {
    if (isLayoutEditMode) {
      // Exiting Edit Mode -> Lock, Save to Parent/LocalStorage and Download Full Pack!
      if (onSaveLayouts) {
        onSaveLayouts(currentLayouts);
      }
      exportFullToolPackFile(currentLayouts);
      setIsLayoutEditMode(false);
      if (onShowToast) {
        onShowToast('✓ Положение, размер, поворот и скины сохранены! Файл пака скачан');
      }
    } else {
      // Entering Edit Mode
      setActiveToolFlyout(null);
      setIsLayoutEditMode(true);
      if (onShowToast) {
        onShowToast('🎯 Режим настройки: перетаскивайте, меняйте масштаб (+/-) и поворот (↺/↻)');
      }
    }
  };

  // Import JSON toolpack from file (loads both positions/scales/rotations AND custom PNG images)
  const handleImportJsonFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        if (parsed && typeof parsed === 'object') {
          const layouts = parsed.toolLayouts || (parsed.pen?.scale !== undefined ? parsed : null) || {};
          const skins = (parsed.toolSkins && typeof parsed.toolSkins === 'object') ? parsed.toolSkins : {};

          const mergedLayouts = {
            ...DEFAULT_TOOL_TRANSFORMS,
            ...layouts,
          };
          setCurrentLayouts(mergedLayouts);

          const mergedSkins = {
            ...toolSkins,
            ...skins,
          };

          if (onSaveFullSettings) {
            onSaveFullSettings({
              enabled: true,
              toolLayouts: mergedLayouts,
              toolSkins: mergedSkins,
            });
          } else if (onSaveLayouts) {
            onSaveLayouts(mergedLayouts);
          }

          const skinsCount = Object.keys(skins).filter((k) => !!skins[k as keyof ToolSkinConfig]).length;
          if (onShowToast) {
            if (skinsCount > 0) {
              onShowToast(`✨ Пак загружен! Применены расстановка, масштаб, поворот и ${skinsCount} PNG-скинов.`);
            } else {
              onShowToast('✨ Расстановка, масштаб и повороты инструментов успешно применены!');
            }
          }
        }
      } catch (err) {
        console.error('Failed to parse layout config JSON:', err);
        if (onShowToast) {
          onShowToast('Ошибка: не удалось прочитать JSON файл пака');
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Helper to render procedural 3D stationery tool with purple-black grid texture or custom image
  const renderToolTexture = (item: ToolItemDef, isSelected: boolean, rotation: number) => {
    const customImage = toolSkins[item.skinKey];

    if (customImage) {
      return (
        <div className="w-full h-full flex items-center justify-center p-0.5 pointer-events-none select-none">
          <img
            src={customImage}
            alt={item.name}
            className="w-full h-full object-contain filter drop-shadow-xl select-none pointer-events-none"
            style={{ transform: `rotate(${rotation}deg)` }}
          />
        </div>
      );
    }

    // Default: Procedural stationery instrument with high-tech purple-black grid texture
    const activeColor =
      item.id === 'pen'
        ? toolSettings.pen.color
        : item.id === 'highlighter'
        ? toolSettings.highlighter.color
        : item.id === 'laser'
        ? '#ef4444'
        : '#a855f7';

    return (
      <div className="relative w-full h-full flex items-center justify-center pointer-events-none select-none">
        {/* Angled Stationery Body Container rotated at dynamic angle */}
        <div
          className="relative w-40 h-8 flex items-center transition-transform duration-150 filter drop-shadow-lg pointer-events-none select-none"
          style={{ transform: `rotate(${rotation}deg)` }}
        >
          {/* Main Rectangular Hex Barrel with Purple-Black Grid Mesh Texture */}
          <div
            className="relative flex-1 h-7 rounded-l-xs flex items-center overflow-hidden border border-purple-500/80 shadow-md"
            style={{
              backgroundColor: '#0a0314',
              backgroundImage: `
                linear-gradient(to right, rgba(168, 85, 247, 0.5) 1.5px, transparent 1.5px),
                linear-gradient(to bottom, rgba(168, 85, 247, 0.5) 1.5px, transparent 1.5px),
                linear-gradient(45deg, #1d0938 25%, transparent 25%, transparent 75%, #1d0938 75%, #1d0938),
                linear-gradient(45deg, #1d0938 25%, #0a0314 25%, #0a0314 75%, #1d0938 75%, #1d0938)
              `,
              backgroundSize: '8px 8px, 8px 8px, 16px 16px, 16px 16px',
              backgroundPosition: '0 0, 0 0, 0 0, 8px 8px',
            }}
          >
            {/* Top cylindrical 3D highlight */}
            <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-b from-white/30 to-transparent pointer-events-none" />
            {/* Bottom 3D shadow */}
            <div className="absolute inset-x-0 bottom-0 h-1.5 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />

            {/* Micro Badge / Icon on Tool Body */}
            <div className="ml-2.5 px-1.5 py-0.5 bg-purple-950/90 rounded-md text-[10px] font-mono font-bold text-purple-200 border border-purple-400/60 flex items-center gap-1 shadow-inner">
              <span className="scale-90">{item.icon}</span>
            </div>

            {/* Grip ridges / accents */}
            <div className="ml-auto mr-2 flex gap-1 opacity-70">
              <div className="w-1 h-4 bg-purple-400 rounded-full" />
              <div className="w-1 h-4 bg-purple-400 rounded-full" />
              <div className="w-1 h-4 bg-purple-400 rounded-full" />
            </div>
          </div>

          {/* Golden Ferrule / Collar Ring */}
          <div className="w-2.5 h-7 bg-gradient-to-r from-amber-500 via-amber-200 to-amber-600 border-y border-amber-700 shadow-sm z-10 shrink-0" />

          {/* Conical / Chisel Tip (Pointing Diagonally Outward / Up-Right) */}
          {item.tipType === 'sharp' ? (
            // Sharpened Graphite Pencil Nib
            <div className="relative w-6 h-7 flex items-center shrink-0">
              <div
                className="w-full h-full"
                style={{
                  clipPath: 'polygon(0 0, 100% 50%, 0 100%)',
                  backgroundColor: '#d97706',
                }}
              />
              {/* Lead / Ink Nib */}
              <div
                className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-3"
                style={{
                  clipPath: 'polygon(0 30%, 100% 50%, 0 70%)',
                  backgroundColor: activeColor,
                }}
              />
            </div>
          ) : item.tipType === 'chisel' ? (
            // Chisel Highlighter Tip
            <div
              className="w-5 h-7 shrink-0 shadow-sm"
              style={{
                clipPath: 'polygon(0 0, 85% 15%, 100% 85%, 0 100%)',
                backgroundColor: activeColor,
                opacity: 0.95,
                filter: `drop-shadow(0 0 4px ${activeColor})`,
              }}
            />
          ) : item.tipType === 'block' ? (
            // Rubber Bevel Eraser Block
            <div
              className="w-4.5 h-7 shrink-0 shadow-sm border-y border-r border-slate-400"
              style={{
                clipPath: 'polygon(0 0, 100% 20%, 100% 80%, 0 100%)',
                background: 'linear-gradient(135deg, #f43f5e, #fb7185)',
              }}
            />
          ) : (
            // Modern Stylus / Laser / Arrow Tip
            <div
              className="w-5 h-7 shrink-0 shadow-sm"
              style={{
                clipPath: 'polygon(0 15%, 100% 50%, 0 85%)',
                backgroundColor: activeColor,
                filter: isSelected ? `drop-shadow(0 0 8px ${activeColor})` : `drop-shadow(0 0 3px ${activeColor})`,
              }}
            />
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Top HUD Banner when in Interactive Layout Customization Mode */}
      {isLayoutEditMode && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[100] bg-slate-950/95 backdrop-blur-xl border-2 border-purple-500 rounded-3xl p-3 shadow-2xl flex flex-wrap items-center gap-3 animate-in slide-in-from-top-4 text-white max-w-3xl w-[96%]">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-purple-600/30 text-purple-300 rounded-xl border border-purple-400/40 shrink-0">
              <Move className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="text-xs font-extrabold text-purple-200 uppercase tracking-wider flex items-center gap-2">
                <span>Режим расстановки, масштаба и поворота</span>
                <span className="px-2 py-0.2 bg-purple-500/40 text-purple-100 text-[10px] rounded-full">
                  ПЕРЕТАСКИВАНИЕ МЫШЬЮ
                </span>
              </div>
              <div className="text-[11px] text-slate-300 flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                <span>• Тащите инструмент мышью</span>
                <span>• Размер: <b>+/-</b> или колесо</span>
                <span>• Поворот: <b>↺/↻</b> или <b>Shift+колесо</b></span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto shrink-0 flex-wrap">
            {/* Import Full Toolpack JSON */}
            <button
              onClick={() => jsonImportRef.current?.click()}
              title="Загрузить готовый JSON пак (расстановка, масштаб, поворот + ваши PNG скины)"
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-blue-400" />
              <span>Загрузить пак</span>
            </button>

            {/* Export Full Toolpack JSON */}
            <button
              onClick={() => exportFullToolPackFile(currentLayouts)}
              title="Скачать единый JSON файл со всеми скинами и координатами"
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-purple-400" />
              <span>Скачать пак</span>
            </button>

            {/* Reset All Positions */}
            <button
              onClick={handleResetAllLayouts}
              title="Сбросить все положения, размеры и повороты к исходным"
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-600 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            {/* Finish & Download Config */}
            <button
              onClick={handleToggleLayoutEditMode}
              title="Зафиксировать расположение, применить размер/поворот и скачать файл пака"
              className="px-4 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 shadow-lg shadow-purple-600/40 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-300" />
              <span>Зафиксировать (✓)</span>
            </button>
          </div>
        </div>
      )}

      {/* Hidden File Input for JSON Configuration Import */}
      <input
        ref={jsonImportRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleImportJsonFile}
      />

      <aside
        id="tutorboard-experimental-toolbar"
        aria-label="Экспериментальная 3D панель инструментов"
        className="relative flex flex-col items-start select-none z-40 pointer-events-none"
      >
        {/* 45-Degree Tool Rack: Individual customizable positions, scales, and rotations */}
        <div className="flex flex-col items-start gap-1 py-1 -ml-7 sm:-ml-9">
          {EXPERIMENTAL_TOOLS.map((item) => {
            const isSelected = tool === item.id || (item.id === 'rect' && isShapeToolActive);
            const isDisabled = !canEdit && item.id !== 'select' && item.id !== 'pan';
            const transform = getToolTransform(item.id);
            const isDraggingThis = activeDraggingTool === item.id;
            const scaleMultiplier = (transform.scale ?? 1.5) / 1.5;
            const rotationDeg = transform.rotation ?? -45;
            const isFlyoutOpen = activeToolFlyout === item.id;

            return (
              <div
                key={item.id}
                className={`relative group flex items-center pointer-events-auto ${
                  isFlyoutOpen
                    ? 'z-[100]'
                    : isLayoutEditMode
                    ? isDraggingThis
                      ? 'z-[90]'
                      : 'z-40'
                    : isSelected
                    ? 'z-30'
                    : 'z-10'
                }`}
                style={{
                  transform: `translate(${transform.x}px, ${transform.y}px)`,
                  transition: isDraggingThis ? 'none' : 'transform 0.1s ease-out',
                }}
              >
                {/* Scale Multiplier Wrapper Container: Always applies custom size! */}
                <div
                  style={{
                    transform: `scale(${scaleMultiplier})`,
                    transformOrigin: 'center center',
                    transition: isDraggingThis ? 'none' : 'transform 0.15s ease-out',
                  }}
                  className="relative flex items-center justify-center"
                >
                  {/* Steady Atmospheric Ambient Backlight Glow behind the selected tool */}
                  {!isLayoutEditMode && isSelected && (
                    <div
                      className="absolute -inset-5 -z-10 rounded-3xl pointer-events-none transition-all duration-300"
                      style={{
                        background:
                          'radial-gradient(ellipse at center, rgba(168, 85, 247, 0.75) 0%, rgba(129, 140, 248, 0.5) 40%, rgba(99, 102, 241, 0.25) 65%, transparent 82%)',
                        filter: 'blur(12px)',
                      }}
                    />
                  )}

                  {/* Visual Tool Item Button */}
                  <div
                    onPointerDown={(e) => handleToolPointerDown(e, item.id)}
                    onPointerMove={handleToolPointerMove}
                    onPointerUp={handleToolPointerUp}
                    onPointerCancel={handleToolPointerUp}
                    onWheel={(e) => handleToolWheel(e, item.id)}
                    onClick={() => handleSelectTool(item.id)}
                    className={`relative w-36 h-15 rounded-2xl flex items-center justify-center transition-all duration-200 ease-out select-none ${
                      isLayoutEditMode
                        ? 'cursor-grab active:cursor-grabbing border-2 border-dashed border-purple-400 bg-purple-950/40 shadow-xl ring-2 ring-purple-500/30'
                        : isDisabled
                        ? 'opacity-30 cursor-not-allowed'
                        : isSelected
                        ? 'translate-x-7 -translate-y-3.5 scale-110 drop-shadow-2xl z-30 cursor-pointer'
                        : 'hover:scale-115 hover:translate-x-3.5 hover:-translate-y-1 drop-shadow-lg z-10 cursor-pointer'
                    }`}
                    title={
                      isLayoutEditMode
                        ? `${item.name}: Тащите мышью. Колесико — размер (${transform.scale}x). Shift+Колесико — поворот (${rotationDeg}°)`
                        : `${item.name} (${transform.scale}x, ${rotationDeg}°)`
                    }
                  >
                    {/* Visual 3D / PNG representation with dynamic rotation */}
                    {renderToolTexture(item, isSelected, rotationDeg)}

                    {/* Layout Edit Mode Overlay Controls on Tool */}
                    {isLayoutEditMode && (
                      <div
                        className="absolute -top-9 left-1/2 -translate-x-1/2 bg-slate-950/98 text-white border-2 border-purple-400/90 rounded-2xl px-2.5 py-1 text-[11px] font-mono font-bold flex items-center gap-2 shadow-2xl whitespace-nowrap z-[120] pointer-events-auto backdrop-blur-xl ring-2 ring-purple-950"
                        onPointerDown={(e) => {
                          e.stopPropagation();
                        }}
                        onPointerUp={(e) => {
                          e.stopPropagation();
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                      >
                        {/* Drag Handle Indicator */}
                        <div
                          title="Зажмите и перетаскивайте"
                          className="flex items-center gap-1 text-purple-300 border-r border-slate-700 pr-1.5 cursor-grab"
                        >
                          <Move className="w-3.5 h-3.5" />
                        </div>

                        {/* Scale Controls */}
                        <div className="flex items-center gap-1 border-r border-slate-700 pr-2">
                          <button
                            type="button"
                            onPointerDown={(e) => e.stopPropagation()}
                            onPointerUp={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleAdjustScale(item.id, -0.1);
                            }}
                            title="Уменьшить размер"
                            className="w-5 h-5 bg-slate-800 hover:bg-purple-600 active:scale-95 text-slate-200 hover:text-white rounded-md flex items-center justify-center cursor-pointer font-extrabold text-sm transition"
                          >
                            -
                          </button>
                          <span className="text-purple-200 min-w-[32px] text-center font-bold">{transform.scale}x</span>
                          <button
                            type="button"
                            onPointerDown={(e) => e.stopPropagation()}
                            onPointerUp={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleAdjustScale(item.id, 0.1);
                            }}
                            title="Увеличить размер"
                            className="w-5 h-5 bg-slate-800 hover:bg-purple-600 active:scale-95 text-slate-200 hover:text-white rounded-md flex items-center justify-center cursor-pointer font-extrabold text-sm transition"
                          >
                            +
                          </button>
                        </div>

                        {/* Rotation Controls */}
                        <div className="flex items-center gap-1 border-r border-slate-700 pr-2">
                          <button
                            type="button"
                            onPointerDown={(e) => e.stopPropagation()}
                            onPointerUp={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleAdjustRotation(item.id, -15);
                            }}
                            title="Повернуть против часовой стрелки на 15°"
                            className="w-5 h-5 bg-slate-800 hover:bg-cyan-600 active:scale-95 text-cyan-300 hover:text-white rounded-md flex items-center justify-center cursor-pointer transition"
                          >
                            <RotateCcw className="w-3 h-3" />
                          </button>
                          <span className="text-cyan-300 min-w-[34px] text-center font-bold">{rotationDeg}°</span>
                          <button
                            type="button"
                            onPointerDown={(e) => e.stopPropagation()}
                            onPointerUp={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleAdjustRotation(item.id, 15);
                            }}
                            title="Повернуть по часовой стрелке на 15°"
                            className="w-5 h-5 bg-slate-800 hover:bg-cyan-600 active:scale-95 text-cyan-300 hover:text-white rounded-md flex items-center justify-center cursor-pointer transition"
                          >
                            <RotateCw className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Reset individual tool */}
                        {(transform.x !== 0 || transform.y !== 0 || transform.scale !== 1.5 || rotationDeg !== -45) && (
                          <button
                            type="button"
                            onPointerDown={(e) => e.stopPropagation()}
                            onPointerUp={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleResetSingleTool(item.id);
                            }}
                            title="Сбросить положение, масштаб и поворот этого инструмента"
                            className="w-5 h-5 bg-slate-800 hover:bg-rose-900/80 text-rose-400 hover:text-rose-200 rounded-md flex items-center justify-center cursor-pointer transition"
                          >
                            <RotateCcw className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Flyout 1: Pen Color & Stroke Settings */}
                {!isLayoutEditMode && item.id === 'pen' && isFlyoutOpen && canEdit && (
                  <div
                    className="absolute left-[135px] top-0 ml-3 w-58 bg-slate-900/98 backdrop-blur-xl rounded-2xl shadow-2xl border-2 border-purple-500/70 p-3.5 z-[150] animate-in fade-in slide-in-from-left-2 text-slate-100 pointer-events-auto filter drop-shadow-2xl"
                    onMouseLeave={() => setActiveToolFlyout(null)}
                  >
                    <div className="text-[11px] font-bold text-purple-300 mb-2 uppercase tracking-wider flex items-center justify-between">
                      <span>Цвет и толщина пера</span>
                      <span
                        className="w-3 h-3 rounded-full border border-white/50"
                        style={{ backgroundColor: toolSettings.pen.color }}
                      />
                    </div>
                    {/* Quick Color Palette */}
                    <div className="grid grid-cols-5 gap-1.5 mb-3">
                      {QUICK_PALETTES.map((c) => (
                        <button
                          key={c.value}
                          onClick={() => updateToolSetting('pen', { color: c.value })}
                          title={c.name}
                          className={`w-7 h-7 rounded-xl transition flex items-center justify-center cursor-pointer border ${
                            toolSettings.pen.color === c.value
                              ? 'border-white scale-110 shadow-md ring-2 ring-purple-400'
                              : 'border-transparent hover:scale-105'
                          }`}
                          style={{ backgroundColor: c.value }}
                        >
                          {toolSettings.pen.color === c.value && (
                            <Check className="w-3.5 h-3.5 text-white filter drop-shadow-sm" />
                          )}
                        </button>
                      ))}
                    </div>

                    {/* Thickness Row */}
                    <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">Толщина линии</div>
                    <div className="flex items-center gap-1">
                      {STROKE_WIDTHS.map((sw) => (
                        <button
                          key={sw.label}
                          onClick={() => updateToolSetting('pen', { strokeWidth: sw.size })}
                          className={`flex-1 py-1 px-1 rounded-lg text-[10px] font-bold transition cursor-pointer border ${
                            toolSettings.pen.strokeWidth === sw.size
                              ? 'bg-purple-600 text-white border-purple-500 shadow-md'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                          }`}
                        >
                          {sw.size}px
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Flyout 2: Highlighter Color & Size */}
                {!isLayoutEditMode && item.id === 'highlighter' && isFlyoutOpen && canEdit && (
                  <div
                    className="absolute left-[135px] top-0 ml-3 w-58 bg-slate-900/98 backdrop-blur-xl rounded-2xl shadow-2xl border-2 border-purple-500/70 p-3.5 z-[150] animate-in fade-in slide-in-from-left-2 text-slate-100 pointer-events-auto filter drop-shadow-2xl"
                    onMouseLeave={() => setActiveToolFlyout(null)}
                  >
                    <div className="text-[11px] font-bold text-amber-400 mb-2 uppercase tracking-wider flex items-center justify-between">
                      <span>Цвет выделителя</span>
                      <span
                        className="w-3 h-3 rounded-full border border-white/50"
                        style={{ backgroundColor: toolSettings.highlighter.color }}
                      />
                    </div>
                    {/* Highlighter Pastels */}
                    <div className="grid grid-cols-5 gap-1.5 mb-3">
                      {[
                        { hex: '#facc15', label: 'Желтый' },
                        { hex: '#4ade80', label: 'Зеленый' },
                        { hex: '#38bdf8', label: 'Голубой' },
                        { hex: '#f472b6', label: 'Розовый' },
                        { hex: '#fb923c', label: 'Оранжевый' },
                      ].map((c) => (
                        <button
                          key={c.hex}
                          onClick={() => updateToolSetting('highlighter', { color: c.hex })}
                          title={c.label}
                          className={`w-7 h-7 rounded-xl transition flex items-center justify-center cursor-pointer border ${
                            toolSettings.highlighter.color === c.hex
                              ? 'border-white scale-110 shadow-md ring-2 ring-amber-400'
                              : 'border-transparent hover:scale-105'
                          }`}
                          style={{ backgroundColor: c.hex }}
                        >
                          {toolSettings.highlighter.color === c.hex && (
                            <Check className="w-3.5 h-3.5 text-slate-950 filter drop-shadow-sm" />
                          )}
                        </button>
                      ))}
                    </div>

                    <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">Ширина маркера</div>
                    <div className="flex items-center gap-1">
                      {[12, 20, 28, 36].map((w) => (
                        <button
                          key={w}
                          onClick={() => updateToolSetting('highlighter', { strokeWidth: w })}
                          className={`flex-1 py-1 px-1 rounded-lg text-[10px] font-bold transition cursor-pointer border ${
                            toolSettings.highlighter.strokeWidth === w
                              ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                          }`}
                        >
                          {w}px
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Flyout 3: Eraser Size */}
                {!isLayoutEditMode && item.id === 'eraser' && isFlyoutOpen && canEdit && (
                  <div
                    className="absolute left-[135px] top-0 ml-3 w-50 bg-slate-900/98 backdrop-blur-xl rounded-2xl shadow-2xl border-2 border-rose-500/60 p-3.5 z-[150] animate-in fade-in slide-in-from-left-2 text-slate-100 pointer-events-auto filter drop-shadow-2xl"
                    onMouseLeave={() => setActiveToolFlyout(null)}
                  >
                    <div className="text-[11px] font-bold text-rose-400 mb-2 uppercase tracking-wider flex items-center justify-between">
                      <span>Размер ластика</span>
                    </div>
                    <div className="grid grid-cols-4 gap-1">
                      {[10, 20, 36, 60].map((sz) => (
                        <button
                          key={sz}
                          onClick={() => updateToolSetting('eraser', { strokeWidth: sz })}
                          className={`py-1.5 rounded-lg text-xs font-bold transition cursor-pointer border ${
                            toolSettings.eraser.strokeWidth === sz
                              ? 'bg-rose-600 text-white border-rose-500 shadow-md'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                          }`}
                        >
                          {sz}px
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Flyout 4: Shapes & Geometry Menu */}
                {!isLayoutEditMode && item.id === 'rect' && isFlyoutOpen && canEdit && (
                  <div
                    className="absolute left-[135px] top-0 ml-3 w-64 bg-slate-900/98 backdrop-blur-xl rounded-2xl shadow-2xl border-2 border-purple-500/70 p-3.5 z-[150] animate-in fade-in slide-in-from-left-2 text-slate-100 pointer-events-auto filter drop-shadow-2xl"
                    onMouseLeave={() => setActiveToolFlyout(null)}
                  >
                    <div className="text-[11px] font-bold text-purple-300 mb-2 uppercase tracking-wider">
                      Фигуры и геометрия
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {shapeTools.map((st) => (
                        <button
                          key={st.id}
                          onClick={() => {
                            setTool(st.id);
                            setActiveToolFlyout(null);
                          }}
                          className={`p-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer border ${
                            tool === st.id
                              ? 'bg-purple-600 text-white border-purple-400 shadow-md'
                              : 'bg-slate-800/80 hover:bg-slate-700 text-slate-200 border-slate-700'
                          }`}
                        >
                          {st.icon}
                          <span className="truncate">{st.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Floating Compact Utility Dock (Layout Config, Math, Background, Image, Undo, Redo, Clear) */}
        <div className="mt-2 ml-2 flex items-center gap-1.5 p-1.5 bg-slate-950/85 backdrop-blur-md rounded-2xl border border-purple-500/30 shadow-xl pointer-events-auto">
          {/* Custom Layout Position & Scale & Rotation Edit Mode Button */}
          <button
            onClick={handleToggleLayoutEditMode}
            title={
              isLayoutEditMode
                ? 'Зафиксировать положение, размер и поворот и скачать JSON'
                : 'Настроить положение, размер и поворот каждого инструмента'
            }
            className={`w-8 h-8 rounded-xl transition flex items-center justify-center cursor-pointer border ${
              isLayoutEditMode
                ? 'bg-purple-600 text-white border-purple-400 animate-pulse shadow-lg shadow-purple-500/50'
                : 'bg-slate-900 hover:bg-slate-800 text-purple-300 border-slate-800 hover:border-purple-500/60'
            }`}
          >
            {isLayoutEditMode ? <Check className="w-4 h-4" /> : <Sliders className="w-4 h-4" />}
          </button>

          {/* Math Toolbar Toggle */}
          {onToggleMath && (
            <button
              onClick={onToggleMath}
              title="Формулы и символы LaTeX"
              className={`w-8 h-8 rounded-xl transition flex items-center justify-center cursor-pointer border ${
                isMathOpen
                  ? 'bg-indigo-600 text-white border-indigo-400 shadow-md'
                  : 'bg-slate-900 hover:bg-slate-800 text-indigo-400 border-slate-800'
              }`}
            >
              <Sigma className="w-4 h-4" />
            </button>
          )}

          {/* Sheet Background / Grid Settings */}
          {canEdit && (
            <div className="relative">
              <button
                onClick={() => setActiveToolFlyout(activeToolFlyout === 'bg' ? null : 'bg')}
                title="Разметка листа (Клетка, Линейка, Доска)"
                className={`w-8 h-8 rounded-xl transition flex items-center justify-center cursor-pointer border ${
                  activeToolFlyout === 'bg'
                    ? 'bg-purple-600 text-white border-purple-400'
                    : 'bg-slate-900 hover:bg-slate-800 text-purple-300 border-slate-800'
                }`}
              >
                <Layers className="w-4 h-4" />
              </button>

              {activeToolFlyout === 'bg' && (
                <div
                  className="absolute left-0 bottom-full mb-3 w-58 bg-slate-900/98 backdrop-blur-xl rounded-2xl shadow-2xl border-2 border-purple-500/70 p-3 z-[160] animate-in fade-in slide-in-from-bottom-2 text-slate-100 filter drop-shadow-2xl"
                  onMouseLeave={() => setActiveToolFlyout(null)}
                >
                  <div className="text-[11px] font-bold text-purple-300 mb-2 uppercase tracking-wider">
                    Разметка листа
                  </div>
                  <div className="flex flex-col gap-1">
                    {backgrounds.map((bg) => (
                      <button
                        key={bg.id}
                        onClick={() => {
                          setBackground(bg.id);
                          setActiveToolFlyout(null);
                        }}
                        className={`p-2 rounded-xl text-left transition flex items-center justify-between cursor-pointer border ${
                          background === bg.id
                            ? 'bg-purple-600/40 text-purple-200 border-purple-400'
                            : 'bg-slate-800/60 hover:bg-slate-800 text-slate-300 border-transparent'
                        }`}
                      >
                        <span className="text-xs font-bold">{bg.label}</span>
                        <span className="text-[10px] text-slate-400">{bg.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Insert Image Action */}
          {canEdit && (
            <div>
              <button
                onClick={() => fileInputRef.current?.click()}
                title="Загрузить изображение на доску"
                className="w-8 h-8 rounded-xl bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-slate-800 transition flex items-center justify-center cursor-pointer"
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
            </div>
          )}

          {/* Undo / Redo */}
          <button
            onClick={onUndo}
            disabled={!canUndo}
            title="Отменить действие (Ctrl+Z)"
            className={`w-7 h-8 rounded-lg flex items-center justify-center transition ${
              canUndo
                ? 'hover:bg-slate-800 text-slate-300 hover:text-white cursor-pointer'
                : 'text-slate-600 opacity-40 cursor-not-allowed'
            }`}
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            title="Повторить действие (Ctrl+Y)"
            className={`w-7 h-8 rounded-lg flex items-center justify-center transition ${
              canRedo
                ? 'hover:bg-slate-800 text-slate-300 hover:text-white cursor-pointer'
                : 'text-slate-600 opacity-40 cursor-not-allowed'
            }`}
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>

          {/* Clear Page Action */}
          {canEdit && (
            <button
              onClick={() => {
                if (window.confirm('Очистить весь текущий лист?')) {
                  onClearPage();
                }
              }}
              title="Очистить весь лист"
              className="w-8 h-8 rounded-xl bg-slate-900 hover:bg-rose-950 text-slate-400 hover:text-rose-400 border border-slate-800 hover:border-rose-800/60 transition flex items-center justify-center cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </aside>
    </>
  );
};
