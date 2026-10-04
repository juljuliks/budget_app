import React, { useEffect, useRef, useState } from 'react';
import {
  Animated, Easing, KeyboardAvoidingView, Modal, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle,
} from 'react-native';
import { colors } from './theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /** extra style of the sheet (e.g. a max height) */
  style?: StyleProp<ViewStyle>;
};

const OPEN_MS = 240;
const CLOSE_MS = 200;

/**
 * Every dialog of the app: a sheet sliding up from the bottom. The dimmed backdrop only fades in place (the
 * Modal itself isn't animated: with animationType="slide" the backdrop would slide up with the sheet). Closed by
 * tapping the backdrop or the back button; it stays mounted until the closing animation ends.
 */
export default function BottomSheet({ visible, onClose, title, children, style }: Props) {
  const [mounted, setMounted] = useState(visible);
  const progress = useRef(new Animated.Value(0)).current;
  const [height, setHeight] = useState(800);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(progress, { toValue: 1, duration: OPEN_MS, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    } else {
      Animated.timing(progress, { toValue: 0, duration: CLOSE_MS, easing: Easing.in(Easing.cubic), useNativeDriver: true })
        .start(({ finished }) => { if (finished) setMounted(false); });
    }
  }, [visible, progress]);

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [height, 0] });

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: progress }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Закрыть" />
      </Animated.View>
      {/* the sheet rises above the keyboard */}
      <KeyboardAvoidingView style={styles.wrap} behavior="padding" pointerEvents="box-none">
        <Animated.View
          style={[styles.sheet, style, { transform: [{ translateY }] }]}
          onLayout={(e) => setHeight(e.nativeEvent.layout.height + 40)}
        >
          <View style={styles.handle} />
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(0,0,0,0.35)' },
  wrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '90%', backgroundColor: colors.bg, borderTopLeftRadius: 16, borderTopRightRadius: 16,
    paddingBottom: 24,
  },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, marginTop: 8 },
  title: { fontSize: 18, fontWeight: '600', color: colors.text, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
});
