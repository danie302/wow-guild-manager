import { useColorScheme } from '@mui/material/styles';

import type { ColorScheme } from './tokens';

/**
 * The current color theme and a way to switch it. Switching applies right away (it sets
 * `data-theme` on <html>) and is remembered in this browser until the user's saved theme loads.
 */
export function useThemeMode(): { theme: ColorScheme; setTheme: (theme: ColorScheme) => void } {
  const { mode, setMode } = useColorScheme();
  return {
    theme: mode === 'light' ? 'light' : 'dark',
    setTheme: (theme) => setMode(theme),
  };
}
