// "Покрыть перерасход": the spending outside the plan past its share, paid by a cut of the plan this month — asked when
// a limit is cut, or picked in "Сбережения меньше на …"; "Отменить" in the toast puts it back.
import type { Currency } from '@/db/fx';
import { currentYm, getPlanBudget, planConverter, unplannedOver } from '@/db/plans';
import { formatWithCurrency } from '@/shared/lib/money';
import { SAVE_FAILED, UNDO } from '@/shared/lib/strings';
import { sheetAlert } from '@/shared/ui/sheetAlert';
import { toast, toastFailure } from '@/shared/ui/toast';
import { coverFromPlan, coverUnplanned } from '../model/commands';

/** less than this (a unit): not worth a question */
const NOISE = 100;

/**
 * Covers up to `minor` (the budget's `currency`) of `over`; `from` — the limit it is taken of (it gives what is left of
 * it at most). The toast says what is left of the overspend, with "Отменить".
 */
export async function coverWithUndo(ym: string, minor: number, over: number, currency: Currency, from?: { label: string; category_id: number }) {
  const money = (v: number) => formatWithCurrency(v, currency);
  try {
    const cut = from ? await coverFromPlan(ym, from.category_id, minor) : null;
    if (from && !cut) { toast(`В «${from.label}» ничего не осталось`); return; }
    if (!from) await coverUnplanned(ym, minor);
    const covered = cut?.covered ?? minor;
    const what = covered >= over ? 'Перерасход вне плана покрыт' : `Перерасход вне плана меньше на ${money(covered)}`;
    toast(from ? `${what} — из «${from.label}»` : what, {
      label: UNDO,
      onPress: () => {
        coverUnplanned(ym, -covered, from && cut ? { category_id: from.category_id, limit_minor: cut.was } : undefined)
          .then(() => toast('Покрытие перерасхода отменено'))
          .catch(toastFailure('undo unplanned cover', SAVE_FAILED));
      },
    });
  } catch (e) {
    toastFailure('cover unplanned', SAVE_FAILED)(e);
  }
}

/**
 * A limit of this month cut by `freed` (its `currency`) while the spending outside the plan is past its share: "Покрыть
 * перерасход вне плана?" — what is freed goes to it (as much as it is past), or to the savings as before.
 */
export async function offerCover(ym: string, freed: number, currency: string): Promise<void> {
  if (ym !== currentYm() || freed < NOISE) return;
  const [over, budget, conv] = await Promise.all([unplannedOver(ym), getPlanBudget(ym), planConverter(ym)]);
  if (!budget) return;
  const inBudget = conv(freed, currency, budget.currency) ?? 0;
  const take = Math.min(over, inBudget);
  if (take < NOISE) return;
  const money = (v: number) => formatWithCurrency(v, budget.currency);
  sheetAlert(
    'Покрыть перерасход вне плана?',
    `Траты вне плана больше доли на ${money(over)}. `
      + (take < inBudget ? `Из освободившихся ${money(inBudget)} им можно отдать ${money(take)}` : `Освободившиеся ${money(take)} можно отдать им`)
      + ' — иначе всё уйдёт в сбережения.',
    [{ text: `Покрыть ${money(take)}`, onPress: () => { coverWithUndo(ym, take, over, budget.currency); } }, { text: 'В сбережения', style: 'cancel' }],
  );
}
