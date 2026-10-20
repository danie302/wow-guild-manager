import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

import { i18n } from '../i18n';

// Tests start in English, whatever language jsdom reports or a previous test picked.
beforeEach(async () => {
  localStorage.clear();
  document.documentElement.setAttribute('data-theme', 'dark');
  await i18n.changeLanguage('en');
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
