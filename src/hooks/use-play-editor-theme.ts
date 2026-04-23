'use client';

import { useEffect, useState } from 'react';
import {
  DEFAULT_PLAY_EDITOR_THEME,
  normalizePlayEditorTheme,
  PLAY_EDITOR_THEME_STORAGE_KEY,
  type PlayEditorTheme,
} from '@/lib/plays/play-theme';

function readThemeFromStorage(): PlayEditorTheme {
  if (typeof window === 'undefined') {
    return DEFAULT_PLAY_EDITOR_THEME;
  }

  return normalizePlayEditorTheme(
    window.localStorage.getItem(PLAY_EDITOR_THEME_STORAGE_KEY)
  );
}

export function usePlayEditorTheme() {
  const [theme, setTheme] = useState<PlayEditorTheme>(
    DEFAULT_PLAY_EDITOR_THEME
  );

  useEffect(() => {
    const applyStoredTheme = () => {
      setTheme(readThemeFromStorage());
    };

    applyStoredTheme();
    window.addEventListener('storage', applyStoredTheme);

    return () => {
      window.removeEventListener('storage', applyStoredTheme);
    };
  }, []);

  const updateTheme = (nextTheme: PlayEditorTheme) => {
    setTheme(nextTheme);

    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(PLAY_EDITOR_THEME_STORAGE_KEY, nextTheme);
  };

  return {
    theme,
    setTheme: updateTheme,
  };
}
