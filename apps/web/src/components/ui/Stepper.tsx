import Box from '@mui/material/Box';
import { useId } from 'react';

import { token, type TokenName } from './tokens';

export interface StepperProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  decreaseLabel: string;
  increaseLabel: string;
  /** A color token for a small square before the label, e.g. a combat role ("tank"). */
  dot?: TokenName;
}

/** A whole number with − and + buttons, e.g. the slots of a combat role. */
export function Stepper({
  label,
  value,
  onChange,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  disabled,
  decreaseLabel,
  increaseLabel,
  dot,
}: StepperProps) {
  const id = useId();
  const clamp = (next: number) => Math.min(max, Math.max(min, next));
  const button = {
    width: 34,
    height: 34,
    bgcolor: 'transparent',
    color: token('tx'),
    border: 0,
    fontSize: 18,
    fontWeight: 700,
    cursor: 'pointer',
    '&:disabled': { opacity: 0.4, cursor: 'default' },
  };
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        p: '8px 0',
        borderBottom: `1px solid ${token('ln')}`,
      }}
    >
      {dot && (
        <Box component="span" sx={{ width: 10, height: 10, bgcolor: token(dot), flex: 'none' }} />
      )}
      <Box component="label" htmlFor={id} sx={{ flex: 1, fontWeight: 700 }}>
        {label}
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'stretch', border: `1px solid ${token('dv')}` }}>
        <Box
          component="button"
          type="button"
          aria-label={decreaseLabel}
          disabled={disabled || value <= min}
          onClick={() => onChange(clamp(value - 1))}
          sx={button}
        >
          −
        </Box>
        <Box
          component="input"
          id={id}
          inputMode="numeric"
          value={String(value)}
          disabled={disabled}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
            const next = Number(event.target.value.replace(/\D/g, '') || 0);
            onChange(clamp(next));
          }}
          sx={{
            width: 48,
            textAlign: 'center',
            bgcolor: token('bg'),
            color: token('tx'),
            border: 0,
            borderLeft: `1px solid ${token('dv')}`,
            borderRight: `1px solid ${token('dv')}`,
            font: 'inherit',
            fontSize: 15,
            fontWeight: 800,
          }}
        />
        <Box
          component="button"
          type="button"
          aria-label={increaseLabel}
          disabled={disabled || value >= max}
          onClick={() => onChange(clamp(value + 1))}
          sx={button}
        >
          +
        </Box>
      </Box>
    </Box>
  );
}
