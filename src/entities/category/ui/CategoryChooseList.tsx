import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { categoryShortLabel } from '@/db/categories';
import { NO_CATEGORY } from '@/shared/lib/strings';
import { formStyles } from '@/shared/theme/formStyles';
import { colors } from '@/shared/theme/theme';
import Checkbox from '@/shared/ui/Checkbox';
import type { ChooseSection } from '../model/chooseList';

type Props = {
  sections: ChooseSection[];
  colorOf: Map<number, string>;
  none: boolean;
  many: boolean;
  picked: number[];
  /** the highlighted one; null is "Без категории"; undefined is nothing yet */
  current: number | null | undefined;
  onPress: (id: number) => void;
  onHold: (id: number) => void;
  onNone: () => void;
};

/** The categories, as on the categories page: a section band, a color dot, emoji and name. A tap picks. */
export default function CategoryChooseList({ sections, colorOf, none, many, picked, current, onPress, onHold, onNone }: Props) {
  return (
    <View>
      {none ? (
        <Row
          label={NO_CATEGORY}
          color={colors.border}
          box={many ? false : undefined}
          dim={many}
          mark={!many && current === null}
          onPress={onNone}
        />
      ) : null}
      {sections.map((s, i) => (
        <View key={s.title ?? `lead-${i}`}>
          {s.title ? <Text style={formStyles.sectionHeader}>{s.title}</Text> : null}
          {s.data.map((c) => (
            <Row
              key={c.id}
              label={categoryShortLabel(c)}
              color={colorOf.get(c.id) ?? colors.border}
              box={many ? picked.includes(c.id) : undefined}
              mark={!many && current === c.id}
              onPress={() => onPress(c.id)}
              onLongPress={() => onHold(c.id)}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

function Row({ label, color, box, dim, mark, onPress, onLongPress }: {
  label: string;
  color: string;
  /** a checkbox (several); undefined hides it. false is unchecked. */
  box?: boolean;
  dim?: boolean;
  mark: boolean;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} onLongPress={onLongPress} accessibilityRole="button">
      {box !== undefined ? <View style={[styles.check, dim && styles.dim]}><Checkbox checked={box} size={20} /></View> : null}
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.name} numberOfLines={1}>{label}</Text>
      {mark ? <Text style={styles.mark}>✓</Text> : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 16, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  check: { marginRight: 10 },
  dim: { opacity: 0.35 },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  name: { flex: 1, fontSize: 16, color: colors.text },
  mark: { fontSize: 18, color: colors.accent, fontWeight: '700', marginLeft: 8 },
});
