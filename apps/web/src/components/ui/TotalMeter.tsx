import Box from '@mui/material/Box';

import { token, type TokenName } from './tokens';

export interface TotalMeterProps {
  label: string;
  value: number;
  max: number;
  /** The parts of the value, each in its color, e.g. the slots of each combat role. */
  segments: readonly { key: string; value: number; color: TokenName }[];
  /** Says whether the value is right, under the bar. */
  message: string;
  tone: 'ok' | 'warn' | 'bad';
}

/** A total out of a maximum, e.g. "34 / 40", with a bar split into colored parts. */
export function TotalMeter({ label, value, max, segments, message, tone }: TotalMeterProps) {
  const scale = Math.max(value, max, 1);
  return (
    <Box role="group" aria-label={label} sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Box
        sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1.5 }}
      >
        <Box component="span" sx={{ fontSize: 12, color: token('mt') }}>
          {label}
        </Box>
        <Box component="span" sx={{ fontSize: 28, fontWeight: 800, lineHeight: 1 }}>
          <Box component="span" sx={{ color: token(tone) }}>
            {value}
          </Box>
          <Box component="span" sx={{ color: token('mt'), fontWeight: 600 }}>
            {' '}
            / {max}
          </Box>
        </Box>
      </Box>
      <Box aria-hidden sx={{ display: 'flex', height: 10, bgcolor: token('ln') }}>
        {segments.map((segment) => (
          <Box
            key={segment.key}
            component="span"
            sx={{
              height: 1,
              width: `${(segment.value / scale) * 100}%`,
              bgcolor: token(segment.color),
            }}
          />
        ))}
      </Box>
      <Box component="span" sx={{ fontSize: 13, fontWeight: 600, color: token(tone) }}>
        {message}
      </Box>
    </Box>
  );
}
