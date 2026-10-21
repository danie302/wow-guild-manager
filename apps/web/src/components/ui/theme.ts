import type {} from '@mui/material/themeCssVarsAugmentation';
import { createTheme, type ColorSystemOptions } from '@mui/material/styles';

import { fontFamily, tokens, type ColorScheme } from './tokens';

function colorScheme(scheme: ColorScheme): ColorSystemOptions {
  const t = tokens[scheme];
  return {
    palette: {
      mode: scheme,
      background: { default: t.bg, paper: t.sf },
      text: { primary: t.tx, secondary: t.mt },
      divider: t.dv,
      primary: { main: t.ac, dark: t['ac-h'], contrastText: t['ac-on'] },
      success: { main: t.ok },
      warning: { main: t.warn },
      error: { main: t.bad },
    },
  };
}

export const theme = createTheme({
  cssVariables: {
    // Same switch as the prototype: <html data-theme="dark">.
    colorSchemeSelector: '[data-theme="%s"]',
    // Lets MUI derive colors from the oklch() tokens with CSS relative colors.
    nativeColor: true,
  },
  defaultColorScheme: 'dark',
  colorSchemes: {
    dark: colorScheme('dark'),
    light: colorScheme('light'),
  },
  shape: { borderRadius: 0 },
  typography: {
    fontFamily,
    fontSize: 14,
    // The design's base text: 14px with a line height of 1.45 (MUI's default is 16px).
    body1: { fontSize: 14, lineHeight: 1.45 },
    body2: { fontSize: 13, lineHeight: 1.45 },
    h1: { fontSize: 30, fontWeight: 800, letterSpacing: '-0.015em', lineHeight: 1.1 },
    h2: {
      fontSize: 12,
      fontWeight: 700,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
    },
    button: { textTransform: 'none', fontWeight: 700 },
  },
  components: {
    // Flat surfaces: no shadows except dialogs and toasts.
    MuiPaper: { defaultProps: { elevation: 0 } },
    // Numbers line up in columns (counts, times, item levels), as in the design.
    MuiCssBaseline: {
      styleOverrides: { body: { fontVariantNumeric: 'tabular-nums' } },
    },
    MuiButton: { defaultProps: { disableElevation: true } },
  },
});
