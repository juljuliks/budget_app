// "Итоги месяца": the steps' names, the month's words, which step is answered (its "Далее" is on).
import type { CloseStep, MonthClose } from '@/db/plans';
import { MONTHS, MONTHS_GEN, MONTHS_NOM, MONTHS_PREP } from '@/shared/lib/dates';

export const STEP_NAMES: Record<CloseStep, string> = { funds: 'Копилки', over: 'Перерасход', savings: 'Сбережения' };

/** "сентябрь", "сентября", "в сентябре", "Сентябрь 2026" of a month key */
export function monthWords(ym: string) {
  const m = Number(ym.slice(5)) - 1;
  return { nom: MONTHS_NOM[m], gen: MONTHS_GEN[m], prep: MONTHS_PREP[m], title: `${MONTHS[m]} ${ym.slice(0, 4)}` };
}

/** Every question of the step has an answer. */
export function stepAnswered(c: MonthClose, step: CloseStep): boolean {
  if (step === 'funds') return c.funds.every((f) => f.confirmed_minor !== null);
  const b = c.budget;
  if (!b) return true;
  if (step === 'over') return c.answers.over_cover !== null && (b.over_rest_minor === 0 || c.answers.over_rest_cover !== null);
  return b.ask_minor <= 0 || c.saved_minor !== null;
}

/** The step shown: the one asked for, or — gone with an answer (a fund's "Нет" took the overspend) — the next one. */
export function currentStep(steps: CloseStep[], wanted: CloseStep | null): CloseStep | null {
  if (!steps.length) return null;
  if (wanted && steps.includes(wanted)) return wanted;
  const order: CloseStep[] = ['funds', 'over', 'savings'];
  const from = wanted ? order.indexOf(wanted) : 0;
  return steps.find((s) => order.indexOf(s) >= from) ?? steps[steps.length - 1];
}

/** "Удалось отложить?" answered, as its buttons: by what went in of what was asked. */
export function answerOf(asked: number, minor: number | null): 'yes' | 'other' | 'no' | null {
  if (minor === null) return null;
  return minor === 0 ? 'no' : minor === asked ? 'yes' : 'other';
}
