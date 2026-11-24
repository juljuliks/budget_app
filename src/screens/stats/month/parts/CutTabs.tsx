// The ring's cut, «Категории» / «Разделы»: words as tabs, the chosen one in the accent and underlined — not a second
// segmented control under «Траты» / «План».
import React from 'react';
import { StyleProp, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { CUTS, type DonutCut } from '../model/donutSlices';
import { styles } from './styles';

export default function CutTabs({
  value,
  onChange,
  style,
}: {
  value: DonutCut;
  onChange: (cut: DonutCut) => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.cutTabs, style]} accessibilityRole="tablist">
      {CUTS.map(([key, label]) => (
        <TouchableOpacity
          key={key}
          style={[styles.cutTab, value === key && styles.cutTabOn]}
          onPress={() => onChange(key)}
          hitSlop={6}
          accessibilityRole="tab"
          accessibilityState={{ selected: value === key }}
        >
          <Text style={[styles.cutTabText, value === key && styles.cutTabTextOn]}>{label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
