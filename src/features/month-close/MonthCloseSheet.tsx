import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import type { CloseStep } from '@/db/plans';
import { openMonthReport } from '@/shared/navigation/sheets';
import BottomSheet, { SheetScrollView } from '@/shared/ui/BottomSheet';
import { SheetActions } from '@/shared/ui/Button';
import Loading from '@/shared/ui/Loading';
import StepsNav from '@/shared/ui/StepsNav';
import { currentStep, monthWords, STEP_NAMES, stepAnswered } from './model/closeTexts';
import { useMonthClose } from './model/useMonthClose';
import StepOver from './ui/StepOver';
import SplitSheet from './ui/SplitSheet';
import StepSavings from './ui/StepSavings';
import { styles } from './ui/styles';

/** after this sheet has closed: one sheet at a time */
const NEXT_SHEET_MS = 250;

/**
 * "Итоги месяца" (sheets.ts → openMonthClose): a month over, step by step — Перерасход → Сбережения ("Сколько удалось
 * отложить?" and how it is laid out over the funds and the savings), each one only if it has a question. "Далее" once the step is answered, "‹ Назад", "Подвести позже" (the answers are kept). The
 * last step: "Отчёт за сентябрь" once everything is answered — the month is closed and its report opens.
 */
export default function MonthCloseSheet({ ym, onClose }: { ym: string | null; onClose: () => void }) {
  const { close: c, failed, load, split, answer, finish } = useMonthClose(ym);
  const [wanted, setWanted] = useState<CloseStep | null>(null);
  const [splitOpen, setSplitOpen] = useState(false);
  useEffect(() => { setWanted(null); setSplitOpen(false); }, [ym]);
  const words = ym ? monthWords(ym) : null;
  const step = c ? currentStep(c.steps, wanted) : null;
  const at = c && step ? c.steps.indexOf(step) : -1;
  const last = c ? at === c.steps.length - 1 : false;

  async function report() {
    if (!ym || !(await finish())) return;
    onClose();
    setTimeout(() => openMonthReport(ym), NEXT_SHEET_MS);
  }

  return (
    <>
    <BottomSheet visible={ym !== null} onClose={onClose} title={words ? `Итоги · ${words.title}` : ''}>
      {!c || !words ? <Loading inline failed={failed} onRetry={load} /> : (
        <>
          {step ? (
            <StepsNav at={at} count={c.steps.length} name={STEP_NAMES[step]} style={styles.steps}
              onBack={at > 0 ? () => setWanted(c.steps[at - 1]) : undefined} />
          ) : null}
          <SheetScrollView contentContainerStyle={styles.content}>
            {step === 'over' ? <StepOver c={c} onAnswer={answer} /> : null}
            {step === 'savings' ? <StepSavings c={c} onAnswer={answer} onSplit={() => setSplitOpen(true)} /> : null}
            {!step ? <Text style={styles.empty}>{`Вопросов о ${words.prep} нет`}</Text> : null}
          </SheetScrollView>
          <View style={styles.actions}>
            {last || !step ? (
              <>
                {!c.complete ? <Text style={styles.hint}>Отчёт откроется, когда ответите на вопросы выше</Text> : null}
                <SheetActions style={c.complete ? undefined : { marginTop: 8 }}
                  submit={{ title: `Отчёт за ${words.nom}`, disabled: !c.complete, onPress: () => { report(); } }}
                  onCancel={onClose} cancelTitle="Подвести позже" />
              </>
            ) : (
              <SheetActions
                submit={{ title: 'Далее', disabled: !stepAnswered(c, step), onPress: () => setWanted(c.steps[at + 1]) }}
                onCancel={onClose} cancelTitle="Подвести позже" />
            )}
          </View>
        </>
      )}
    </BottomSheet>
    {/* over it: a sibling (each sheet its own window) */}
    <SplitSheet c={c} visible={ym !== null && splitOpen} onClose={() => setSplitOpen(false)}
      onSave={(parts) => { split(parts).then(() => setSplitOpen(false)); }} />
    </>
  );
}
