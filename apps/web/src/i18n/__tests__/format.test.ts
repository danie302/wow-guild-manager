import { describe, expect, it } from 'vitest';

import { formatters } from '../format';
import '../index';

describe('relative times', () => {
  const now = Date.parse('2026-10-21T12:00:00Z');

  it('uses the largest unit that fits', () => {
    const en = formatters('en', 'UTC');

    expect(en.relative(now - 30 * 1000, now)).toBe('30 s ago');
    expect(en.relative(now - 5 * 60 * 1000, now)).toBe('5 min ago');
    expect(en.relative(now - 3 * 60 * 60 * 1000, now)).toBe('3 h ago');
    expect(en.relative(now - 2 * 24 * 60 * 60 * 1000, now)).toBe('2 d ago');
  });

  it('follows the language', () => {
    expect(formatters('es', 'UTC').relative(now - 3 * 60 * 60 * 1000, now)).toBe('hace 3 h');
  });
});
