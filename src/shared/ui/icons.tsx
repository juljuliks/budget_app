import React from 'react';
import Svg, { Circle, G, Path } from 'react-native-svg';

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

/** A star (after Lucide "star", ISC license). Filled — the merchant's primary category. */
export const StarIcon = ({ color, size = 16, filled = false }: P & { filled?: boolean }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : 'none'} stroke={color} strokeWidth={2} strokeLinejoin="round">
    <Path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" />
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
    <Path d="M12 2 22.5 21H1.5z" fill={color} stroke="#FFFFFF" strokeWidth={2} strokeLinejoin="round" />
    <Path d="M12 9v5.5" stroke="#FFFFFF" strokeWidth={2.6} strokeLinecap="round" />
    <Circle cx={12} cy={17.6} r={1.5} fill="#FFFFFF" />
  </Svg>
);

/** "Блокировка": the fingerprint key and offer (Material Icons "fingerprint", Apache 2.0) — the same as the system window's. */
export const FingerprintIcon = ({ color, size = 30 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M17.81 4.47c-.08 0-.16-.02-.23-.06C15.66 3.42 14 3 12.01 3c-1.98 0-3.86.47-5.57 1.41-.24.13-.54.04-.68-.2-.13-.24-.04-.55.2-.68C7.82 2.52 9.86 2 12.01 2c2.13 0 3.99.47 6.03 1.52.25.13.34.43.21.67-.09.18-.26.28-.44.28zM3.5 9.72c-.1 0-.2-.03-.29-.09-.23-.16-.28-.47-.12-.7.99-1.4 2.25-2.5 3.75-3.27C9.98 4.04 14 4.03 17.15 5.65c1.5.77 2.76 1.86 3.75 3.25.16.22.11.54-.12.7-.23.16-.54.11-.7-.12-.9-1.26-2.04-2.25-3.39-2.94-2.87-1.47-6.54-1.47-9.4.01-1.36.7-2.5 1.7-3.4 2.96-.08.14-.23.21-.39.21zm6.25 12.07c-.13 0-.26-.05-.35-.15-.87-.87-1.34-1.43-2.01-2.64-.69-1.23-1.05-2.73-1.05-4.34 0-2.97 2.54-5.39 5.66-5.39s5.66 2.42 5.66 5.39c0 .28-.22.5-.5.5s-.5-.22-.5-.5c0-2.42-2.09-4.39-4.66-4.39-2.57 0-4.66 1.97-4.66 4.39 0 1.44.32 2.77.93 3.85.64 1.15 1.08 1.64 1.85 2.42.19.2.19.51 0 .71-.11.1-.24.15-.37.15zm7.17-1.85c-1.19 0-2.24-.3-3.1-.89-1.49-1.01-2.38-2.65-2.38-4.39 0-.28.22-.5.5-.5s.5.22.5.5c0 1.41.72 2.74 1.94 3.56.71.48 1.54.71 2.54.71.24 0 .64-.03 1.04-.1.27-.05.53.13.58.41.05.27-.13.53-.41.58-.57.11-1.07.12-1.21.12zM14.91 22c-.04 0-.09-.01-.13-.02-1.59-.44-2.63-1.03-3.72-2.1-1.4-1.39-2.17-3.24-2.17-5.22 0-1.62 1.38-2.94 3.08-2.94 1.7 0 3.08 1.32 3.08 2.94 0 1.07.93 1.94 2.08 1.94s2.08-.87 2.08-1.94c0-3.77-3.25-6.83-7.25-6.83-2.84 0-5.44 1.58-6.61 4.03-.39.81-.59 1.76-.59 2.8 0 .78.07 2.01.67 3.61.1.26-.03.55-.29.64-.26.1-.55-.04-.64-.29-.49-1.31-.73-2.61-.73-3.96 0-1.2.23-2.29.68-3.24 1.33-2.79 4.28-4.6 7.51-4.6 4.55 0 8.25 3.51 8.25 7.83 0 1.62-1.38 2.94-3.08 2.94s-3.08-1.32-3.08-2.94c0-1.07-.93-1.94-2.08-1.94s-2.08.87-2.08 1.94c0 1.71.66 3.31 1.87 4.51.95.94 1.86 1.46 3.27 1.85.27.07.42.35.35.61-.05.23-.26.38-.47.38z" />
  </Svg>
);

/** The PIN keypad's "erase" (after Lucide "delete", ISC license). */
export const BackspaceIcon = ({ color, size = 26 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M10 5h11v14H10l-7-7z" />
    <Path d="m18 9-6 6M12 9l6 6" />
  </Svg>
);

/** Closes a full-screen window (after Lucide "x", ISC license). */
export const CloseIcon = ({ color, size = 22 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
    <Path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);

/** An operation split between categories (after Lucide "split", ISC license). */
export const SplitIcon = ({ color, size = 16 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M16 3h5v5M8 3H3v5" />
    <Path d="M12 22v-8.3a4 4 0 0 0-1.172-2.872L3 3M15 9l6-6" />
  </Svg>
);

/** Charged again and again: a repeating payment (after Lucide "repeat", ISC license). */
export const RepeatIcon = ({ color, size = 20 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="m17 2 4 4-4 4M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v1a4 4 0 0 1-4 4H3" />
  </Svg>
);

/** A plan item with a limit: bars under a thin ceiling line. */
export const LimitIcon = ({ color, size = 22 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M3 5h18" strokeWidth={1.25} />
    <Path d="M6 20v-6M10 20v-9M14 20v-4M18 20v-7" />
  </Svg>
);

/** A one-off payment in the plan: a price tag (after Lucide "tag", ISC license). */
export const OneOffIcon = ({ color, size = 22 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M3 12V4h8l10 10-8 8z" />
    <Circle cx={7.5} cy={8} r={1.3} />
  </Svg>
);

/** "Повторять каждый месяц": a filled pin tilted 45° (in PlanBadge's circle, on a plan icon's corner). */
export const TiltedPinIcon = ({ color, size = 11 }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <G rotation={45} origin="12, 12" fill={color} stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 17v5M8 3h8" />
      <Path d="M9 10.76V6h6v4.76l2 3.24H7z" />
    </G>
  </Svg>
);
