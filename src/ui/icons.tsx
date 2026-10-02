import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

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

/** Pushpin (shape after Lucide "pin", ISC license). Filled when pinned. */
export const PinIcon = ({ color, size = 20, filled = false }: P & { filled?: boolean }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round">
    <Path d="M12 17v5" />
    <Path
      d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"
      fill={filled ? color : 'none'}
    />
  </Svg>
);
