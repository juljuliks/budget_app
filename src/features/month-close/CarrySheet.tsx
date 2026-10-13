import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { CloseAnswers, monthClose } from '@/db/plans';
import { formatWithCurrency } from '@/shared/lib/money';
import { openMonthClose } from '@/shared/navigation/sheets';
import BottomSheet from '@/shared/ui/BottomSheet';
import { SheetActions } from '@/shared/ui/Button';
import Loading from '@/shared/ui/Loading';
import { monthWords } from './model/closeTexts';
import { useMonthClose } from './model/useMonthClose';
import Choice from './ui/Choice';
import { styles } from './ui/styles';

type Props = {
  /** the month that sent it; null = closed */
  fromYm: string | null;
  /** its overspend owed, or its leftover moved */
  kind: 'debt' | 'plus';
  onClose: () => void;
};

type Option = { value: string; title: string; note: string };

/** after this sheet has closed: one sheet at a time */
const NEXT_SHEET_MS = 250;

/**
 * A tap on what the month before sent (the plan's "Перенос из сентября"): its overspend — "Покрыть иначе?" (from its
 * savings, already covered); its leftover — "Куда остаток?" (to its savings, as is). An answer that opens a question
 * ("Удалось отложить?") opens that month's "Итоги".
 */
export default function CarrySheet({ fromYm, kind, onClose }: Props) {
  const { close: c, failed, load, answer } = useMonthClose(fromYm);
  const [draft, setDraft] = useState<string | null>(null);
  useEffect(() => setDraft(null), [fromYm, kind]);
  const b = c?.budget;
  const m = fromYm ? monthWords(fromYm) : null;
  const next = c ? monthWords(c.next_ym) : null;
  const money = (minor: number) => formatWithCurrency(minor, b?.currency);

  // the overspend 🔒 covered in part: only what it didn't cover is asked again
  const field: keyof CloseAnswers = kind === 'plus' ? 'rest_choice' : c?.answers.over_cover === 'savings' ? 'over_rest_cover' : 'over_cover';
  const options: Option[] = !c || !b || !m || !next ? [] : kind === 'plus' ? [
    { value: 'next', title: `Перенести на ${next.nom}`, note: `как сейчас: бюджет ${next.gen} + ${money(b.rest_minor)}` },
    { value: 'savings', title: 'В сбережения', note: `в сбережения ${m.gen} — спросим, удалось ли отложить` },
    { value: 'keep', title: 'Оставить как есть', note: 'в «Истории» — сэкономлено, никуда не относим' },
  ] : [
    { value: 'next', title: `Из бюджета ${next.gen}`, note: `как сейчас: вычтен из бюджета ${next.gen}` },
    ...(field === 'over_cover' && b.locked_minor > 0 ? [{
      value: 'savings', title: `Из сбережений ${m.gen}`,
      note: `🔒 ${money(b.locked_minor)} → ${money(Math.max(0, b.locked_minor - b.over_minor))} — в «Истории» ${m.gen} отложено меньше`,
    }] : []),
    { value: 'covered', title: 'Уже покрыт', note: 'из прошлых сбережений или со стороны — перерасход останется только в «Истории»' },
  ];
  const current = c ? (c.answers[field] as string | null) : null;
  const chosen = draft ?? current;
  const amount = !b ? 0 : kind === 'plus' ? b.rest_minor : field === 'over_rest_cover' ? b.over_rest_minor : b.over_minor;

  async function save() {
    if (!fromYm || !draft || draft === current) { onClose(); return; }
    await answer({ [field]: draft });
    onClose();
    // "В сбережения": "Удалось отложить?" is asked in the month's "Итоги"
    if (!(await monthClose(fromYm)).complete) setTimeout(() => openMonthClose(fromYm), NEXT_SHEET_MS);
  }

  return (
    <BottomSheet visible={fromYm !== null} onClose={onClose} title={m ? `${kind === 'plus' ? '➕ Остаток' : '⚠️ Перерасход'} ${m.gen}` : ''}>
      {!c || !b || !m || !next ? <Loading inline failed={failed} onRetry={load} /> : (
        <View style={styles.content}>
          <View style={styles.line}>
            <Text style={styles.lineText}>{kind === 'plus' ? `Добавлен к бюджету ${next.gen}` : `Вычтен из бюджета ${next.gen}`}</Text>
            <Text style={[styles.lineValue, kind === 'plus' ? styles.headSaved : styles.headOver]}>{`${kind === 'plus' ? '+' : ''}${money(amount)}`}</Text>
          </View>
          <Text style={styles.muted}>
            {kind === 'plus' ? `Не запланировано и не потрачено в ${m.prep}` : `В ${m.prep} потрачено ${money(b.spent_minor)} при бюджете ${money(b.amount_minor)}`}
          </Text>
          <View style={styles.block}>
            <Text style={styles.question}>{kind === 'plus' ? 'Куда остаток?' : 'Покрыть иначе?'}</Text>
            <Choice options={options} value={chosen} onChange={setDraft} />
          </View>
          <SheetActions submit={{ title: 'Сохранить', disabled: !draft || draft === current, onPress: () => { save(); } }} onCancel={onClose} />
        </View>
      )}
    </BottomSheet>
  );
}
