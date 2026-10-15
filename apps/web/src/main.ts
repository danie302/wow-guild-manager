import { SUPPORTED_LOCALES } from '@wgm/shared';

// Placeholder until the React app is added (story 006). It shows no translatable text.
const root = document.getElementById('root');
if (root) {
  root.textContent = SUPPORTED_LOCALES.join(' / ');
}
