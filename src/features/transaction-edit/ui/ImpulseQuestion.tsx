import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { saveImpulse, saveMood } from '@/entities/transaction';
import { isRememberable } from '@/domain/types';
import { isMood, Mood, MOODS } from '@/domain/moods';
import Chip from '@/shared/ui/Chip';
import { formStyles } from '@/shared/theme/formStyles';
import { colors } from '@/shared/theme/theme';
import { toastFailure } from '@/shared/ui/toast';
import { SAVE_FAILED } from '@/shared/lib/strings';
import type { Tx } from '../model/useTransaction';

const ANSWERS = [{ label: 'Обдуманная', value: false }, { label: 'Импульсивная', value: true }] as const;

/**
 * "Покупка": "Обдуманная" / "Импульсивная", and "Настроение" (its emojis in a line, each with its name under it), both
 * the row's width; the chosen chip tapped again takes the answer back. A purchase or a payment in a category with
 * "Импульсивные покупки" on (a split one — in any of its parts), or answered before.
 */
export default function ImpulseQuestion({ tx }: { tx: Tx }) {
  const mood = isMood(tx.mood) ? tx.mood : null;
  if (!isRememberable(tx.kind) || (!tx.impulse_asked && tx.impulse === null && mood === null)) return null;
  const answer = tx.impulse === null ? null : tx.impulse === 1;
  const pick = (v: boolean) => { saveImpulse(tx.id, v === answer ? null : v).catch(toastFailure('save impulse', SAVE_FAILED)); };
  const pickMood = (m: Mood) => { saveMood(tx.id, m === mood ? null : m).catch(toastFailure('save mood', SAVE_FAILED)); };
  return (
    <>
      <Text style={formStyles.label}>Покупка</Text>
      <View style={styles.chips}>
        {ANSWERS.map((a) => <Chip key={a.label} label={a.label} fill selected={answer === a.value} onPress={() => pick(a.value)} />)}
      </View>
      <Text style={styles.question}>Настроение</Text>
      <View style={styles.chips}>
        {MOODS.map((m) => (
          <Chip key={m.id} label={m.emoji} caption={m.label} accessibilityLabel={m.label} fill soft selected={mood === m.id} onPress={() => pickMood(m.id)} />
        ))}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', gap: 8 },
  question: { fontSize: 15, color: colors.text, marginTop: 16, marginBottom: 8 },
});
