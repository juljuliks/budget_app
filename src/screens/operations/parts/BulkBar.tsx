import React from 'react';
import { StyleSheet, View } from 'react-native';
import Button from '@/shared/ui/Button';
import { colors } from '@/shared/theme/theme';
import { space } from '@/shared/theme/tokens';

type Props = {
  count: number;
  /** the unread ones among the selected */
  unread: number;
  onRead: () => void;
  onCategory: () => void;
  /** none while sorting out a category being deleted: the operations get categories there, not deleted */
  onDelete?: () => void;
};

/** The selection's actions at the bottom: as on the merchants, the category and deleting side by side. */
export default function BulkBar({ count, unread, onRead, onCategory, onDelete }: Props) {
  return (
    <View style={styles.bar}>
      {unread > 0 ? (
        <Button title={`Отметить просмотренными (${unread})`} onPress={onRead} style={styles.secondary} />
      ) : null}
      <View style={styles.actions}>
        <Button title={`Категория (${count})`} onPress={onCategory} style={styles.button} testID="bulk-category" />
        {onDelete ? <Button title={`Удалить (${count})`} danger onPress={onDelete} style={styles.button} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: space[12],
    gap: space[8],
    backgroundColor: colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  actions: { flexDirection: 'row', gap: space[10] },
  button: { flex: 1 },
  secondary: { backgroundColor: colors.muted },
});
