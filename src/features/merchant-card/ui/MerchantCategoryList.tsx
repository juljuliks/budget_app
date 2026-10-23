import React, { useRef, useState } from 'react';
import { Animated, GestureResponderEvent, PanResponderGestureState, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '@/shared/theme/theme';
import { StarIcon, TrashIcon } from '@/shared/ui/icons';

/** Until a row reports its height: enough for one place up or down. */
const ROW_H = 44;

type Props = {
  ids: number[];
  label: (id: number) => string;
  color: (id: number) => string;
  /** long press turned reordering on: drag a row; the first stays the primary one. The trash is only outside this mode. */
  ordering: boolean;
  onLongPress: () => void;
  onReorder: (from: number, to: number) => void;
  onRemove: (index: number) => void;
};

/** The merchant's categories: a star in the category color for the first, a color dot for the rest. A long press drags. */
export default function MerchantCategoryList({ ids, label, color, ordering, onLongPress, onReorder, onRemove }: Props) {
  return (
    <View>
      {ordering ? <Text style={styles.hint}>Перетащите. Первая — основная категория.</Text> : null}
      <View style={ordering ? styles.block : undefined}>
        {ids.map((id, index) => (
          <Row
            key={id}
            name={label(id)}
            color={color(id)}
            primary={index === 0}
            ordering={ordering}
            index={index}
            count={ids.length}
            onLongPress={onLongPress}
            onReorder={onReorder}
            onRemove={() => onRemove(index)}
          />
        ))}
      </View>
    </View>
  );
}

/** A vertical drag of a row, once reordering is on. The scroll does not take the gesture. */
function useRowDrag(index: number, count: number, enabled: boolean, onReorder: (from: number, to: number) => void) {
  const y = useRef(new Animated.Value(0)).current;
  const indexRef = useRef(index);
  const countRef = useRef(count);
  const enabledRef = useRef(enabled);
  const onReorderRef = useRef(onReorder);
  const rowH = useRef(ROW_H);
  indexRef.current = index;
  countRef.current = count;
  enabledRef.current = enabled;
  onReorderRef.current = onReorder;
  const [dragging, setDragging] = useState(false);
  const origin = useRef(0);
  const moved = useRef(0);
  const byFinger = useRef(false);
  const step = () => rowH.current || ROW_H;
  // past the middle of the next row the card takes its place; it cannot leave the list
  const follow = (raw: number) => {
    const h = step();
    const min = -indexRef.current * h;
    const max = (countRef.current - 1 - indexRef.current) * h;
    const dy = Math.max(min, Math.min(max, raw));
    const slots = Math.round(dy / h);
    const from = indexRef.current;
    const to = Math.max(0, Math.min(countRef.current - 1, from + slots));
    const jumped = to - from;
    if (jumped === 0) {
      moved.current = dy;
      y.setValue(dy);
      return;
    }
    origin.current += jumped * h;
    moved.current = dy - jumped * h;
    indexRef.current = to;
    y.setValue(moved.current);
    onReorderRef.current(from, to);
  };
  const finish = (dy: number) => {
    const from = indexRef.current;
    const to = Math.max(0, Math.min(countRef.current - 1, from + Math.round(dy / step())));
    y.setValue(0);
    moved.current = 0;
    setDragging(false);
    if (to !== from) onReorderRef.current(from, to);
  };
  const touchY = (e: GestureResponderEvent) => e.nativeEvent.touches[0]?.pageY ?? e.nativeEvent.pageY;
  return {
    y, dragging, measure: (h: number) => { if (h > 0) rowH.current = h; },
    handlers: {
      onTouchStart: (e: GestureResponderEvent) => {
        if (!enabledRef.current) return;
        byFinger.current = true;
        origin.current = touchY(e);
        moved.current = 0;
        setDragging(true);
      },
      onTouchMove: (e: GestureResponderEvent) => {
        if (!enabledRef.current) return;
        follow(touchY(e) - origin.current);
      },
      onTouchEnd: () => { if (enabledRef.current) finish(moved.current); },
      onTouchCancel: () => { y.setValue(0); moved.current = 0; setDragging(false); },
      // the screen test releases the responder with a dy; a real finger is handled above
      onResponderRelease: (_: GestureResponderEvent, g?: PanResponderGestureState) => {
        if (byFinger.current) { byFinger.current = false; return; }
        finish(g?.dy ?? 0);
      },
    },
  };
}

function Row({ name, color, primary, ordering, index, count, onLongPress, onReorder, onRemove }: {
  name: string;
  color: string;
  primary: boolean;
  ordering: boolean;
  index: number;
  count: number;
  onLongPress: () => void;
  onReorder: (from: number, to: number) => void;
  onRemove: () => void;
}) {
  const drag = useRowDrag(index, count, ordering, onReorder);
  const label = primary ? `Основная категория, ${name}` : name;
  const face = (
    <>
      <View style={styles.mark}>
        {primary && !ordering ? <StarIcon color={color} size={16} filled /> : <View style={[styles.dot, { backgroundColor: color }]} />}
      </View>
      <Text style={styles.name} numberOfLines={1}>{name}</Text>
      {ordering ? <Grip /> : null}
      {!ordering && count > 1 ? (
        <TouchableOpacity onPress={onRemove} accessibilityRole="button" accessibilityLabel={`Удалить: ${name}`} hitSlop={6} style={styles.trash}>
          <TrashIcon color={colors.danger} size={18} />
        </TouchableOpacity>
      ) : null}
    </>
  );
  return (
    <Animated.View
      style={[styles.drag, { transform: [{ translateY: drag.y }], zIndex: drag.dragging ? 2 : 0 }, drag.dragging && styles.lifted]}
      onLayout={(e) => drag.measure(e.nativeEvent.layout.height)}
    >
      {ordering ? (
        // a plain view, not the animated one: it has to take the finger before the page scrolls
        <View style={styles.row} accessibilityRole="button" accessibilityLabel={label} {...drag.handlers} {...{ onPress: () => undefined }}>
          {face}
        </View>
      ) : (
        <TouchableOpacity
          style={styles.row}
          onPress={() => undefined}
          onLongPress={onLongPress}
          delayLongPress={300}
          accessibilityRole="button"
          accessibilityLabel={label}
        >
          {face}
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

/** Three bars: the row can be dragged. */
function Grip() {
  return (
    <View style={styles.grip}>
      <View style={styles.gripBar} />
      <View style={styles.gripBar} />
      <View style={styles.gripBar} />
    </View>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 13, color: colors.muted, lineHeight: 18, marginBottom: 4 },
  block: { overflow: 'hidden' },
  drag: { backgroundColor: colors.bg },
  lifted: { shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  row: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  mark: { width: 16, marginRight: 10, alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  name: { flex: 1, fontSize: 16, color: colors.text },
  grip: { width: 14, gap: 3, marginLeft: 10 },
  gripBar: { height: 2, borderRadius: 1, backgroundColor: colors.muted },
  trash: { padding: 6 },
});
