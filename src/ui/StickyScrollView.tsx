import React from 'react';
import { ScrollView, ScrollViewProps, StyleProp, View, ViewStyle } from 'react-native';

/** A section's header that stays on top while its section scrolls under it (in a StickyScrollView). */
export function SectionHeader({ style, children }: { style?: StyleProp<ViewStyle>; children: React.ReactNode }) {
  return <View style={style}>{children}</View>;
}

/** The children as one flat list: fragments opened (keys prefixed by theirs, so sections' rows stay apart). */
function flatten(children: React.ReactNode, prefix = ''): React.ReactElement[] {
  const out: React.ReactElement[] = [];
  React.Children.toArray(children).forEach((child) => {
    if (!React.isValidElement(child)) return;
    const key = `${prefix}${child.key ?? ''}`;
    if (child.type === React.Fragment) out.push(...flatten((child.props as { children?: React.ReactNode }).children, `${key}/`));
    else out.push(React.cloneElement(child, { key }));
  });
  return out;
}

/**
 * A ScrollView whose SectionHeaders stick to the top, as the operations' day headers do. The headers may sit in
 * fragments (a section as <>header, rows</>): ScrollView only sticks its direct children, so those are opened.
 */
export default function StickyScrollView({ children, ...props }: ScrollViewProps) {
  const items = flatten(children);
  const sticky = items.flatMap((c, i) => (c.type === SectionHeader ? [i] : []));
  return <ScrollView {...props} stickyHeaderIndices={sticky}>{items}</ScrollView>;
}
