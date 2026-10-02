import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

type P = { color: string; size?: number };

export const HistoryIcon = ({ color, size = 24 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
    <Path d="M8 6h12M8 12h12M8 18h12" />
    <Circle cx={4} cy={6} r={1} fill={color} />
    <Circle cx={4} cy={12} r={1} fill={color} />
    <Circle cx={4} cy={18} r={1} fill={color} />
  </Svg>
);

export const StatsIcon = ({ color, size = 24 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
    <Circle cx={12} cy={12} r={8} />
    <Path d="M12 4a8 8 0 0 1 8 8h-8z" fill={color} />
  </Svg>
);

export const PlannerIcon = ({ color, size = 24 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
    <Rect x={4} y={5} width={16} height={15} rx={2} />
    <Path d="M4 10h16M9 3v4M15 3v4" />
  </Svg>
);
