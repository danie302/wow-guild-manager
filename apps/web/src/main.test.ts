import { beforeEach, describe, expect, it } from 'vitest';

describe('placeholder page', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>';
  });

  it('renders the supported locales from the shared package', async () => {
    await import('./main.js');

    expect(document.getElementById('root')?.textContent).toBe('en / es');
  });
});
