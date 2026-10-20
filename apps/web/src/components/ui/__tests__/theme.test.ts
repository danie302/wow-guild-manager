import { describe, expect, it } from 'vitest';

import { theme } from '../theme';
import { tokens } from '../tokens';

describe('theme', () => {
  it('uses the design font and square corners', () => {
    expect(theme.typography.fontFamily).toContain('Archivo');
    expect(theme.shape.borderRadius).toBe(0);
  });

  it.each(['dark', 'light'] as const)('builds the %s palette from the design tokens', (scheme) => {
    const palette = theme.colorSchemes[scheme]?.palette;

    expect(palette?.background.default).toBe(tokens[scheme].bg);
    expect(palette?.background.paper).toBe(tokens[scheme].sf);
    expect(palette?.text.primary).toBe(tokens[scheme].tx);
    expect(palette?.primary.main).toBe(tokens[scheme].ac);
    expect(palette?.error.main).toBe(tokens[scheme].bad);
  });

  it('switches schemes with the data-theme attribute, dark by default', () => {
    expect(theme.defaultColorScheme).toBe('dark');
    expect(theme.getColorSchemeSelector('light')).toContain('[data-theme="light"]');
  });
});
