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
  Layers,
  Check,
  Move,
  RotateCcw,
  RotateCw,
  Upload,
  Download,
  CheckCircle2,
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
  isLayoutEditMode?: boolean;
  setIsLayoutEditMode?: (mode: boolean) => void;
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
    id: 'image' as ToolType,
    skinKey: 'image',
    name: 'Вставить картинку',
    category: 'utility',
    icon: <ImageIcon className="w-3.5 h-3.5" />,
    tipType: 'block',
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
  isLayoutEditMode: isLayoutEditModeProp,
  setIsLayoutEditMode: setIsLayoutEditModeProp,
}) => {
  const [activeToolFlyout, setActiveToolFlyout] = useState<ToolType | 'bg' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const jsonImportRef = useRef<HTMLInputElement>(null);

  // Interactive Layout Customization State
  const [internalLayoutEditMode, setInternalLayoutEditMode] = useState(false);
  const isLayoutEditMode = isLayoutEditModeProp !== undefined ? isLayoutEditModeProp : internalLayoutEditMode;
  const setIsLayoutEditMode = setIsLayoutEditModeProp || setInternalLayoutEditMode;

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

    // If it's image tool, directly trigger file dialog
    if (targetTool === ('image' as ToolType)) {
      if (!canEdit) return;
      fileInputRef.current?.click();
      return;
    }

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
            className={`w-full h-full object-contain select-none pointer-events-none transition-all duration-200 ${
              isSelected
                ? 'filter drop-shadow-[0_0_12px_rgba(168,85,247,0.95)] drop-shadow-[0_4px_8px_rgba(0,0,0,0.4)]'
                : 'filter drop-shadow-md hover:drop-shadow-lg'
            }`}
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
          className={`relative w-40 h-8 flex items-center transition-all duration-150 pointer-events-none select-none ${
            isSelected
              ? 'filter drop-shadow-[0_0_12px_rgba(168,85,247,0.9)] drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)]'
              : 'filter drop-shadow-md hover:drop-shadow-lg'
          }`}
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
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[100] bg-white/95 backdrop-blur-xl border-2 border-purple-500 rounded-3xl p-3 shadow-2xl flex flex-wrap items-center gap-3 animate-in slide-in-from-top-4 text-slate-800 max-w-3xl w-[96%]">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-purple-100 text-purple-700 rounded-xl border border-purple-300 shrink-0">
              <Move className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="text-xs font-extrabold text-purple-900 uppercase tracking-wider flex items-center gap-2">
                <span>Режим расстановки, масштаба и поворота</span>
                <span className="px-2 py-0.2 bg-purple-100 text-purple-800 text-[10px] rounded-full border border-purple-200">
                  ПЕРЕТАСКИВАНИЕ МЫШЬЮ
                </span>
              </div>
              <div className="text-[11px] text-slate-600 flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
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
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-blue-600" />
              <span>Загрузить пак</span>
            </button>

            {/* Export Full Toolpack JSON */}
            <button
              onClick={() => exportFullToolPackFile(currentLayouts)}
              title="Скачать единый JSON файл со всеми скинами и координатами"
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-purple-800 border border-purple-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-purple-600" />
              <span>Скачать пак</span>
            </button>

            {/* Reset All Positions */}
            <button
              onClick={handleResetAllLayouts}
              title="Сбросить все положения, размеры и повороты к исходным"
              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-300 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            {/* Finish & Download Config */}
            <button
              onClick={handleToggleLayoutEditMode}
              title="Зафиксировать расположение, применить размер/поворот и скачать файл пака"
              className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 shadow-md shadow-purple-500/30 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 text-white" />
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

      {/* Hidden File Input for Image Upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageFileChange}
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
                    ? 'z-[500]'
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
                  {/* Visual Tool Item Button with Transparent Background & Non-Rectangular Hitbox */}
                  <div
                    onPointerDown={(e) => handleToolPointerDown(e, item.id)}
                    onPointerMove={handleToolPointerMove}
                    onPointerUp={handleToolPointerUp}
                    onPointerCancel={handleToolPointerUp}
                    onWheel={(e) => handleToolWheel(e, item.id)}
                    onClick={() => handleSelectTool(item.id)}
                    className={`relative w-36 h-15 rounded-2xl flex items-center justify-center transition-all duration-200 ease-out select-none bg-transparent ${
                      isLayoutEditMode
                        ? 'cursor-grab active:cursor-grabbing border-2 border-dashed border-purple-400 bg-purple-100/40 shadow-xl ring-2 ring-purple-500/30'
                        : isDisabled
                        ? 'opacity-30 cursor-not-allowed'
                        : isSelected
                        ? 'translate-x-7 -translate-y-3.5 scale-110 z-30 cursor-pointer'
                        : 'hover:scale-115 hover:translate-x-3.5 hover:-translate-y-1 z-10 cursor-pointer'
                    }`}
                    title={
                      isLayoutEditMode
                        ? `${item.name}: Тащите мышью. Колесико — размер (${transform.scale}x). Shift+Колесико — поворот (${rotationDeg}°)`
                        : `${item.name} (${transform.scale}x, ${rotationDeg}°)`
                    }
                  >
                    {/* Visual 3D / PNG representation with drop-shadow effect on the image itself */}
                    {renderToolTexture(item, isSelected, rotationDeg)}

                    {/* Layout Edit Mode Overlay Controls on Tool */}
                    {isLayoutEditMode && (
                      <div
                        className="absolute -top-9 left-1/2 -translate-x-1/2 bg-white text-slate-800 border-2 border-purple-400 rounded-2xl px-2.5 py-1 text-[11px] font-mono font-bold flex items-center gap-2 shadow-2xl whitespace-nowrap z-[120] pointer-events-auto backdrop-blur-xl ring-2 ring-purple-200"
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
                          className="flex items-center gap-1 text-purple-700 border-r border-slate-200 pr-1.5 cursor-grab"
                        >
                          <Move className="w-3.5 h-3.5" />
                        </div>

                        {/* Scale Controls */}
                        <div className="flex items-center gap-1 border-r border-slate-200 pr-2">
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
                            className="w-5 h-5 bg-slate-100 hover:bg-purple-600 hover:text-white active:scale-95 text-slate-700 rounded-md flex items-center justify-center cursor-pointer font-extrabold text-sm transition"
                          >
                            -
                          </button>
                          <span className="text-purple-900 min-w-[32px] text-center font-bold">{transform.scale}x</span>
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
                            className="w-5 h-5 bg-slate-100 hover:bg-purple-600 hover:text-white active:scale-95 text-slate-700 rounded-md flex items-center justify-center cursor-pointer font-extrabold text-sm transition"
                          >
                            +
                          </button>
                        </div>

                        {/* Rotation Controls */}
                        <div className="flex items-center gap-1 border-r border-slate-200 pr-2">
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
                            className="w-5 h-5 bg-slate-100 hover:bg-cyan-600 hover:text-white active:scale-95 text-cyan-700 rounded-md flex items-center justify-center cursor-pointer transition"
                          >
                            <RotateCcw className="w-3 h-3" />
                          </button>
                          <span className="text-cyan-800 min-w-[34px] text-center font-bold">{rotationDeg}°</span>
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
                            className="w-5 h-5 bg-slate-100 hover:bg-cyan-600 hover:text-white active:scale-95 text-cyan-700 rounded-md flex items-center justify-center cursor-pointer transition"
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
                            className="w-5 h-5 bg-slate-100 hover:bg-rose-600 hover:text-white text-rose-600 rounded-md flex items-center justify-center cursor-pointer transition"
                          >
                            <RotateCcw className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Flyout 1: Pen Color & Stroke Settings (Clean Light Theme) */}
                {!isLayoutEditMode && item.id === 'pen' && isFlyoutOpen && canEdit && (
                  <div
                    className="absolute left-[135px] top-0 ml-3 w-58 bg-white/98 backdrop-blur-xl rounded-2xl shadow-2xl border border-purple-200 p-3.5 z-[500] animate-in fade-in slide-in-from-left-2 text-slate-800 pointer-events-auto filter drop-shadow-2xl"
                    onMouseLeave={() => setActiveToolFlyout(null)}
                  >
                    <div className="text-[11px] font-bold text-purple-900 mb-2 uppercase tracking-wider flex items-center justify-between">
                      <span>Цвет и толщина пера</span>
                      <span
                        className="w-3 h-3 rounded-full border border-slate-300 shadow-xs"
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
                              ? 'border-purple-600 scale-110 shadow-md ring-2 ring-purple-300'
                              : 'border-slate-200 hover:scale-105'
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
                    <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">Толщина линии</div>
                    <div className="flex items-center gap-1">
                      {STROKE_WIDTHS.map((sw) => (
                        <button
                          key={sw.label}
                          onClick={() => updateToolSetting('pen', { strokeWidth: sw.size })}
                          className={`flex-1 py-1 px-1 rounded-lg text-[10px] font-bold transition cursor-pointer border ${
                            toolSettings.pen.strokeWidth === sw.size
                              ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
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
                    className="absolute left-[135px] top-0 ml-3 w-58 bg-white/98 backdrop-blur-xl rounded-2xl shadow-2xl border border-amber-200 p-3.5 z-[500] animate-in fade-in slide-in-from-left-2 text-slate-800 pointer-events-auto filter drop-shadow-2xl"
                    onMouseLeave={() => setActiveToolFlyout(null)}
                  >
                    <div className="text-[11px] font-bold text-amber-800 mb-2 uppercase tracking-wider flex items-center justify-between">
                      <span>Цвет выделителя</span>
                      <span
                        className="w-3 h-3 rounded-full border border-slate-300 shadow-xs"
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
                              ? 'border-amber-600 scale-110 shadow-md ring-2 ring-amber-300'
                              : 'border-slate-200 hover:scale-105'
                          }`}
                          style={{ backgroundColor: c.hex }}
                        >
                          {toolSettings.highlighter.color === c.hex && (
                            <Check className="w-3.5 h-3.5 text-slate-900 filter drop-shadow-sm" />
                          )}
                        </button>
                      ))}
                    </div>

                    <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">Ширина маркера</div>
                    <div className="flex items-center gap-1">
                      {[12, 20, 28, 36].map((w) => (
                        <button
                          key={w}
                          onClick={() => updateToolSetting('highlighter', { strokeWidth: w })}
                          className={`flex-1 py-1 px-1 rounded-lg text-[10px] font-bold transition cursor-pointer border ${
                            toolSettings.highlighter.strokeWidth === w
                              ? 'bg-amber-500 text-slate-900 border-amber-500 shadow-xs'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
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
                    className="absolute left-[135px] top-0 ml-3 w-50 bg-white/98 backdrop-blur-xl rounded-2xl shadow-2xl border border-rose-200 p-3.5 z-[500] animate-in fade-in slide-in-from-left-2 text-slate-800 pointer-events-auto filter drop-shadow-2xl"
                    onMouseLeave={() => setActiveToolFlyout(null)}
                  >
                    <div className="text-[11px] font-bold text-rose-800 mb-2 uppercase tracking-wider">
                      Размер ластика
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[12, 24, 36, 48].map((size) => (
                        <button
                          key={size}
                          onClick={() => updateToolSetting('eraser', { strokeWidth: size })}
                          className={`p-2 rounded-xl text-center text-xs font-bold transition cursor-pointer border flex flex-col items-center gap-1 ${
                            toolSettings.eraser.strokeWidth === size
                              ? 'bg-rose-500 text-white border-rose-500 shadow-md'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                          }`}
                        >
                          <div
                            className="rounded-full bg-current"
                            style={{ width: Math.max(6, size / 4), height: Math.max(6, size / 4) }}
                          />
                          <span>{size}px</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Flyout 4: Shape Tools Selector (Ruler / Shapes Submenu) */}
                {!isLayoutEditMode && item.id === 'rect' && isFlyoutOpen && canEdit && (
                  <div
                    className="absolute left-[135px] top-0 ml-3 w-64 bg-white/98 backdrop-blur-xl rounded-2xl shadow-2xl border border-purple-200 p-3.5 z-[500] animate-in fade-in slide-in-from-left-2 text-slate-800 pointer-events-auto filter drop-shadow-2xl"
                    onMouseLeave={() => setActiveToolFlyout(null)}
                  >
                    <div className="text-[11px] font-bold text-purple-900 mb-2 uppercase tracking-wider flex items-center justify-between">
                      <span>Фигуры и черчение</span>
                      <span
                        className="w-3 h-3 rounded-full border border-slate-300 shadow-xs"
                        style={{ backgroundColor: toolSettings.shapes?.color || '#a855f7' }}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 mb-3">
                      {shapeTools.map((st) => (
                        <button
                          key={st.id}
                          onClick={() => {
                            setTool(st.id);
                            setActiveToolFlyout('rect');
                          }}
                          className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition cursor-pointer border ${
                            tool === st.id
                              ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                          }`}
                        >
                          <span className="shrink-0">{st.icon}</span>
                          <span className="truncate">{st.label}</span>
                        </button>
                      ))}
                    </div>

                    {/* Shape Colors */}
                    <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">Цвет контура</div>
                    <div className="grid grid-cols-5 gap-1.5 mb-3">
                      {QUICK_PALETTES.map((c) => (
                        <button
                          key={c.value}
                          onClick={() => updateToolSetting('shapes', { color: c.value })}
                          title={c.name}
                          className={`w-7 h-7 rounded-xl transition flex items-center justify-center cursor-pointer border ${
                            (toolSettings.shapes?.color || '#1E293B') === c.value
                              ? 'border-purple-600 scale-110 shadow-md ring-2 ring-purple-300'
                              : 'border-slate-200 hover:scale-105'
                          }`}
                          style={{ backgroundColor: c.value }}
                        >
                          {(toolSettings.shapes?.color || '#1E293B') === c.value && (
                            <Check className="w-3.5 h-3.5 text-white filter drop-shadow-sm" />
                          )}
                        </button>
                      ))}
                    </div>

                    <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">Толщина контура</div>
                    <div className="flex items-center gap-1">
                      {[1, 2, 4, 6].map((w) => (
                        <button
                          key={w}
                          onClick={() => updateToolSetting('shapes', { strokeWidth: w })}
                          className={`flex-1 py-1 px-1 rounded-lg text-[10px] font-bold transition cursor-pointer border ${
                            (toolSettings.shapes?.strokeWidth || 2) === w
                              ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                          }`}
                        >
                          {w}px
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Flyout 5: Text Formatting */}
                {!isLayoutEditMode && item.id === 'text' && isFlyoutOpen && canEdit && (
                  <div
                    className="absolute left-[135px] top-0 ml-3 w-56 bg-white/98 backdrop-blur-xl rounded-2xl shadow-2xl border border-purple-200 p-3.5 z-[500] animate-in fade-in slide-in-from-left-2 text-slate-800 pointer-events-auto filter drop-shadow-2xl"
                    onMouseLeave={() => setActiveToolFlyout(null)}
                  >
                    <div className="text-[11px] font-bold text-purple-900 mb-2 uppercase tracking-wider">
                      Размер шрифта текста
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[16, 20, 24, 32].map((fs) => (
                        <button
                          key={fs}
                          onClick={() => updateToolSetting('text', { fontSize: fs })}
                          className={`py-1.5 px-2 rounded-xl text-xs font-bold transition cursor-pointer border ${
                            toolSettings.text.fontSize === fs
                              ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                          }`}
                        >
                          {fs}px
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </aside>
    </>
  );
};
