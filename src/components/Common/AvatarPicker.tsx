import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AVATAR_PRESETS } from '../../types/avatar';
import { UserAvatar } from './UserAvatar';
import {
  Upload,
  Sparkles,
  Palette,
  User,
  Check,
  X,
  ShieldCheck,
  GraduationCap,
} from 'lucide-react';

interface AvatarPickerProps {
  selectedAvatar: string;
  selectedColor?: string;
  userName?: string;
  userRole?: string;
  isOpen?: boolean;
  onClose?: () => void;
  onSelectAvatar?: (avatar: string, color?: string) => void;
  onSelectColor?: (color: string) => void;
  onSaveProfile?: (profile: { userName: string; avatar: string; color: string }) => void;
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
  userName = 'Пользователь',
  userRole = 'student',
  isOpen = true,
  onClose,
  onSelectAvatar,
  onSelectColor,
  onSaveProfile,
}) => {
  const [activeCategory, setActiveCategory] = useState<'all' | 'education' | 'tech' | 'animals' | 'creativity'>('all');
  const [nameInput, setNameInput] = useState(userName);
  const [currentAvatar, setCurrentAvatar] = useState(selectedAvatar);
  const [currentColor, setCurrentColor] = useState(selectedColor);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setNameInput(userName);
    setCurrentAvatar(selectedAvatar);
    setCurrentColor(selectedColor);
  }, [userName, selectedAvatar, selectedColor, isOpen]);

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
        const dataUrl = event.target.result;
        setCurrentAvatar(dataUrl);
        onSelectAvatar?.(dataUrl, currentColor);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleColorChange = (c: string) => {
    setCurrentColor(c);
    onSelectColor?.(c);
    onSelectAvatar?.(currentAvatar, c);
  };

  const handleAvatarPresetClick = (emoji: string) => {
    setCurrentAvatar(emoji);
    onSelectAvatar?.(emoji, currentColor);
  };

  const handleSave = () => {
    const finalName = nameInput.trim() || userName || 'Пользователь';
    if (onSaveProfile) {
      onSaveProfile({
        userName: finalName,
        avatar: currentAvatar,
        color: currentColor,
      });
    } else if (onSelectAvatar) {
      onSelectAvatar(currentAvatar, currentColor);
    }
    onClose?.();
  };

  const filteredPresets =
    activeCategory === 'all'
      ? AVATAR_PRESETS
      : AVATAR_PRESETS.filter((p) => p.category === activeCategory);

  const content = (
    <div className="space-y-4 text-slate-800 font-sans">
      {/* Current Preview Card */}
      <div className="flex items-center gap-3.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-200 shadow-xs">
        <UserAvatar
          avatar={currentAvatar}
          color={currentColor}
          name={nameInput || 'Пользователь'}
          size="lg"
          className="ring-2 ring-offset-2 shadow-sm"
          style={{ ringColor: currentColor }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-sm font-bold text-slate-900 truncate">
              {nameInput || 'Без имени'}
            </span>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                userRole === 'tutor'
                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                  : 'bg-blue-100 text-blue-800 border border-blue-200'
              }`}
            >
              {userRole === 'tutor' ? (
                <>
                  <ShieldCheck className="w-3 h-3 text-amber-600" />
                  Преподаватель
                </>
              ) : (
                <>
                  <GraduationCap className="w-3 h-3 text-blue-600" />
                  Ученик
                </>
              )}
            </span>
          </div>
          <div className="text-[11px] text-slate-500">
            Имя, аватар и цвет отображаются на доске и в чате
          </div>
        </div>
      </div>

      {/* Name Input */}
      <div>
        <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
          <User className="w-3.5 h-3.5 text-blue-600" />
          Ваше имя в уроке:
        </label>
        <div className="relative">
          <input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="Введите ваше имя..."
            maxLength={32}
            className="w-full bg-slate-50 hover:bg-slate-100/60 focus:bg-white border border-slate-200 focus:border-blue-500 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-semibold focus:outline-none transition"
          />
          {nameInput && (
            <button
              type="button"
              onClick={() => setNameInput('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Color Swatches */}
      <div>
        <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
          <Palette className="w-3.5 h-3.5 text-blue-600" />
          Цвет маркера, курсора и профиля:
        </label>
        <div className="flex items-center gap-1.5 flex-wrap">
          {COLOR_PALETTE.map((c) => {
            const isSelected = currentColor?.toLowerCase() === c.toLowerCase();
            return (
              <button
                key={c}
                type="button"
                onClick={() => handleColorChange(c)}
                className={`w-6 h-6 rounded-lg transition transform hover:scale-110 flex items-center justify-center cursor-pointer ${
                  isSelected ? 'ring-2 ring-offset-2 ring-slate-800 scale-105 shadow-xs' : 'opacity-80 hover:opacity-100'
                }`}
                style={{ backgroundColor: c }}
                title={`Выбрать цвет ${c}`}
              >
                {isSelected && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Avatar Presets & Upload */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            Иконка / Аватар:
          </label>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer"
          >
            <Upload className="w-3 h-3" /> Загрузить фото
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
          />
        </div>

        {/* Categories Tabs */}
        <div className="flex gap-1 overflow-x-auto pb-1 mb-2 scrollbar-none">
          {[
            { id: 'all', label: 'Все' },
            { id: 'education', label: 'Учёба 🎓' },
            { id: 'tech', label: 'Наука 🚀' },
            { id: 'animals', label: 'Герои 🦊' },
            { id: 'creativity', label: 'Арт 🎨' },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id as any)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
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
        <div className="grid grid-cols-7 sm:grid-cols-8 gap-1.5 max-h-40 overflow-y-auto p-1.5 bg-slate-50 rounded-2xl border border-slate-200">
          {filteredPresets.map((preset) => {
            const isSelected = currentAvatar === preset.emoji;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleAvatarPresetClick(preset.emoji)}
                className={`aspect-square rounded-xl text-lg flex items-center justify-center transition hover:scale-115 cursor-pointer ${
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

      {/* Modal Actions */}
      <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
          >
            Отмена
          </button>
        )}
        <button
          type="button"
          onClick={handleSave}
          className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition shadow-md shadow-blue-600/20 cursor-pointer flex items-center gap-1.5"
        >
          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
          Сохранить
        </button>
      </div>
    </div>
  );

  if (onClose) {
    return createPortal(
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
        <div className="bg-white rounded-3xl p-5 w-full max-w-md shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150 relative my-auto">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <User className="w-4 h-4 text-blue-600" />
              Профиль и персональные настройки
            </h3>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 text-xs font-bold cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {content}
        </div>
      </div>,
      document.body
    );
  }

  return content;
};
