export interface MathSymbolGroup {
  category: string;
  symbols: { char: string; label: string; insertText?: string }[];
}

export const MATH_SYMBOL_GROUPS: MathSymbolGroup[] = [
  {
    category: 'Алгебра и основы',
    symbols: [
      { char: 'x²', label: 'Квадрат', insertText: '²' },
      { char: 'x³', label: 'Куб', insertText: '³' },
      { char: '√x', label: 'Корень', insertText: '√' },
      { char: '±', label: 'Плюс-минус' },
      { char: '≠', label: 'Не равно' },
      { char: '≤', label: 'Меньше либо равно' },
      { char: '≥', label: 'Больше либо равно' },
      { char: '≈', label: 'Приблизительно' },
      { char: '∞', label: 'Бесконечность' },
      { char: '÷', label: 'Деление' },
      { char: '×', label: 'Умножение' },
      { char: '·', label: 'Точка умножения' },
    ],
  },
  {
    category: 'Греческие буквы (Физика и Математика)',
    symbols: [
      { char: 'π', label: 'Пи (3.14)' },
      { char: 'α', label: 'Альфа' },
      { char: 'β', label: 'Бета' },
      { char: 'γ', label: 'Гамма' },
      { char: 'θ', label: 'Тета' },
      { char: 'Δ', label: 'Дельта' },
      { char: 'λ', label: 'Лямбда' },
      { char: 'μ', label: 'Мю' },
      { char: 'ω', label: 'Омега' },
      { char: 'φ', label: 'Фи' },
      { char: 'ρ', label: 'Ро' },
      { char: 'σ', label: 'Сигма' },
    ],
  },
  {
    category: 'Функции и Высшая математика',
    symbols: [
      { char: 'sin', label: 'Синус', insertText: 'sin(' },
      { char: 'cos', label: 'Косинус', insertText: 'cos(' },
      { char: 'tg', label: 'Тангенс', insertText: 'tg(' },
      { char: 'ctg', label: 'Котангенс', insertText: 'ctg(' },
      { char: 'log', label: 'Логарифм', insertText: 'log_' },
      { char: 'ln', label: 'Натуральный логарифм', insertText: 'ln(' },
      { char: '∫', label: 'Интеграл' },
      { char: '∑', label: 'Сумма' },
      { char: 'lim', label: 'Предел', insertText: 'lim(x→' },
      { char: '∂', label: 'Частная производная' },
      { char: '∈', label: 'Принадлежит' },
      { char: '⊂', label: 'Подмножество' },
    ],
  },
  {
    category: 'Геометрия и Векторы',
    symbols: [
      { char: '∠', label: 'Угол' },
      { char: '⟂', label: 'Перпендикулярно' },
      { char: '∥', label: 'Параллельно' },
      { char: '△', label: 'Треугольник' },
      { char: '°', label: 'Градусы' },
      { char: '→', label: 'Стрелка вправо / Вектор' },
      { char: '⇒', label: 'Следовательно' },
      { char: '⇔', label: 'Равносильно' },
    ],
  },
];

export const QUICK_PALETTES = [
  { name: 'Черный', value: '#1E293B' },
  { name: 'Синий', value: '#2563EB' },
  { name: 'Красный', value: '#DC2626' },
  { name: 'Зеленый', value: '#16A34A' },
  { name: 'Фиолетовый', value: '#9333EA' },
  { name: 'Оранжевый', value: '#EA580C' },
  { name: 'Желтый (Маркер)', value: '#EAB308' },
  { name: 'Бирюзовый', value: '#0D9488' },
  { name: 'Белый (для темной доски)', value: '#F8FAFC' },
];

export const STROKE_WIDTHS = [
  { label: 'Тонкий', size: 2 },
  { label: 'Обычный', size: 4 },
  { label: 'Средний', size: 8 },
  { label: 'Толстый', size: 16 },
  { label: 'Маркер', size: 28 },
];
