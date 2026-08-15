import React, { useState, useRef } from 'react';
import { AVATAR_PRESETS, AvatarOption } from '../../types/avatar';
import { UserAvatar } from './UserAvatar';
import { Upload, Sparkles, Palette, Image as ImageIcon } from 'lucide-react';

interface AvatarPickerProps {
  selectedAvatar: string;
  selectedColor?: string;
  onSelectAvatar: (avatar: string, color?: string) => void;
  onSelectColor?: (color: string) => void;
  userName?: string;
  isOpen?: boolean;
  onClose?: () => void;
}

const COLOR_PALETTE = [
  '#2563EB', // Blue
  '#0D9488', // Teal
  '#16A34A', // Green
  '#D97706', // Amber
  '#DC2626', // Red
  '#9333EA', // Purple
  '#DB2777', // Pink
  '#4F46E5', // Indigo
  '#0284C7', // Sky
  '#475569', // Slate
];

export const AvatarPicker: React.FC<AvatarPickerProps> = ({
  selectedAvatar,
  selectedColor = '#2563EB',
  onSelectAvatar,
  onSelectColor,
  userName = 'Пользователь',
  isOpen = true,
  onClose,
}) => {
  const [activeCategory, setActiveCategory] = useState<'all' | 'education' | 'tech' | 'animals' | 'creativity'>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (isOpen === false) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Пожалуйста, выберите файл изображения (PNG, JPG, WebP)');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert('Размер файла не должен превышать 2 МБ');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === 'string') {
        onSelectAvatar(event.target.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleColorChange = (c: string) => {
    if (onSelectColor) onSelectColor(c);
    else onSelectAvatar(selectedAvatar, c);
  };

  const filteredPresets =
    activeCategory === 'all'
      ? AVATAR_PRESETS
      : AVATAR_PRESETS.filter((p) => p.category === activeCategory);

  const content = (
    <div className="space-y-4">
      {/* Current Preview */}
      <div className="flex items-center gap-3.5 bg-slate-50 p-3 rounded-2xl border border-slate-200">
        <UserAvatar
          avatar={selectedAvatar}
          color={selectedColor}
          name={userName}
          size="md"
          className="ring-2 ring-blue-500/30 shadow-sm"
        />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold text-slate-800">Персонализация профиля</div>
          <div className="text-[11px] text-slate-500 truncate">
            Ваш аватар и цвет видны всем участникам урока
          </div>
          <div className="flex items-center gap-2 mt-1">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-[11px] font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition flex items-center gap-1"
            >
              <Upload className="w-3 h-3" /> Загрузить картинку
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>
        </div>
      </div>

      {/* Color Swatches */}
      <div>
        <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
          <Palette className="w-3.5 h-3.5 text-blue-600" />
          Цвет маркера и курсора:
        </label>
        <div className="flex items-center gap-1.5 flex-wrap">
          {COLOR_PALETTE.map((c) => {
            const isSelected = selectedColor?.toLowerCase() === c.toLowerCase();
            return (
              <button
                key={c}
                type="button"
                onClick={() => handleColorChange(c)}
                className={`w-6 h-6 rounded-lg transition transform hover:scale-110 flex items-center justify-center ${
                  isSelected ? 'ring-2 ring-offset-2 ring-slate-800 scale-105' : 'opacity-80 hover:opacity-100'
                }`}
                style={{ backgroundColor: c }}
                title={`Выбрать цвет ${c}`}
              >
                {isSelected && <span className="text-white text-[10px] font-bold">✓</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Categories Tabs */}
      <div>
        <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          Выберите аватарку:
        </label>
        <div className="flex gap-1 overflow-x-auto pb-1 mb-2 scrollbar-none">
          {[
            { id: 'all', label: 'Все' },
            { id: 'education', label: 'Учёба 🎓' },
            { id: 'tech', label: 'Наука 🚀' },
            { id: 'animals', label: 'Персонажи 🦊' },
            { id: 'creativity', label: 'Творчество 🎨' },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id as any)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                activeCategory === cat.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Preset Emojis Grid */}
        <div className="grid grid-cols-7 sm:grid-cols-8 gap-1.5 max-h-44 overflow-y-auto p-1.5 bg-slate-50 rounded-2xl border border-slate-200">
          {filteredPresets.map((preset) => {
            const isSelected = selectedAvatar === preset.emoji;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onSelectAvatar(preset.emoji, selectedColor)}
                className={`aspect-square rounded-xl text-lg flex items-center justify-center transition hover:scale-115 ${
                  isSelected
                    ? 'bg-blue-100 ring-2 ring-blue-600 scale-105 shadow-xs'
                    : 'hover:bg-white bg-slate-100/70'
                }`}
                title={preset.name}
              >
                {preset.emoji}
              </button>
            );
          })}
        </div>
      </div>

      {onClose && (
        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition"
          >
            Готово
          </button>
        </div>
      )}
    </div>
  );

  if (onClose) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
        <div className="bg-white rounded-3xl p-5 w-full max-w-md shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150 relative">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-800">Выбор аватара и цвета</h3>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 text-xs font-bold"
            >
              ✕
            </button>
          </div>
          {content}
        </div>
      </div>
    );
  }

  return content;
};
