import Box from '@mui/material/Box';
import { useId, type ChangeEvent } from 'react';

import { token } from './tokens';

export interface SelectProps {
  label: string;
  hideLabel?: boolean;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
  /** Shown as the first, empty choice while nothing is picked. */
  placeholder?: string;
  error?: string;
  disabled?: boolean;
}

/** A dropdown for short lists (for long ones, use ComboBox). */
export function Select({
  label,
  hideLabel,
  value,
  options,
  onChange,
  placeholder,
  error,
  disabled,
}: SelectProps) {
  const id = useId();
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
      <Box
        component="label"
        htmlFor={id}
        sx={hideLabel ? visuallyHidden : { fontSize: 12, color: token('mt') }}
      >
        {label}
      </Box>
      <Box
        component="select"
        id={id}
        value={value}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event: ChangeEvent<HTMLSelectElement>) => onChange(event.target.value)}
        sx={{
          minHeight: 38,
          p: '7px 10px',
          font: 'inherit',
          fontSize: 14,
          color: token('tx'),
          bgcolor: token('bg'),
          border: `1px solid ${error ? token('bad') : token('dv')}`,
          '&:focus-visible': { outline: `2px solid ${token('ac')}`, outlineOffset: 0 },
          '&:disabled': { color: token('mt'), bgcolor: token('sf') },
        }}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Box>
      {error && (
        <Box id={`${id}-error`} sx={{ fontSize: 13, color: token('bad') }}>
          {error}
        </Box>
      )}
    </Box>
  );
}

const visuallyHidden = {
  position: 'absolute',
  width: 1,
  height: 1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
} as const;
