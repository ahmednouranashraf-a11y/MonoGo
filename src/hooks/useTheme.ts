import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'monoraily_theme';

function readTheme(): Theme {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

/** Puts the theme on <html> and remembers it. Safe to call outside React. */
function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // ignore
  }
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(readTheme);

  // First paint and any other change of `theme`.
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // The attribute is changed right here, not in an effect, so the circle reveal
  // (revealTheme) takes its "after" picture of the new theme straight away.
  const toggle = useCallback(() => {
    const next: Theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    setTheme(next);
  }, []);

  return { theme, toggle };
}
