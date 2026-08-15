import React from 'react';

interface UserAvatarProps {
  avatar?: string;
  name?: string;
  color?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showRoleBadge?: boolean;
  role?: 'tutor' | 'student';
}

const SIZE_MAP = {
  xs: 'w-5 h-5 text-xs',
  sm: 'w-7 h-7 text-sm',
  md: 'w-9 h-9 text-base',
  lg: 'w-12 h-12 text-2xl',
  xl: 'w-16 h-16 text-3xl',
};

export const UserAvatar: React.FC<UserAvatarProps> = ({
  avatar,
  name = 'У',
  color = '#2563EB',
  size = 'md',
  className = '',
  showRoleBadge = false,
  role,
}) => {
  const isImage = avatar && (avatar.startsWith('data:image') || avatar.startsWith('http'));
  const sizeClasses = SIZE_MAP[size] || SIZE_MAP.md;

  return (
    <div
      className={`relative rounded-xl shrink-0 flex items-center justify-center select-none shadow-xs font-bold overflow-hidden ${sizeClasses} ${className}`}
      style={{ backgroundColor: color }}
    >
      {isImage ? (
        <img
          src={avatar}
          alt={name}
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : avatar ? (
        <span className="leading-none flex items-center justify-center">
          {avatar}
        </span>
      ) : (
        <span className="text-white leading-none">
          {name.charAt(0).toUpperCase()}
        </span>
      )}

      {showRoleBadge && role === 'tutor' && (
        <span
          className="absolute -top-1 -right-1 bg-amber-400 text-amber-950 text-[10px] w-4 h-4 rounded-full flex items-center justify-center ring-1 ring-white shadow-xs"
          title="Преподаватель"
        >
          👑
        </span>
      )}
    </div>
  );
};
