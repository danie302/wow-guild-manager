import Box from '@mui/material/Box';

import { token, type TokenName } from './tokens';

export interface RateBarProps {
  /** From 0 to 1; null shows an empty bar. */
  value: number | null;
  /** e.g. "92 %", or "—" without a value. */
  label: string;
  color: TokenName;
  /** Thin lines at these points (0 to 1), e.g. the attendance band thresholds. */
  marks?: readonly number[];
}

/** A rate as a short bar with its figure, e.g. a member's attendance rate. */
export function RateBar({ value, label, color, marks = [] }: RateBarProps) {
  return (
    <Box
      sx={{ display: 'grid', gridTemplateColumns: '1fr 48px', alignItems: 'center', gap: '10px' }}
    >
      <Box aria-hidden sx={{ position: 'relative', height: 8, bgcolor: token('ln') }}>
        <Box sx={{ height: '100%', width: `${(value ?? 0) * 100}%`, bgcolor: token(color) }} />
        {marks.map((mark) => (
          <Box
            key={mark}
            sx={{
              position: 'absolute',
              top: -3,
              bottom: -3,
              left: `${mark * 100}%`,
              width: '1px',
              bgcolor: token('dv'),
            }}
          />
        ))}
      </Box>
      <Box component="span" sx={{ textAlign: 'right', fontWeight: 800, color: token(color) }}>
        {label}
      </Box>
    </Box>
  );
}
