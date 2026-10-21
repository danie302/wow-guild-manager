import Box from '@mui/material/Box';
import { useId, type ChangeEvent } from 'react';

import { token } from './tokens';

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
}: TextFieldProps) {
  const id = useId();
  const message = error ?? hint;
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        maxWidth: wide ? 'none' : 420,
        ...(width && { width: `min(${width}px, 100%)` }),
      }}
    >
      <Box
        component="label"
        htmlFor={id}
        sx={hideLabel ? visuallyHidden : { fontSize: 12, color: token('mt') }}
      >
        {label}
      </Box>
      <Box
        component={multiline ? 'textarea' : 'input'}
        id={id}
        {...(multiline ? { rows: 3 } : { type })}
        placeholder={placeholder}
        value={value}
        onChange={(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
          onChange(event.target.value)
        }
        maxLength={maxLength}
        autoFocus={autoFocus}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={message ? `${id}-message` : undefined}
        sx={{
          minHeight: 38,
          p: '7px 10px',
          font: 'inherit',
          fontSize: 14,
          resize: 'vertical',
          color: token('tx'),
          bgcolor: token('bg'),
          border: `1px solid ${error ? token('bad') : token('dv')}`,
          '&:focus-visible': { outline: `2px solid ${token('ac')}`, outlineOffset: 0 },
          '&:disabled': { color: token('mt'), bgcolor: token('sf') },
        }}
      />
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
