import React, { useState, useRef, useEffect } from 'react';
import {
  KeybindSettings,
  DEFAULT_KEYBINDS,
  ExperimentalSkinSettings,
  ToolSkinConfig,
  DEFAULT_EXPERIMENTAL_SKINS,
  DEFAULT_TOOL_TRANSFORMS,
  ToolLayoutConfig,
} from '../../types/extra';
import { UserRole } from '../../types';
import {
  Settings,
  Keyboard,
  RotateCcw,
  Check,
  X,
  Sparkles,
  Upload,
  Trash2,
  Image as ImageIcon,
  ShieldCheck,
  Pencil,
  Highlighter,
  Eraser,
  Flame,
  Square,
  Type,
  MousePointer,
  Hand,
  Layers,
  Download,
  Sliders,
  Move,
  GraduationCap,
  Crown,
  Lock,
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  keybinds: KeybindSettings;
  onSaveKeybinds: (newKeybinds: KeybindSettings) => void;
  userRole?: UserRole;
  experimentalSettings?: ExperimentalSkinSettings;
  onSaveExperimentalSettings?: (settings: ExperimentalSkinSettings) => void;
  onOpenLayoutEditMode?: () => void;
}

const TOOL_LABELS: { key: keyof KeybindSettings; label: string; desc: string }[] = [
  { key: 'select', label: 'Выбор / Перемещение (Select)', desc: 'Выбор объектов на доске' },
  { key: 'pan', label: 'Рука / Панорамирование (Pan)', desc: 'Перемещение холста' },
  { key: 'pen', label: 'Карандаш / Перо (Pen)', desc: 'Рисование от руки' },
  { key: 'highlighter', label: 'Маркер / Текстовыделитель', desc: 'Полупрозрачный маркер' },
  { key: 'eraser', label: 'Ластик (Eraser)', desc: 'Стирание линий и фигур' },
  { key: 'line', label: 'Прямая линия', desc: 'Черчение прямых отрезков' },
  { key: 'rect', label: 'Прямоугольник', desc: 'Геометрический прямоугольник' },
  { key: 'circle', label: 'Круг / Окружность', desc: 'Геометрический круг' },
  { key: 'triangle', label: 'Треугольник', desc: 'Геометрический треугольник' },
  { key: 'text', label: 'Текст / Формулы', desc: 'Вставка текста' },
  { key: 'laser', label: 'Лазерная указка', desc: 'Временная подсветка внимания' },
  { key: 'clear', label: 'Очистить лист', desc: 'Быстрая очистка текущего листа' },
];

interface ToolSkinSlot {
  key: keyof ToolSkinConfig;
  title: string;
  desc: string;
  icon: React.ReactNode;
}

