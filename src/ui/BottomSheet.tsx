import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  Animated, Easing, FlatList, FlatListProps, KeyboardAvoidingView, LayoutChangeEvent, Modal, NativeScrollEvent, NativeSyntheticEvent, PanResponder,
  Pressable, ScrollView, ScrollViewProps, StyleProp, StyleSheet, Text, View, ViewStyle,
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

/** set by a list inside the sheet (useSheetScroll): whether it is scrolled to its top */
const ScrollTopContext = createContext<((atTop: boolean) => void) | null>(null);

/**
 * A scrolling list inside a sheet. Android's scroll view takes every vertical swipe before JS sees it, so a list
 * that fits on the sheet doesn't scroll at all: a swipe down on it drags the sheet. A longer one scrolls; while it
 * is at its top a swipe down is still offered to the sheet (taken where the platform lets it), and the handle and
 * title always drag. Use it (or SheetFlatList) for any scrolling content of a BottomSheet.
 */
function useSheetScroll(p: Pick<ScrollViewProps, 'onScroll' | 'onLayout' | 'onContentSizeChange'>) {
  const setAtTop = useContext(ScrollTopContext);
  const [viewport, setViewport] = useState(0);
  const [content, setContent] = useState(0);
  return {
    scrollEnabled: content > viewport + 1,
    onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      setAtTop?.(e.nativeEvent.contentOffset.y <= 0);
      p.onScroll?.(e);
    },
    onLayout: (e: LayoutChangeEvent) => { setViewport(e.nativeEvent.layout.height); p.onLayout?.(e); },
    onContentSizeChange: (w: number, h: number) => { setContent(h); p.onContentSizeChange?.(w, h); },
    scrollEventThrottle: 16,
  };
}

export function SheetScrollView(props: ScrollViewProps) {
  return <ScrollView {...props} {...useSheetScroll(props)} />;
}

/** A FlatList inside a sheet, see SheetScrollView. */
export const SheetFlatList = React.forwardRef(function SheetFlatList<T>(props: FlatListProps<T>, ref: React.ForwardedRef<FlatList<T>>) {
  return <FlatList ref={ref} {...props} {...useSheetScroll({ ...props, onScroll: props.onScroll ?? undefined })} />;
}) as <T>(props: FlatListProps<T> & { ref?: React.Ref<FlatList<T>> }) => React.ReactElement;

const OPEN_MS = 240;
const CLOSE_MS = 200;
/** a swipe down past this many points, or a quick flick, closes the sheet */
const DRAG_CLOSE = 100;
const FLICK_VY = 0.8;

/**
 * Every dialog of the app: a sheet sliding up from the bottom. The dimmed backdrop only fades in place (the
 * Modal itself isn't animated: with animationType="slide" the backdrop would slide up with the sheet). Closed by
 * tapping the backdrop, the back button or swiping the sheet down; it stays mounted until the closing animation ends.
 */
export default function BottomSheet({ visible, onClose, title, children, style }: Props) {
  const [mounted, setMounted] = useState(visible);
  const progress = useRef(new Animated.Value(0)).current;
  const [height, setHeight] = useState(800);
  // how far the sheet is dragged down by a swipe (0 = in place)
  const drag = useRef(new Animated.Value(0)).current;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // a list inside reports whether it is at its top (useSheetScroll); without one the content is always "at top"
  const atTop = useRef(true);
  const setAtTop = useRef((v: boolean) => { atTop.current = v; }).current;

  // a vertical swipe down on the sheet drags it; released far or fast enough it closes, otherwise springs back.
  // Taken before the children (capture) while a list inside is at its top; the handle and title drag on touch.
  const down = (g: { dx: number; dy: number }) => g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx) * 1.5;
  const dragger = (onTouch: boolean) => PanResponder.create({
    onStartShouldSetPanResponder: () => onTouch,
    onMoveShouldSetPanResponderCapture: (_, g) => atTop.current && down(g),
    onMoveShouldSetPanResponder: (_, g) => down(g),
    onPanResponderTerminationRequest: () => false,
    onPanResponderMove: (_, g) => drag.setValue(Math.max(0, g.dy)),
    onPanResponderRelease: (_, g) => {
      if (g.dy > DRAG_CLOSE || g.vy > FLICK_VY) onCloseRef.current();
      else Animated.spring(drag, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
    },
    onPanResponderTerminate: () => Animated.spring(drag, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start(),
  });
  const pan = useRef(dragger(false)).current;
  const headerPan = useRef(dragger(true)).current;

  useEffect(() => {
    if (visible) {
      drag.setValue(0);
      atTop.current = true;
      setMounted(true);
      Animated.timing(progress, { toValue: 1, duration: OPEN_MS, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    } else {
      Animated.timing(progress, { toValue: 0, duration: CLOSE_MS, easing: Easing.in(Easing.cubic), useNativeDriver: true })
        .start(({ finished }) => { if (finished) setMounted(false); });
    }
  }, [visible, progress, drag]);

  const translateY = Animated.add(progress.interpolate({ inputRange: [0, 1], outputRange: [height, 0] }), drag);

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
          {...pan.panHandlers}
        >
          {/* the handle and the title start a drag right away, even over a list */}
          <View {...headerPan.panHandlers}>
            <View style={styles.handleZone}><View style={styles.handle} /></View>
            {title ? <Text style={styles.title}>{title}</Text> : null}
          </View>
          <ScrollTopContext.Provider value={setAtTop}>{children}</ScrollTopContext.Provider>
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
  // a taller touch zone around the handle, easier to grab
  handleZone: { paddingTop: 8, paddingBottom: 8, marginBottom: -8 },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border },
  title: { fontSize: 18, fontWeight: '600', color: colors.text, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
});
