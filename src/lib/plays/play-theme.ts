export type PlayEditorTheme = 'hardwood' | 'tactical' | 'blueprint';

export const PLAY_EDITOR_THEME_STORAGE_KEY = 'play-editor-theme';
export const DEFAULT_PLAY_EDITOR_THEME: PlayEditorTheme = 'hardwood';

export const PLAY_EDITOR_THEME_OPTIONS: Array<{
  value: PlayEditorTheme;
  label: string;
}> = [
  { value: 'hardwood', label: 'Hardwood' },
  { value: 'tactical', label: 'Tactical' },
  { value: 'blueprint', label: 'Blueprint' },
];

export function isPlayEditorTheme(value: unknown): value is PlayEditorTheme {
  return value === 'hardwood' || value === 'tactical' || value === 'blueprint';
}

export function normalizePlayEditorTheme(value: unknown): PlayEditorTheme {
  return isPlayEditorTheme(value) ? value : DEFAULT_PLAY_EDITOR_THEME;
}

export function isDarkPlayEditorTheme(theme: PlayEditorTheme): boolean {
  return theme === 'tactical' || theme === 'blueprint';
}

export interface PlayEditorThemeChrome {
  isDark: boolean;
  shellBg: string;
  panelBg: string;
  panelInk: string;
  subtleInk: string;
  borderColor: string;
  chipBg: string;
  centerBg: string;
  courtShadow: string;
  cardBg: string;
  fieldBg: string;
  fieldBorder: string;
}

export function getPlayEditorThemeChrome(
  theme: PlayEditorTheme
): PlayEditorThemeChrome {
  if (theme === 'tactical') {
    return {
      isDark: true,
      shellBg: '#050a14',
      panelBg: '#0f1f33',
      panelInk: '#e2e8f0',
      subtleInk: '#94a3b8',
      borderColor: 'rgba(255,255,255,0.08)',
      chipBg: 'rgba(148,163,184,0.12)',
      centerBg:
        'radial-gradient(1200px 600px at 50% -20%, rgba(20,184,166,0.08), transparent 70%), #050a14',
      courtShadow:
        '0 30px 80px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(94,234,212,0.25)',
      cardBg: 'rgba(255,255,255,0.03)',
      fieldBg: 'rgba(148,163,184,0.12)',
      fieldBorder: 'rgba(255,255,255,0.08)',
    };
  }

  if (theme === 'blueprint') {
    return {
      isDark: true,
      shellBg: '#14243d',
      panelBg: '#0f1f33',
      panelInk: '#e2e8f0',
      subtleInk: '#94a3b8',
      borderColor: 'rgba(255,255,255,0.08)',
      chipBg: 'rgba(148,163,184,0.12)',
      centerBg:
        'linear-gradient(180deg, rgba(30,58,95,0.92) 0%, rgba(15,31,51,1) 100%)',
      courtShadow:
        '0 30px 80px rgba(15,31,51,0.4), inset 0 0 0 1px rgba(255,255,255,0.12)',
      cardBg: 'rgba(255,255,255,0.03)',
      fieldBg: 'rgba(148,163,184,0.12)',
      fieldBorder: 'rgba(255,255,255,0.08)',
    };
  }

  return {
    isDark: false,
    shellBg: '#f8fafc',
    panelBg: '#ffffff',
    panelInk: '#0f1f33',
    subtleInk: '#64748b',
    borderColor: '#e2e8f0',
    chipBg: '#f1f5f9',
    centerBg: '#f8fafc',
    courtShadow:
      '0 30px 80px rgba(61,31,8,0.35), inset 0 0 0 1px rgba(0,0,0,0.15)',
    cardBg: '#ffffff',
    fieldBg: '#f8fafc',
    fieldBorder: '#e2e8f0',
  };
}
