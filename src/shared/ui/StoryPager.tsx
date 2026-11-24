import React, { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme/theme';
import Button from './Button';
import { CloseIcon } from './icons';
import { font, space } from '../theme/tokens';

type Props = {
  visible: boolean;
  /** «Отчёт · Сентябрь 2026» over the screens */
  title: string;
  /** the screens, in order (the ones without data left out by the caller) */
  pages: React.ReactNode[];
  onClose: () => void;
  /** a screen to open on (its index), e.g. coming back to a story */
  start?: number;
  /** while loading or failed: shown instead of the screens */
  placeholder?: React.ReactNode;
};

/**
 * Stories over the whole screen: the progress bars on top, «1 из 5», ✕; at the bottom «‹ Назад» / «Дальше ›» (the last
 * one — «Готово»); a tap on a side edge pages too. A screen's content scrolls when it is long.
 */
export default function StoryPager({ visible, title, pages, onClose, start = 0, placeholder }: Props) {
  const [at, setAt] = useState(start);
  // opened again: from its start
  useEffect(() => {
    if (visible) setAt(start);
  }, [visible, start]);
  const n = pages.length;
  const i = Math.min(at, Math.max(0, n - 1));
  const back = () => setAt(Math.max(0, i - 1));
  const next = () => (i >= n - 1 ? onClose() : setAt(i + 1));
  return (
    <Modal visible={visible} onRequestClose={onClose} animationType="slide" statusBarTranslucent={false}>
      <View style={styles.screen} testID="story">
        <View style={styles.bars}>
          {pages.map((_, k) => (
            <View key={k} style={[styles.bar, k <= i && styles.barOn]} />
          ))}
        </View>
        <View style={styles.head}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {n > 1 ? <Text style={styles.count}>{`${i + 1} из ${n}`}</Text> : null}
          <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityLabel="Закрыть" style={styles.close}>
            <CloseIcon color={colors.muted} size={22} />
          </TouchableOpacity>
        </View>
        {placeholder ?? (
          <View style={styles.body}>
            <ScrollView key={i} contentContainerStyle={styles.content}>
              {pages[i]}
            </ScrollView>
            {/* the side edges page as the buttons do */}
            {i > 0 ? (
              <TouchableOpacity
                style={[styles.edge, styles.left]}
                onPress={back}
                accessibilityLabel="Предыдущий экран"
                testID="story-back-edge"
              />
            ) : null}
            <TouchableOpacity
              style={[styles.edge, styles.right]}
              onPress={next}
              accessibilityLabel="Следующий экран"
              testID="story-next-edge"
            />
          </View>
        )}
        {placeholder ? null : (
          <View style={styles.buttons}>
            <Button title="‹ Назад" variant="secondary" onPress={back} disabled={i === 0} style={styles.flex} />
            <Button title={i >= n - 1 ? 'Готово' : 'Дальше ›'} onPress={next} style={styles.flex} />
          </View>
        )}
      </View>
    </Modal>
  );
}

const EDGE = 28;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: space[16],
    paddingTop: space[14],
    paddingBottom: space[16],
  },
  bars: { flexDirection: 'row', gap: space[4] },
  bar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: colors.border },
  barOn: { backgroundColor: colors.accent },
  head: { flexDirection: 'row', alignItems: 'center', gap: space[8], marginTop: space[6] },
  title: { fontSize: font.body, color: colors.muted, flexShrink: 1 },
  count: { fontSize: font.body, color: colors.muted, flex: 1 },
  close: { marginLeft: 'auto', padding: space[8] },
  body: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', paddingVertical: space[12], paddingHorizontal: space[4] },
  edge: { position: 'absolute', top: 0, bottom: 0, width: EDGE },
  left: { left: -16 },
  right: { right: -16 },
  buttons: { flexDirection: 'row', gap: space[10], marginTop: space[8] },
  flex: { flex: 1 },
});
