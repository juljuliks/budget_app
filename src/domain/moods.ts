// The moods an impulsive purchase's "Что подтолкнуло?" offers (transactions.mood keeps the id; an older answer of a
// purchase not impulsive stays in the database but isn't counted).

/** asked under "Импульсивная"; in the stats — "Что подталкивает" */
export const IMPULSE_TRIGGER = 'Что подтолкнуло?';
export const IMPULSE_TRIGGERS = 'Что подталкивает';
/** the operations' filter of purchases asked with no answer (its chip) */
export const UNANSWERED_CHIP = 'Покупка: без ответа';

export const MOODS = [
  { id: 'happy', emoji: '😄', label: 'Радость' },
  { id: 'sad', emoji: '😔', label: 'Грусть' },
  { id: 'anxious', emoji: '😰', label: 'Тревога' },
  { id: 'bored', emoji: '🥱', label: 'Скука' },
  { id: 'neutral', emoji: '😐', label: 'Нейтрально' },
] as const;

export type Mood = (typeof MOODS)[number]['id'];

export const isMood = (v: string | null | undefined): v is Mood => MOODS.some((m) => m.id === v);
