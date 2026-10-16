/**
 * Design tokens from docs/design (the prototype's theme blocks), for both color schemes.
 * They become CSS variables (--bg, --ac, …) under [data-theme="dark"] and [data-theme="light"],
 * and the MUI palette is built from the same values.
 */
export type ColorScheme = 'dark' | 'light';

export const tokens = {
  dark: {
    bg: '#141312',
    sf: '#1c1a18',
    sf2: '#262321',
    tx: '#ece8e2',
    mt: '#a59f96',
    dv: 'rgba(236,232,226,.30)',
    ln: 'rgba(236,232,226,.10)',
    ac: 'oklch(0.80 0.12 80)',
    'ac-h': 'oklch(0.86 0.11 84)',
    'ac-on': '#1a1408',
    'ac-ink': 'oklch(0.83 0.12 80)',
    'ac-bg': 'oklch(0.80 0.12 80 / .14)',
    tank: 'oklch(0.72 0.13 250)',
    heal: 'oklch(0.76 0.15 150)',
    dps: 'oklch(0.70 0.17 25)',
    'tank-bg': 'oklch(0.72 0.13 250 / .16)',
    'heal-bg': 'oklch(0.76 0.15 150 / .16)',
    'dps-bg': 'oklch(0.70 0.17 25 / .16)',
    ok: 'oklch(0.78 0.13 165)',
    warn: 'oklch(0.80 0.14 62)',
    bad: 'oklch(0.72 0.18 15)',
    'ok-bg': 'oklch(0.78 0.13 165 / .15)',
    'warn-bg': 'oklch(0.80 0.14 62 / .16)',
    'bad-bg': 'oklch(0.72 0.18 15 / .17)',
    'c-druid': 'oklch(0.76 0.15 55)',
    'c-hunter': 'oklch(0.80 0.14 130)',
    'c-mage': 'oklch(0.80 0.11 220)',
    'c-paladin': 'oklch(0.78 0.12 350)',
    'c-priest': '#f2efea',
    'c-rogue': 'oklch(0.88 0.15 100)',
    'c-warlock': 'oklch(0.74 0.13 300)',
    'c-warrior': 'oklch(0.76 0.07 60)',
    'c-shaman': 'oklch(0.66 0.14 250)',
  },
  light: {
    bg: '#f3f2f2',
    sf: '#eae9e9',
    sf2: '#dfdddc',
    tx: '#201e1d',
    mt: '#5e5956',
    dv: 'rgba(32,30,29,.40)',
    ln: 'rgba(32,30,29,.13)',
    ac: 'oklch(0.76 0.13 76)',
    'ac-h': 'oklch(0.71 0.13 74)',
    'ac-on': '#1f1606',
    'ac-ink': 'oklch(0.50 0.10 70)',
    'ac-bg': 'oklch(0.76 0.13 76 / .20)',
    tank: 'oklch(0.52 0.14 255)',
    heal: 'oklch(0.54 0.13 150)',
    dps: 'oklch(0.55 0.18 27)',
    'tank-bg': 'oklch(0.52 0.14 255 / .12)',
    'heal-bg': 'oklch(0.54 0.13 150 / .12)',
    'dps-bg': 'oklch(0.55 0.18 27 / .11)',
    ok: 'oklch(0.50 0.12 160)',
    warn: 'oklch(0.55 0.14 55)',
    bad: 'oklch(0.53 0.19 20)',
    'ok-bg': 'oklch(0.50 0.12 160 / .12)',
    'warn-bg': 'oklch(0.62 0.14 60 / .16)',
    'bad-bg': 'oklch(0.53 0.19 20 / .11)',
    'c-druid': 'oklch(0.57 0.15 55)',
    'c-hunter': 'oklch(0.52 0.13 135)',
    'c-mage': 'oklch(0.52 0.12 228)',
    'c-paladin': 'oklch(0.54 0.16 350)',
    'c-priest': '#3f3b37',
    'c-rogue': 'oklch(0.55 0.12 95)',
    'c-warlock': 'oklch(0.48 0.16 300)',
    'c-warrior': 'oklch(0.50 0.07 60)',
    'c-shaman': 'oklch(0.48 0.14 250)',
  },
} as const satisfies Record<ColorScheme, Record<string, string>>;

export type TokenName = keyof (typeof tokens)['dark'];

/** A token as a CSS variable reference, e.g. token('sf2') → 'var(--sf2)'. */
export function token(name: TokenName): string {
  return `var(--${name})`;
}

export const fontFamily = "'Archivo Variable', Archivo, system-ui, sans-serif";

/** Below this width the sidebar becomes a top bar, as in the prototype. */
export const compactBreakpoint = 880;
