import Box from '@mui/material/Box';
import InputBase from '@mui/material/InputBase';
import { useId } from 'react';

import { controlRadius, token } from './tokens';

export interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Shown under the field in red, and marks the field as invalid. */
  error?: string;
  /** Help text under the field, when there's no error. */
  hint?: string;
  maxLength?: number;
  autoFocus?: boolean;
  disabled?: boolean;
  placeholder?: string;
  /** Hide the label when the page already shows what the field is for, e.g. a search box. */
  hideLabel?: boolean;
  /** Several lines, e.g. a note. */
  multiline?: boolean;
  type?: 'text' | 'number' | 'search' | 'date' | 'time';
  /** A fixed width in pixels (never wider than its container), e.g. a search box in a header. */
  width?: number;
  /** Fills its container instead of stopping at a readable width. */
  wide?: boolean;
  /** Text right after the input, e.g. "hours before the event"; `width` is then the input's. */
  unit?: string;
}

/** A one-line text input with its label above it. */
export function TextField({
  label,
  value,
  onChange,
  error,
  hint,
  maxLength,
  autoFocus,
  disabled,
  placeholder,
  hideLabel,
  multiline,
  type = 'text',
  width,
  wide,
  unit,
}: TextFieldProps) {
  const id = useId();
  const message = error ?? hint;
  const input = (
    <InputBase
      id={id}
      type={multiline ? undefined : type}
      multiline={multiline}
      minRows={multiline ? 3 : undefined}
      placeholder={placeholder}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      autoFocus={autoFocus}
      disabled={disabled}
      error={Boolean(error)}
      inputProps={{
        maxLength,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': message ? `${id}-message` : undefined,
      }}
      sx={{
        minHeight: 38,
        p: '7px 10px',
        font: 'inherit',
        fontSize: 14,
        color: token('tx'),
        bgcolor: token('bg'),
        border: `1px solid ${error ? token('bad') : token('dv')}`,
        borderRadius: controlRadius,
        '&.Mui-focused': { outline: `2px solid ${token('ac')}`, outlineOffset: 0 },
        '&.Mui-disabled': { bgcolor: token('sf') },
        '& .MuiInputBase-input': { p: 0, height: 'auto' },
        '& textarea': { resize: 'vertical' },
        ...(width && unit && { width: `min(${width}px, 100%)`, flex: 'none' }),
      }}
    />
  );
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        maxWidth: wide ? 'none' : 420,
        ...(width && !unit && { width: `min(${width}px, 100%)` }),
      }}
    >
      <Box
        component="label"
        htmlFor={id}
        sx={hideLabel ? visuallyHidden : { fontSize: 12, color: token('mt') }}
      >
        {label}
      </Box>
      {unit ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {input}
          <Box component="span" sx={{ fontSize: 13, color: token('mt') }}>
            {unit}
          </Box>
        </Box>
      ) : (
        input
      )}
      {message && (
        <Box id={`${id}-message`} sx={{ fontSize: 13, color: error ? token('bad') : token('mt') }}>
          {message}
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
