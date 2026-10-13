import React, { useEffect, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import type { CloseStep } from '@/db/plans';
import { openMonthReport } from '@/shared/navigation/sheets';
import BottomSheet, { SheetScrollView } from '@/shared/ui/BottomSheet';
import { SheetActions } from '@/shared/ui/Button';
import Loading from '@/shared/ui/Loading';
import { currentStep, monthWords, STEP_NAMES, stepAnswered } from './model/closeTexts';
import { useMonthClose } from './model/useMonthClose';
import StepFunds from './ui/StepFunds';
import StepOver from './ui/StepOver';
import StepSavings from './ui/StepSavings';
import { styles } from './ui/styles';

/** after this sheet has closed: one sheet at a time */
const NEXT_SHEET_MS = 250;

/**
 * "Итоги месяца" (sheets.ts → openMonthClose): a month over, step by step — Копилки → Перерасход → Сбережения, each one
 * only if it has a question. "Далее" once the step is answered, "‹ Назад", "Подвести позже" (the answers are kept). The
 * last step: "Отчёт за сентябрь" once everything is answered — the month is closed and its report opens.
 */
export default function MonthCloseSheet({ ym, onClose }: { ym: string | null; onClose: () => void }) {
  const { close: c, failed, load, fund, answer, finish } = useMonthClose(ym);
  const [wanted, setWanted] = useState<CloseStep | null>(null);
  useEffect(() => setWanted(null), [ym]);
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
    <BottomSheet visible={ym !== null} onClose={onClose} title={words ? `Итоги · ${words.title}` : ''}>
      {!c || !words ? <Loading inline failed={failed} onRetry={load} /> : (
        <>
          {step ? (
            <>
              <View style={styles.nav}>
                {at > 0 ? (
                  <TouchableOpacity onPress={() => setWanted(c.steps[at - 1])} hitSlop={8} accessibilityRole="button">
                    <Text style={styles.back}>‹ Назад</Text>
                  </TouchableOpacity>
                ) : <View />}
                <Text style={styles.stepOf}>{`Шаг ${at + 1} из ${c.steps.length} · ${STEP_NAMES[step]}`}</Text>
              </View>
              <View style={styles.progress}>
                {c.steps.map((s, i) => <View key={s} style={[styles.dash, i <= at && styles.dashOn]} />)}
              </View>
            </>
          ) : null}
          <SheetScrollView contentContainerStyle={styles.content}>
            {step === 'funds' ? <StepFunds c={c} onAnswer={fund} /> : null}
            {step === 'over' ? <StepOver c={c} onAnswer={answer} /> : null}
            {step === 'savings' ? <StepSavings c={c} onAnswer={answer} /> : null}
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
  );
}
