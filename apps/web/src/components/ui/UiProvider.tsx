import '@fontsource-variable/archivo';

import CssBaseline from '@mui/material/CssBaseline';
import GlobalStyles from '@mui/material/GlobalStyles';
import { ThemeProvider } from '@mui/material/styles';
import type { ReactNode } from 'react';

import { theme } from './theme';
import { fontFamily, tokens, type ColorScheme } from './tokens';

function cssVariables(scheme: ColorScheme): Record<string, string> {
  return Object.fromEntries(
    Object.entries(tokens[scheme]).map(([name, value]) => [`--${name}`, value]),
  );
}

const globalStyles = (
  <GlobalStyles
    styles={{
      '[data-theme="dark"]': cssVariables('dark'),
      '[data-theme="light"]': cssVariables('light'),
      body: {
        fontFamily,
        fontVariantNumeric: 'tabular-nums',
        lineHeight: 1.45,
      },
      ':focus-visible': { outline: '2px solid var(--ac)', outlineOffset: 2 },
      '::selection': { background: 'var(--ac-bg)' },
    }}
  />
);

export interface UiProviderProps {
  children: ReactNode;
  /** Initial color scheme. The user setting arrives in story 011. */
  defaultScheme?: ColorScheme;
}

/** Theme, fonts, and global styles. Wraps the whole app. */
export function UiProvider({ children, defaultScheme = 'dark' }: UiProviderProps) {
  return (
    <ThemeProvider theme={theme} defaultMode={defaultScheme}>
      <CssBaseline />
      {globalStyles}
      {children}
    </ThemeProvider>
  );
}
