import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { Kind } from '@/domain/types';
import type { Role, Word } from '@/parsers/template';
import SectionHeading from '@/shared/ui/SectionHeading';
import { colors } from '@/shared/theme/theme';
import { KINDS, ROLES, STEP_KIND, STEP_ROLE, STEP_WORDS, WORDS_HINT } from '../texts';

type Props = {
  words: Word[];
  role: Role;
  onRole: (r: Role) => void;
  marks: Record<number, Role>;
  onWord: (i: number) => void;
  kind: Kind;
  onKind: (k: Kind) => void;
};

/** Steps 1–3 of the marking: the role, the words of the message (in the role's color once marked), the type. */
export default function MarkSteps({ words, role, onRole, marks, onWord, kind, onKind }: Props) {
  return (
    <>
      <SectionHeading title={STEP_ROLE} />
      <View style={styles.wrap}>
        {ROLES.map((r) => {
          const on = r.role === role;
          return (
            <TouchableOpacity
              key={r.role}
              onPress={() => onRole(r.role)}
              accessibilityState={{ selected: on }}
              style={[styles.pill, on ? { backgroundColor: r.bg, borderColor: r.line, borderWidth: 2 } : styles.pillOff]}
            >
              <Text style={[styles.pillText, on && { color: r.fg, fontWeight: '600' }]}>{r.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <SectionHeading title={STEP_WORDS} />
      <View style={[styles.wrap, styles.text]}>
        {words.map((w, i) => {
          const r = marks[i] ? ROLES.find((x) => x.role === marks[i]) : undefined;
          return (
            <TouchableOpacity
              key={`${i}-${w.text}`}
              onPress={() => onWord(i)}
              accessibilityLabel={r ? `${w.text}: ${r.label}` : w.text}
              style={[styles.word, r ? { backgroundColor: r.bg, borderBottomColor: r.line, borderBottomWidth: 3, borderWidth: 0 } : styles.wordOff]}
            >
              <Text style={[styles.wordText, r && { color: r.fg, fontWeight: '600' }]}>{w.text}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={styles.hint}>{WORDS_HINT}</Text>

      <SectionHeading title={STEP_KIND} />
      <View style={styles.wrap}>
        {KINDS.map(([k, label]) => (
          <TouchableOpacity
            key={k}
            onPress={() => onKind(k)}
            accessibilityState={{ selected: k === kind }}
            style={[styles.pill, k === kind ? styles.kindOn : styles.pillOff]}
          >
            <Text style={[styles.pillText, k === kind && styles.kindOnText]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { minHeight: 44, paddingHorizontal: 14, borderRadius: 22, justifyContent: 'center' },
  pillOff: { backgroundColor: colors.bg, borderWidth: 1.5, borderColor: '#D1D5DB' },
  pillText: { fontSize: 15, color: '#374151' },
  kindOn: { backgroundColor: colors.accent, borderWidth: 1.5, borderColor: colors.accent },
  kindOnText: { color: colors.onAccent, fontWeight: '600' },
  text: { backgroundColor: colors.surface, borderRadius: 12, padding: 12, gap: 6 },
  word: { minHeight: 36, paddingHorizontal: 8, borderRadius: 8, justifyContent: 'center' },
  wordOff: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border },
  wordText: { fontSize: 16, color: colors.text },
  hint: { fontSize: 13, color: colors.muted, marginTop: 8 },
});