const TOOL_SKIN_SLOTS: ToolSkinSlot[] = [
  {
    key: 'pen',
    title: 'Карандаш / Перо',
    desc: 'Основной инструмент рисования (угол 45°)',
    icon: <Pencil className="w-4 h-4 text-blue-500" />,
  },
  {
    key: 'highlighter',
    title: 'Маркер / Выделитель',
    desc: 'Полупрозрачный скошенный маркер',
    icon: <Highlighter className="w-4 h-4 text-amber-500" />,
  },
  {
    key: 'eraser',
    title: 'Ластик',
    desc: 'Инструмент стирания штрихов',
    icon: <Eraser className="w-4 h-4 text-rose-500" />,
  },
  {
    key: 'laser',
    title: 'Лазерная указка',
    desc: 'Светящийся маркер внимания',
    icon: <Flame className="w-4 h-4 text-red-500" />,
  },
  {
    key: 'shapes',
    title: 'Линейка и фигуры',
    desc: 'Прямоугольник, круг, треугольник, оси X-Y',
    icon: <Square className="w-4 h-4 text-purple-500" />,
  },
  {
    key: 'text',
    title: 'Текст и формулы',
    desc: 'Ввод текста и математических выражений',
    icon: <Type className="w-4 h-4 text-emerald-500" />,
  },
  {
    key: 'image',
    title: 'Вставить изображение',
    desc: 'Инструмент добавления картинок на холст',
    icon: <ImageIcon className="w-4 h-4 text-blue-500" />,
  },
  {
    key: 'select',
    title: 'Курсор / Выбор',
    desc: 'Выделение и трансформация объектов',
    icon: <MousePointer className="w-4 h-4 text-indigo-500" />,
  },
  {
    key: 'pan',
    title: 'Рука / Панорама',
    desc: 'Перемещение рабочего полотна',
    icon: <Hand className="w-4 h-4 text-cyan-500" />,
  },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  keybinds,
  onSaveKeybinds,
  userRole = 'tutor',
  experimentalSettings = DEFAULT_EXPERIMENTAL_SKINS,
  onSaveExperimentalSettings,
  onOpenLayoutEditMode,
}) => {
  const [activeTab, setActiveTab] = useState<'keybinds' | 'skins'>('keybinds');
  const [localKeybinds, setLocalKeybinds] = useState<KeybindSettings>(keybinds);
  const [activeRecordingKey, setActiveRecordingKey] = useState<keyof KeybindSettings | null>(null);

  const [localExpSettings, setLocalExpSettings] = useState<ExperimentalSkinSettings>(experimentalSettings);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const isTutor = userRole === 'tutor';

  // Synchronize local settings when props update (e.g. tutor changes skins live)
  useEffect(() => {
    if (experimentalSettings) {
      setLocalExpSettings(experimentalSettings);
    }
  }, [experimentalSettings]);

  useEffect(() => {
    if (keybinds) {
      setLocalKeybinds(keybinds);
    }
  }, [keybinds]);

  if (!isOpen) return null;

  const handleKeyDown = (e: React.KeyboardEvent, field: keyof KeybindSettings) => {
    e.preventDefault();
    e.stopPropagation();

    const key = e.key.toLowerCase();
    if (key === 'escape') {
      setActiveRecordingKey(null);
      return;
    }

    setLocalKeybinds((prev) => ({
      ...prev,
      [field]: key,
    }));
    setActiveRecordingKey(null);
  };

  const handleFileUpload = (toolKey: keyof ToolSkinConfig, file: File) => {
    if (!isTutor) return; // Restricted to tutor
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setLocalExpSettings((prev) => ({
        ...prev,
        toolSkins: {
          ...prev.toolSkins,
          [toolKey]: dataUrl,
        },
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveCustomSkin = (toolKey: keyof ToolSkinConfig) => {
    if (!isTutor) return; // Restricted to tutor
    setLocalExpSettings((prev) => {
      const nextSkins = { ...prev.toolSkins };
      delete nextSkins[toolKey];
      return {
        ...prev,
        toolSkins: nextSkins,
      };
    });
  };

  const handleResetToDefaults = () => {
    if (activeTab === 'keybinds') {
      setLocalKeybinds(DEFAULT_KEYBINDS);
    } else {
      if (isTutor) {
        setLocalExpSettings({
          ...DEFAULT_EXPERIMENTAL_SKINS,
          enabled: true,
        });
      } else {
        setLocalExpSettings((prev) => ({
          ...prev,
          enabled: true,
        }));
      }
    }
  };

  const handleSave = () => {
    onSaveKeybinds(localKeybinds);
    if (onSaveExperimentalSettings) {
      onSaveExperimentalSettings(localExpSettings);
    }
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-[150] animate-in fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 max-w-xl w-full animate-in zoom-in-95 max-h-[90vh] flex flex-col">
        {/* Header with Title & Navigation Tabs */}
        <div className="mb-4 pb-3 border-b border-slate-100 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-2xl">
                <Settings className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Настройки TutorBoard</h3>
                <p className="text-xs text-slate-500">
                  Управление горячими клавишами и экспериментальным стилем доски
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 flex items-center justify-center transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Tab Buttons Switcher */}
          <div className="flex items-center gap-2 mt-4 p-1 bg-slate-100/80 rounded-2xl">
            <button
              onClick={() => setActiveTab('keybinds')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'keybinds'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Keyboard className="w-3.5 h-3.5 text-blue-600" />
              <span>Горячие клавиши</span>
            </button>

            <button
              onClick={() => setActiveTab('skins')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'skins'
                  ? 'bg-white text-purple-900 shadow-xs'
                  : 'text-slate-600 hover:text-purple-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
              <span>3D Панель инструментов</span>
              <span className="px-1.5 py-0.2 bg-purple-100 text-purple-700 rounded-full text-[9px] uppercase tracking-wider font-extrabold">
                NEW
              </span>
            </button>
          </div>
        </div>

        {/* Tab 1: Keybinds */}
        {activeTab === 'keybinds' && (
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            <div className="p-3 bg-blue-50/60 border border-blue-100 rounded-2xl text-xs text-blue-900 mb-2">
              Кликните на кнопку с клавишей и нажмите любую букву на клавиатуре для назначения быстрой клавиши.
            </div>

            {TOOL_LABELS.map(({ key, label, desc }) => {
              const isRecording = activeRecordingKey === key;
              const currentKeyVal = localKeybinds[key] || '';

              return (
                <div
                  key={key}
                  className={`p-2.5 rounded-2xl border transition flex items-center justify-between gap-3 ${
                    isRecording
                      ? 'border-blue-500 bg-blue-50/60 ring-2 ring-blue-500/20'
                      : 'border-slate-200/80 bg-slate-50/50 hover:bg-slate-50'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-800">{label}</div>
                    <div className="text-[10px] text-slate-500 truncate">{desc}</div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveRecordingKey(key)}
                    onKeyDown={(e) => isRecording && handleKeyDown(e, key)}
                    tabIndex={0}
                    className={`min-w-20 px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition flex items-center justify-center border cursor-pointer ${
                      isRecording
                        ? 'bg-blue-600 text-white border-blue-600 animate-pulse shadow-md'
                        : 'bg-white text-slate-700 border-slate-300 hover:border-blue-500 hover:text-blue-600 shadow-2xs'
                    }`}
                  >
                    {isRecording ? 'Нажмите...' : (currentKeyVal ? currentKeyVal.toUpperCase() : '')}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Tab 2: Experimental 3D Realistic Tools Mode */}
        {activeTab === 'skins' && (
          <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 text-slate-800">
            {/* Tutor vs Student Banner */}
            {isTutor ? (
              <div className="p-3.5 bg-gradient-to-r from-purple-900 to-indigo-950 text-white rounded-2xl shadow-md border border-purple-500/30 flex items-start gap-3">
                <div className="p-2 bg-purple-500/20 rounded-xl text-purple-300 shrink-0">
                  <Crown className="w-5 h-5 text-amber-400" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-purple-100">Управление инструментами (Преподаватель)</span>
                    <span className="px-2 py-0.2 bg-amber-500/30 border border-amber-400/40 text-amber-200 text-[10px] font-bold rounded-full uppercase">
                      Синхронизация
                    </span>
                  </div>
                  <p className="text-xs text-purple-200/90 mt-0.5 leading-relaxed">
                    Вы настраиваете скины, размер, угол и положение инструментов. Все изменения мгновенно отображаются у всех учеников в комнате.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-3.5 bg-gradient-to-r from-blue-900 to-slate-900 text-white rounded-2xl shadow-md border border-blue-500/30 flex items-start gap-3">
                <div className="p-2 bg-blue-500/20 rounded-xl text-blue-300 shrink-0">
                  <GraduationCap className="w-5 h-5 text-blue-400" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-blue-100">Оформление от преподавателя</span>
                    <span className="px-2 py-0.2 bg-blue-500/30 border border-blue-400/40 text-blue-200 text-[10px] font-bold rounded-full uppercase">
                      Автосинхронизация
                    </span>
                  </div>
                  <p className="text-xs text-blue-200/90 mt-0.5 leading-relaxed">
                    Картинки, размеры и расположение инструментов задаются преподавателем и обновляются в реальном времени. Вы можете включить 3D стиль от преподавателя (по умолчанию) или переключить на классическую панель.
                  </p>
                </div>
              </div>
            )}

            {/* Master Toggle */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col gap-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="font-bold text-xs text-slate-900 flex items-center gap-2">
                    <span>Использовать 3D отображение инструментов</span>
                    {localExpSettings.enabled ? (
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-extrabold rounded-full text-[10px]">
                        ПО УМОЛЧАНИЮ (АКТИВНО)
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-slate-200 text-slate-700 font-bold rounded-full text-[10px]">
                        КЛАССИЧЕСКАЯ ПАНЕЛЬ
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {isTutor
                      ? 'Отображает реальные диагональные инструменты с текстурой или вашими PNG'
                      : 'Включает реалистичные 3D инструменты, настроенные преподавателем, либо возвращает к классической панели'}
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={localExpSettings.enabled}
                    onChange={(e) =>
                      setLocalExpSettings((prev) => ({
                        ...prev,
                        enabled: e.target.checked,
                      }))
                    }
                    className="sr-only peer"
                  />
                  <div className="w-12 h-6 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>

              {/* Tutor-Only Master Pack Export / Import & Layout Launcher */}
              {isTutor && (
                <div className="pt-3 border-t border-slate-200/90 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-purple-50/70 p-3 rounded-xl border border-purple-200/70">
                  <div className="min-w-0">
                    <div className="text-xs font-extrabold text-purple-950 flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                      <span>Полный пак (Расположение + Размеры + Углы + PNG-скины)</span>
                    </div>
                    <div className="text-[11px] text-purple-800/80 mt-0.5">
                      Единый файл содержит и все оригинальные картинки, и точные координаты/масштаб/поворот.
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    {/* Interactive Layout Adjustment Launcher */}
                    {onOpenLayoutEditMode && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenLayoutEditMode();
                        }}
                        className="px-3 py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-900 font-bold rounded-xl text-xs border border-purple-300 shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <Move className="w-3.5 h-3.5 text-purple-700" />
                        <span>Настроить положение на экране</span>
                      </button>
                    )}

                    {/* Export Full Pack JSON */}
                    <button
                      type="button"
                      onClick={() => {
                        const data = {
                          appName: 'TutorBoard',
                          format: 'tutorboard-3d-toolpack',
                          version: '1.0',
                          exportedAt: new Date().toISOString(),
                          enabled: true,
                          toolLayouts: localExpSettings.toolLayouts || DEFAULT_TOOL_TRANSFORMS,
                          toolSkins: localExpSettings.toolSkins || {},
                        };
                        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `tutorboard-3d-toolpack-${new Date().toISOString().slice(0, 10)}.json`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                      }}
                      className="px-3 py-1.5 bg-white hover:bg-slate-50 text-purple-900 font-bold rounded-xl text-xs border border-purple-300 shadow-xs transition flex items-center gap-1.5 cursor-pointer hover:border-purple-400"
                    >
                      <Download className="w-3.5 h-3.5 text-purple-600" />
                      <span>Скачать полный пак</span>
                    </button>

                    {/* Import Full Pack JSON */}
                    <label className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 shadow-sm shadow-purple-600/30 cursor-pointer">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Загрузить пак</span>
                      <input
                        type="file"
                        accept=".json,application/json"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            try {
                              const parsed = JSON.parse(event.target?.result as string);
                              if (parsed && typeof parsed === 'object') {
                                const layouts = parsed.toolLayouts || (parsed.pen?.scale !== undefined ? parsed : null) || {};
                                const skins = (parsed.toolSkins && typeof parsed.toolSkins === 'object') ? parsed.toolSkins : {};

                                setLocalExpSettings((prev) => ({
                                  ...prev,
                                  enabled: true,
                                  toolLayouts: {
                                    ...DEFAULT_TOOL_TRANSFORMS,
                                    ...prev.toolLayouts,
                                    ...layouts,
                                  },
                                  toolSkins: {
                                    ...prev.toolSkins,
                                    ...skins,
                                  },
                                }));
                              }
                            } catch (err) {
                              console.error('Failed to parse pack JSON:', err);
                            }
                          };
                          reader.readAsText(file);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Tool Skins Config List */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Изображения инструментов (PNG)
                </span>
                <span className="text-[11px] text-slate-500">
                  {isTutor ? 'Загрузите прозрачные PNG без фона' : 'Синхронизировано от преподавателя'}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                {TOOL_SKIN_SLOTS.map((slot) => {
                  const customSkin = localExpSettings.toolSkins[slot.key];

                  return (
                    <div
                      key={slot.key}
                      className="p-3 bg-white border border-slate-200 rounded-2xl shadow-2xs hover:border-purple-300 transition flex items-center justify-between gap-3"
                    >
                      {/* Left: Preview & Info */}
                      <div className="flex items-center gap-3 min-w-0">
                        {/* 45-degree angled mini preview box */}
                        <div className="w-12 h-12 bg-slate-950 rounded-xl border border-purple-500/40 p-1 flex items-center justify-center shrink-0 relative overflow-hidden shadow-inner">
                          {customSkin ? (
                            <img
                              src={customSkin}
                              alt={slot.title}
                              className="w-full h-full object-contain filter drop-shadow-sm"
                              style={{ transform: 'rotate(-45deg)' }}
                            />
                          ) : (
                            /* Default Purple-Black Grid Tool Preview */
                            <div
                              className="w-10 h-3 rounded-xs border border-purple-400 shadow-xs flex items-center justify-center"
                              style={{
                                transform: 'rotate(-45deg)',
                                backgroundColor: '#0c0517',
                                backgroundImage: `
                                  linear-gradient(to right, rgba(168, 85, 247, 0.6) 1px, transparent 1px),
                                  linear-gradient(to bottom, rgba(168, 85, 247, 0.6) 1px, transparent 1px)
                                `,
                                backgroundSize: '3px 3px',
                              }}
                            >
                              <div className="w-1.5 h-2.5 bg-amber-400 ml-auto mr-0.5 rounded-r-xs" />
                            </div>
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            {slot.icon}
                            <span className="font-bold text-xs text-slate-900 truncate">
                              {slot.title}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 truncate mt-0.5">{slot.desc}</p>
                          <div className="mt-1 flex items-center gap-1.5">
                            <span
                              className={`inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                customSkin
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-purple-100 text-purple-800'
                              }`}
                            >
                              {customSkin ? '✓ Пользовательский PNG' : 'Фиолетово-чёрная сетка'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Upload & Clear Actions (Tutor only) or Locked Badge (Student) */}
                      {isTutor ? (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => fileInputRefs.current[slot.key]?.click()}
                            title="Загрузить свой PNG файл"
                            className="px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold rounded-xl text-xs transition flex items-center gap-1.5 border border-purple-200 cursor-pointer"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>{customSkin ? 'Заменить' : 'Загрузить PNG'}</span>
                          </button>
                          <input
                            ref={(el) => {
                              fileInputRefs.current[slot.key] = el;
                            }}
                            type="file"
                            accept="image/png,image/webp,image/svg+xml,image/jpeg"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleFileUpload(slot.key, f);
                              e.target.value = '';
                            }}
                          />

                          {customSkin && (
                            <button
                              type="button"
                              onClick={() => handleRemoveCustomSkin(slot.key)}
                              title="Сбросить на стандартную сетку"
                              className="p-1.5 bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded-xl transition border border-slate-200 hover:border-rose-200 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 px-2 py-1 bg-slate-50 rounded-xl border border-slate-200/60">
                          <Lock className="w-3 h-3 text-slate-400" />
                          <span>Преподаватель</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={handleResetToDefaults}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Сбросить по умолчанию
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 shadow-lg shadow-purple-600/30 cursor-pointer"
            >
              {savedSuccess ? <Check className="w-4 h-4" /> : null}
              <span>{savedSuccess ? 'Сохранено!' : 'Сохранить'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

