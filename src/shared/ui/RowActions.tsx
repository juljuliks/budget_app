import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { PencilIcon, TrashIcon } from './icons';
import { colors } from '../theme/theme';
import { space } from '../theme/tokens';

type Props = {
  onEdit?: () => void;
  onDelete: () => void;
  /** accessibility: what is edited / deleted, e.g. the category name */
  subject?: string;
  /** grey trash that still responds (to explain why it can't be deleted) */
  deleteDisabled?: boolean;
};

export const ROW_ICON_SIZE = 18;

/** ✎ and 🗑 at the end of a list row — the same look on every list. */
export default function RowActions({ onEdit, onDelete, subject, deleteDisabled }: Props) {
  const suffix = subject ? `: ${subject}` : '';
  return (
    <View style={styles.row}>
      {onEdit ? (
        <TouchableOpacity
          accessibilityRole="button"
          style={styles.action}
          hitSlop={6}
          onPress={onEdit}
          accessibilityLabel={`Изменить${suffix}`}
        >
          <PencilIcon color={colors.muted} size={ROW_ICON_SIZE} />
        </TouchableOpacity>
      ) : null}
      <TouchableOpacity
        accessibilityRole="button"
        style={styles.action}
        hitSlop={6}
        onPress={onDelete}
        accessibilityLabel={`Удалить${suffix}`}
      >
        <TrashIcon color={deleteDisabled ? colors.border : colors.danger} size={ROW_ICON_SIZE} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  action: { padding: space[6], marginLeft: space[6] },
});
