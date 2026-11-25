import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { enabledBanks } from '@/db/banks';
import { bankById, BankId } from '@/domain/banks';
import { navigationRef } from '@/shared/navigation/navigation';
import Banner from '@/shared/ui/Banner';
import TextLink from '@/shared/ui/TextLink';
import { font, space } from '@/shared/theme/tokens';
import BankBadge from '@/shared/ui/BankBadge';

/** In "Импорт SMS": which banks' SMS it reads (the ones on), and where to turn on others ("Банки"). */
export default function ImportBanksNote({ close }: { close: () => void }) {
  const [ids, setIds] = useState<BankId[]>([]);
  useEffect(() => {
    enabledBanks()
      .then(setIds)
      .catch((e) => console.error('load banks failed', e));
  }, []);
  const banks = ids.map((id) => bankById(id)!);
  if (!banks.length) return null;
  return (
    <Banner
      tone="neutral"
      title={`Из ${banks.length > 1 ? 'банков' : 'банка'}: ${banks.map((b) => b.name).join(', ')}`}
      left={
        <View style={styles.badges}>
          {banks.map((b) => (
            <BankBadge key={b.id} short={b.short} color={b.color} />
          ))}
        </View>
      }
      style={styles.box}
    >
      <TextLink
        label="Другие банки — в «Банках»"
        onPress={() => {
          close();
          navigationRef.navigate('Banks');
        }}
        style={styles.link}
      />
    </Banner>
  );
}

const styles = StyleSheet.create({
  box: { marginBottom: space[6] },
  badges: { flexDirection: 'row', gap: space[4] },
  link: { fontSize: font.secondary },
});
