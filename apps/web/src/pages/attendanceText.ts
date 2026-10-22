import type { AttendanceBand } from '@wgm/shared';

import type { useFormat } from '../i18n/format';

/** Each band's color: Good green, Watch amber, At risk red. */
export const BAND_COLOR: Record<AttendanceBand, 'ok' | 'warn' | 'bad'> = {
  good: 'ok',
  watch: 'warn',
  at_risk: 'bad',
};

/** A rate as a whole percentage ("92 %"), or "—" without records. */
export function rateText(format: ReturnType<typeof useFormat>, rate: number | null): string {
  return rate === null ? '—' : format.number(rate, { style: 'percent', maximumFractionDigits: 0 });
}
