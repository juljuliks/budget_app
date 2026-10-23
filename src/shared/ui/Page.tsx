import React from 'react';
import { ScrollView, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { colors } from '../theme/theme';

type Props = {
  children: React.ReactNode;
  /** the page's actions ("Сохранить", "Удалить …"): pinned to the bottom, a line over them */
  footer?: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  /** off while a row is dragged, so the page does not take the gesture */
  scrollEnabled?: boolean;
};

/**
 * A page of one of the budget's things (an operation, a merchant, a category): its content scrolls, its actions stay
 * at the bottom of the screen. Forms and steps over it are sheets.
 */
export default function Page({ children, footer, contentStyle, scrollEnabled = true }: Props) {
  return (
    <View style={styles.page}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, contentStyle]}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={scrollEnabled}
      >
        {children}
      </ScrollView>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: { paddingBottom: 16 },
  footer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.bg },
});
