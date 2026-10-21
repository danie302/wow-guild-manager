import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import InputBase from '@mui/material/InputBase';
import { useId } from 'react';

import { controlRadius, token, type TokenName } from './tokens';

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
    borderRadius: 0,
    fontSize: 18,
    fontWeight: 700,
    '&:hover': { bgcolor: token('sf2') },
    '&.Mui-disabled': { color: token('tx'), opacity: 0.4 },
    '&.Mui-focusVisible': { outline: `2px solid ${token('ac')}`, outlineOffset: -2 },
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
      <Box
        sx={{
          display: 'flex',
          alignItems: 'stretch',
          border: `1px solid ${token('dv')}`,
          borderRadius: controlRadius,
          overflow: 'hidden',
        }}
      >
        <IconButton
          disableRipple
          aria-label={decreaseLabel}
          disabled={disabled || value <= min}
          onClick={() => onChange(clamp(value - 1))}
          sx={button}
        >
          −
        </IconButton>
        <InputBase
          id={id}
          inputProps={{ inputMode: 'numeric' }}
          value={String(value)}
          disabled={disabled}
          onChange={(event) => {
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
            '& input': { p: 0, textAlign: 'center' },
          }}
        />
        <IconButton
          disableRipple
          aria-label={increaseLabel}
          disabled={disabled || value >= max}
          onClick={() => onChange(clamp(value + 1))}
          sx={button}
        >
          +
        </IconButton>
      </Box>
    </Box>
  );
}
