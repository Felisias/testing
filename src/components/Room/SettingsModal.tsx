import React, { useState } from 'react';
import { KeybindSettings, DEFAULT_KEYBINDS } from '../../types/extra';
import {
  Settings,
  Keyboard,
  RotateCcw,
  Check,
  X,
  Sparkles,
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  keybinds: KeybindSettings;
  onSaveKeybinds: (newKeybinds: KeybindSettings) => void;
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

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  keybinds,
  onSaveKeybinds,
}) => {
  const [localKeybinds, setLocalKeybinds] = useState<KeybindSettings>(keybinds);
  const [activeRecordingKey, setActiveRecordingKey] = useState<keyof KeybindSettings | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

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

  const handleResetToDefaults = () => {
    setLocalKeybinds(DEFAULT_KEYBINDS);
  };

  const handleSave = () => {
    onSaveKeybinds(localKeybinds);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[150] animate-in fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 max-w-lg w-full animate-in zoom-in-95 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-2xl">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Настройки горячих клавиш</h3>
              <p className="text-xs text-slate-500">
                Кликните на кнопку и нажмите любую клавишу на клавиатуре для привязки инструмента
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Keybinds Table List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
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
                  className={`min-w-20 px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition flex items-center justify-center border ${
                    isRecording
                      ? 'bg-blue-600 text-white border-blue-600 animate-pulse shadow-md'
                      : 'bg-white text-slate-700 border-slate-300 hover:border-blue-500 hover:text-blue-600 shadow-2xs'
                  }`}
                >
                  {isRecording ? 'Нажмите...' : currentKeyVal.toUpperCase()}
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={handleResetToDefaults}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Сбросить по умолчанию
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 shadow-lg shadow-blue-600/30"
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
