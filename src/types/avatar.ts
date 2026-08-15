export interface AvatarOption {
  id: string;
  emoji: string;
  name: string;
  category: 'education' | 'animals' | 'tech' | 'creativity';
}

export const AVATAR_PRESETS: AvatarOption[] = [
  // Education & Roles
  { id: 'grad_cap', emoji: '🎓', name: 'Академик', category: 'education' },
  { id: 'teacher', emoji: '👨‍🏫', name: 'Преподаватель', category: 'education' },
  { id: 'student_f', emoji: '👩‍🎓', name: 'Студентка', category: 'education' },
  { id: 'owl', emoji: '🦉', name: 'Мудрая сова', category: 'education' },
  { id: 'book', emoji: '📖', name: 'Знаток', category: 'education' },
  { id: 'brain', emoji: '🧠', name: 'Мыслитель', category: 'education' },

  // Tech & Science
  { id: 'coder', emoji: '🧑‍💻', name: 'Программист', category: 'tech' },
  { id: 'robot', emoji: '🤖', name: 'Робот-гений', category: 'tech' },
  { id: 'rocket', emoji: '🚀', name: 'Исследователь', category: 'tech' },
  { id: 'atom', emoji: '⚛️', name: 'Физик', category: 'tech' },
  { id: 'idea', emoji: '💡', name: 'Эврика', category: 'tech' },
  { id: 'lightning', emoji: '⚡', name: 'Молния', category: 'tech' },

  // Friendly Animals
  { id: 'fox', emoji: '🦊', name: 'Хитрый лис', category: 'animals' },
  { id: 'cat', emoji: '🐱', name: 'Умный кот', category: 'animals' },
  { id: 'panda', emoji: '🐼', name: 'Спокойная панда', category: 'animals' },
  { id: 'lion', emoji: '🦁', name: 'Храбрый лев', category: 'animals' },
  { id: 'unicorn', emoji: '🦄', name: 'Единорог', category: 'animals' },
  { id: 'dog', emoji: '🐶', name: 'Дружелюбный пёс', category: 'animals' },

  // Creativity & Fun
  { id: 'artist', emoji: '🎨', name: 'Художник', category: 'creativity' },
  { id: 'music', emoji: '🎵', name: 'Меломан', category: 'creativity' },
  { id: 'star', emoji: '⭐', name: 'Звезда', category: 'creativity' },
  { id: 'fire', emoji: '🔥', name: 'Огонь', category: 'creativity' },
  { id: 'trophy', emoji: '🏆', name: 'Победитель', category: 'creativity' },
  { id: 'crown', emoji: '👑', name: 'Лидер', category: 'creativity' },
];

export const DEFAULT_AVATAR = '🎓';
