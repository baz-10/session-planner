import type { PlayEditorTheme } from '@/lib/plays/play-theme';

// A full basketball court in feet (94 x 50), drawn in the same three themes as the play editor.
// The right-hand half is drawn once and mirrored for the left.

interface CourtPalette {
  line: string;
  lineOpacity: number;
  paint: { fill: string; opacity: number }[];
}

export const COURT_PALETTE: Record<PlayEditorTheme, CourtPalette> = {
  hardwood: {
    line: '#fff8ed',
    lineOpacity: 1,
    paint: [
      { fill: '#0f1f33', opacity: 0.55 },
      { fill: '#14b8a6', opacity: 0.12 },
    ],
  },
  tactical: { line: '#5eead4', lineOpacity: 0.7, paint: [{ fill: '#14b8a6', opacity: 0.06 }] },
  blueprint: { line: '#ffffff', lineOpacity: 0.85, paint: [{ fill: '#ffffff', opacity: 0.05 }] },
};

function CourtHalf({ theme }: { theme: PlayEditorTheme }) {
  const palette = COURT_PALETTE[theme];
  const major = { stroke: palette.line, strokeWidth: 0.2, fill: 'none' };
  const minor = { stroke: palette.line, strokeWidth: 0.13, fill: 'none' };
  return (
    <g strokeLinecap="round" strokeLinejoin="round" opacity={palette.lineOpacity}>
      {palette.paint.map((paint, i) => (
        <rect key={i} x={75} y={17} width={19} height={16} fill={paint.fill} opacity={paint.opacity} />
      ))}
      <rect x={75} y={17} width={19} height={16} {...major} />
      <path d="M75 19 A6 6 0 0 0 75 31" {...minor} />
      <path d="M75 19 A6 6 0 0 1 75 31" {...minor} strokeDasharray="0.8 0.8" />
      <path d="M94 3 L79.8 3 A23.75 23.75 0 0 0 79.8 47 L94 47" {...major} />
      <path d="M88.75 21 A4 4 0 0 0 88.75 29" {...minor} />
      {[87, 84, 81, 78].map((x) => (
        <g key={x}>
          <line x1={x} y1={16.3} x2={x} y2={17} {...minor} />
          <line x1={x} y1={33} x2={x} y2={33.7} {...minor} />
        </g>
      ))}
      <line x1={90} y1={22} x2={90} y2={28} {...major} strokeWidth={0.3} />
      <line x1={90} y1={25} x2={89.5} y2={25} {...minor} />
    </g>
  );
}

export function DrillCourt({ theme, idPrefix }: { theme: PlayEditorTheme; idPrefix: string }) {
  const palette = COURT_PALETTE[theme];
  const bg = `${idPrefix}-bg`;
  const tex = `${idPrefix}-tex`;
  const tex2 = `${idPrefix}-tex2`;
  return (
    <g>
      <defs>
        {theme === 'hardwood' && (
          <>
            <linearGradient id={bg} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#e2c08e" />
              <stop offset="1" stopColor="#d3aa72" />
            </linearGradient>
            <pattern id={tex} patternUnits="userSpaceOnUse" width={12} height={2.4}>
              <rect width={12} height={0.06} fill="#8e5a2a" opacity={0.35} />
              <rect y={1.2} width={5} height={0.05} fill="#8e5a2a" opacity={0.2} />
              <rect x={0} y={0.6} width={12} height={0.5} fill="#fff1d4" opacity={0.08} />
              <rect x={7.5} y={1.2} width={0.05} height={1.2} fill="#8e5a2a" opacity={0.25} />
            </pattern>
          </>
        )}
        {theme === 'tactical' && (
          <>
            <radialGradient id={bg} cx="50%" cy="40%" r="80%">
              <stop offset="0" stopColor="#142238" />
              <stop offset="0.6" stopColor="#0b1424" />
              <stop offset="1" stopColor="#050a14" />
            </radialGradient>
            <pattern id={tex} patternUnits="userSpaceOnUse" width={2.5} height={2.5}>
              <path d="M2.5 0 L0 0 0 2.5" fill="none" stroke="#5eead4" strokeWidth={0.04} opacity={0.1} />
            </pattern>
          </>
        )}
        {theme === 'blueprint' && (
          <>
            <linearGradient id={bg} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#1e3a5f" />
              <stop offset="1" stopColor="#14243d" />
            </linearGradient>
            <pattern id={tex} patternUnits="userSpaceOnUse" width={1.5} height={1.5}>
              <path d="M1.5 0 L0 0 0 1.5" fill="none" stroke="#ffffff" strokeWidth={0.03} opacity={0.1} />
            </pattern>
            <pattern id={tex2} patternUnits="userSpaceOnUse" width={7.5} height={7.5}>
              <path d="M7.5 0 L0 0 0 7.5" fill="none" stroke="#ffffff" strokeWidth={0.05} opacity={0.18} />
            </pattern>
          </>
        )}
      </defs>
      <rect x={-20} y={-20} width={134} height={90} fill={`url(#${bg})`} />
      <rect x={-20} y={-20} width={134} height={90} fill={`url(#${tex})`} />
      {theme === 'blueprint' && <rect x={-20} y={-20} width={134} height={90} fill={`url(#${tex2})`} />}
      <g strokeLinecap="round" opacity={palette.lineOpacity}>
        <rect x={0} y={0} width={94} height={50} fill="none" stroke={palette.line} strokeWidth={0.22} />
        <line x1={47} y1={0} x2={47} y2={50} stroke={palette.line} strokeWidth={0.2} />
        <circle cx={47} cy={25} r={6} fill="none" stroke={palette.line} strokeWidth={0.2} />
        <circle cx={47} cy={25} r={2} fill="none" stroke={palette.line} strokeWidth={0.13} />
      </g>
      <CourtHalf theme={theme} />
      <g transform="matrix(-1 0 0 1 94 0)">
        <CourtHalf theme={theme} />
      </g>
    </g>
  );
}

/** The rim and net sit above the players and ball so a made shot drops through them. */
export function DrillRim({ x, y, ripple }: { x: number; y: number; ripple: number }) {
  const s = 1 + 0.25 * ripple;
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r={0.75 * s} fill="none" stroke="#ffffff" strokeOpacity={0.55} strokeWidth={0.12} strokeDasharray="0.18 0.14" />
      <circle r={0.75} fill="none" stroke="#f97316" strokeWidth={0.16} />
      {ripple > 0 && <circle r={0.75 + 2.4 * (1 - ripple)} fill="none" stroke="#fbbf24" strokeWidth={0.12} opacity={ripple} />}
    </g>
  );
}
