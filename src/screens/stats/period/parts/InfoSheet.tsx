import React from 'react';
import { Text } from 'react-native';
import BottomSheet, { SheetScrollView } from '@/shared/ui/BottomSheet';
import Button from '@/shared/ui/Button';
import type { PeriodView } from '../model/periodView';
import CategoryInfo from './CategoryInfo';
import GroupInfo from './GroupInfo';
import { styles } from './styles';
import type { Info } from './types';

/** How a number on the screen is counted: a category, a limits block, or the line under the donut. */
export default function InfoSheet({ v, info, onClose }: { v: PeriodView; info: Info | null; onClose: () => void }) {
  const cat = info && typeof info === 'object' && 'id' in info ? info : null;
  const group = info && typeof info === 'object' && 'group' in info ? info : null;
  const g = group ? v.groups.find((x) => x.key === group.group) : undefined;
  const catPlan = cat ? v.norms?.byCategory.get(cat.id) : undefined;
  return (
    <BottomSheet
      visible={info !== null}
      onClose={onClose}
      title={cat ? cat.name : group ? v.groupTitle(group.group) : v.pace ? 'Траты за период' : 'Среднее в месяц'}
      style={styles.infoSheet}
    >
      {/* the text scrolls, "Понятно" stays at the bottom; every calculation is set apart in a code style */}
      <SheetScrollView style={styles.infoScroll} contentContainerStyle={styles.info}>
        {cat && catPlan ? <CategoryInfo key={cat.id} v={v} id={cat.id} p={catPlan} />
          : g ? <GroupInfo v={v} g={g} />
            : v.pace ? (
              <Text style={styles.infoText}>
                На эти дни плана нет: показана только структура трат. Задайте лимиты категорий в плане — здесь появятся
                дневные, недельные и месячные лимиты.
              </Text>
            ) : (
              <Text style={styles.infoText}>
                Период длиннее месяца с планом не сравнивается: показана структура трат по категориям и среднее в месяц.
                Среднее считается только по полным месяцам с данными: текущий месяц ещё не закончился, а первый не
                учитывается, если учёт начался не с 1-го числа. Так аренда в начале месяца и дни до установки
                приложения не искажают цифру.
              </Text>
            )}
        <Text style={styles.infoText}>Все суммы — в валюте из настроек, по курсу на день каждой траты.</Text>
      </SheetScrollView>
      <Button title="Понятно" onPress={onClose} style={styles.infoButton} />
    </BottomSheet>
  );
}
