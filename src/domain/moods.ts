// The moods an operation's "Настроение" offers (transactions.mood keeps the id). Only collected for now.

export const MOODS = [
  { id: 'happy', emoji: '😄', label: 'Радость' },
  { id: 'sad', emoji: '😔', label: 'Грусть' },
  { id: 'anxious', emoji: '😰', label: 'Тревога' },
  { id: 'bored', emoji: '🥱', label: 'Скука' },
  { id: 'neutral', emoji: '😐', label: 'Нейтрально' },
] as const;

export type Mood = (typeof MOODS)[number]['id'];

export const isMood = (v: string | null | undefined): v is Mood => MOODS.some((m) => m.id === v);
