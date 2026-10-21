import Box from '@mui/material/Box';
import { useId } from 'react';

import { token } from './tokens';

export interface StepperProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  decreaseLabel: string;
  increaseLabel: string;
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
}: StepperProps) {
  const id = useId();
  const clamp = (next: number) => Math.min(max, Math.max(min, next));
  const button = {
    width: 32,
    height: 32,
    bgcolor: 'transparent',
    color: token('tx'),
    border: `1px solid ${token('dv')}`,
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer',
    '&:disabled': { opacity: 0.4, cursor: 'default' },
  };
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
      <Box component="label" htmlFor={id} sx={{ fontWeight: 700 }}>
        {label}
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
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
            height: 32,
            textAlign: 'center',
            bgcolor: token('bg'),
            color: token('tx'),
            border: `1px solid ${token('dv')}`,
            borderLeft: 0,
            borderRight: 0,
            font: 'inherit',
            fontWeight: 700,
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
