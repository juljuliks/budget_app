import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SettingsButton } from '@/features/settings';
import Button from '@/shared/ui/Button';
import { PencilIcon } from '@/shared/ui/icons';

/** "Редактировать" / "Готово" in the tab header, next to the title, and the gear. */
export default function HeaderActions({ editMode, onToggle }: { editMode: boolean; onToggle: () => void }) {
  return (
    <View style={styles.headerRight}>
      <Button
        title={editMode ? 'Готово' : 'Редактировать'}
        onPress={onToggle}
        variant={editMode ? 'primary' : 'secondary'}
        size="small"
        icon={editMode ? undefined : (c) => <PencilIcon color={c} size={13} />}
      />
      <SettingsButton />
    </View>
  );
}

const styles = StyleSheet.create({
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 14, marginRight: 16 },
});
