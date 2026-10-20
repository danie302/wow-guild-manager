import Box from '@mui/material/Box';
import { useId } from 'react';

import { token } from './tokens';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  /** Accessible name. Shown above the field unless `hideLabel` is set. */
  label: string;
  hideLabel?: boolean;
  value: string;
  options: readonly SelectOption[];
  onChange: (value: string) => void;
  /** Help text under the field. */
  hint?: string;
}

/** A dropdown, using the browser's own list so long lists can be searched by typing. */
export function Select({ label, hideLabel, value, options, onChange, hint }: SelectProps) {
  const id = useId();
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0 }}>
      <Box
        component="label"
        htmlFor={id}
        sx={
          hideLabel
            ? {
                position: 'absolute',
                width: 1,
                height: 1,
                overflow: 'hidden',
                clip: 'rect(0 0 0 0)',
              }
            : { fontWeight: 700 }
        }
      >
        {label}
      </Box>
      <Box
        component="select"
        id={id}
        value={value}
        onChange={(event: React.ChangeEvent<HTMLSelectElement>) => onChange(event.target.value)}
        aria-describedby={hint ? `${id}-hint` : undefined}
        sx={{
          minHeight: 38,
          p: '7px 10px',
          font: 'inherit',
          fontSize: 14,
          color: token('tx'),
          bgcolor: token('sf'),
          border: `1px solid ${token('dv')}`,
          borderRadius: 0,
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Box>
      {hint && (
        <Box id={`${id}-hint`} sx={{ fontSize: 13, color: token('mt') }}>
          {hint}
        </Box>
      )}
    </Box>
  );
}
