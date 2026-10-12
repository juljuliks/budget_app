import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { enabledBanks } from '@/db/banks';
import { bankById, BankId } from '@/domain/banks';
import { navigationRef } from '@/shared/navigation/navigation';
import { colors } from '@/shared/theme/theme';

/** In "Импорт SMS": which banks' SMS it reads (the ones on), and where to turn on others ("Банки"). */
export default function ImportBanksNote({ close }: { close: () => void }) {
  const [ids, setIds] = useState<BankId[]>([]);
  useEffect(() => { enabledBanks().then(setIds).catch((e) => console.error('load banks failed', e)); }, []);
  const banks = ids.map((id) => bankById(id)!);
  if (!banks.length) return null;
  return (
    <View style={styles.box}>
      <View style={styles.badges}>
        {banks.map((b) => (
          <View key={b.id} style={[styles.badge, { backgroundColor: b.color }]}>
            <Text style={styles.badgeText}>{b.short}</Text>
          </View>
        ))}
      </View>
      <View style={styles.text}>
        <Text style={styles.label}>Из {banks.length > 1 ? 'банков' : 'банка'}: {banks.map((b) => b.name).join(', ')}</Text>
        <TouchableOpacity onPress={() => { close(); navigationRef.navigate('Banks'); }} hitSlop={8} accessibilityRole="link">
          <Text style={styles.link}>Другие банки — в «Банках» ›</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 6 },
  badges: { flexDirection: 'row', gap: 4 },
  badge: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 10, fontWeight: '700', color: colors.onAccent },
  text: { flex: 1, gap: 2 },
  label: { fontSize: 15, color: colors.text },
  link: { fontSize: 14, color: colors.accent },
});
