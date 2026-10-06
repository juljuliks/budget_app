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

// Shapes after Lucide (ISC license): settings, pencil, trash-2
export const GearIcon = ({ color, size = 20 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <Circle cx={12} cy={12} r={3} />
  </Svg>
);

export const PencilIcon = ({ color, size = 20 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M21.17 6.81a1 1 0 0 0-3.99-3.99L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.35-1.32a2 2 0 0 0 .83-.5z" />
    <Path d="m15 5 4 4" />
  </Svg>
);

export const TrashIcon = ({ color, size = 20 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6" />
  </Svg>
);

export const SearchIcon = ({ color, size = 18 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
    <Circle cx={11} cy={11} r={7} />
    <Path d="m20 20-4-4" />
  </Svg>
);

/** "Reduce the amount": a minus in a circle (after Lucide "circle-minus", ISC license). */
export const MinusCircleIcon = ({ color, size = 20 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
    <Circle cx={12} cy={12} r={10} />
    <Path d="M8 12h8" />
  </Svg>
);

export const ChevronRightIcon = ({ color, size = 18 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M9 5l7 7-7 7" />
  </Svg>
);

export const InfoIcon = ({ color, size = 18 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
    <Circle cx={12} cy={12} r={9.5} />
    <Path d="M12 11v6" />
    <Circle cx={12} cy={7.5} r={0.6} fill={color} />
  </Svg>
);

export const ChevronDownIcon = ({ color, size = 18 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M6 9l6 6 6-6" />
  </Svg>
);

/** "Show amounts" (after Lucide "eye", ISC license). */
export const EyeIcon = ({ color, size = 22 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0" />
    <Circle cx={12} cy={12} r={3} />
  </Svg>
);

/** "Hide amounts" (after Lucide "eye-off", ISC license). */
export const EyeOffIcon = ({ color, size = 22 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c4.29 0 7.84 2.62 9.94 6.65a1 1 0 0 1 0 .7 10.74 10.74 0 0 1-1.44 2.49" />
    <Path d="M14.08 14.16a3 3 0 0 1-4.24-4.24" />
    <Path d="M17.48 17.5a10.75 10.75 0 0 1-15.42-5.15 1 1 0 0 1 0-.7 10.75 10.75 0 0 1 4.45-5.14" />
    <Path d="m2 2 20 20" />
  </Svg>
);

/** Locked for savings (after Lucide "lock", ISC license). */
export const LockIcon = ({ color, size = 14 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M5 11h14v10H5z" />
    <Path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </Svg>
);

/** An overspend inside a bar: a filled triangle with a white "!". */
export const WarnTriangleIcon = ({ color, size = 12 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M12 2.5 23 21.5H1z" fill={color} stroke="#FFFFFF" strokeWidth={1.5} strokeLinejoin="round" />
    <Path d="M12 9.5v5.5" stroke="#FFFFFF" strokeWidth={2.6} strokeLinecap="round" />
    <Circle cx={12} cy={18.2} r={1.4} fill="#FFFFFF" />
  </Svg>
);
