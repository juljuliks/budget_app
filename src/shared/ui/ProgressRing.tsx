import React from 'react';
import Svg, { Circle } from 'react-native-svg';

type Props = { ratio: number; color: string; track: string; size?: number; thickness?: number };

/** A ring filled clockwise from the top by `ratio` (0–1): how far along something is. */
export default function ProgressRing({ ratio, color, track, size = 26, thickness = 4 }: Props) {
  const r = (size - thickness) / 2;
  const length = 2 * Math.PI * r;
  const filled = Math.max(0, Math.min(1, ratio)) * length;
  return (
    <Svg width={size} height={size} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={thickness} fill="none" />
      {filled > 0 ? (
        <Circle
          cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={thickness} fill="none" strokeLinecap="round"
          strokeDasharray={`${filled} ${length}`} transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      ) : null}
    </Svg>
  );
}
