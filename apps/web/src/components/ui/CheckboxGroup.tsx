import Box from '@mui/material/Box';
import { useId } from 'react';

import { token } from './tokens';

export interface CheckboxGroupProps {
  label: string;
  values: readonly string[];
  options: readonly { value: string; label: string }[];
  onChange: (values: string[]) => void;
  error?: string;
  hint?: string;
}

/** Pick any number of options, shown as a grid of checkboxes. */
export function CheckboxGroup({
  label,
  values,
  options,
  onChange,
  error,
  hint,
}: CheckboxGroupProps) {
  const id = useId();
  return (
    <Box
      component="fieldset"
      aria-describedby={error ? `${id}-error` : undefined}
      sx={{ m: 0, p: 0, border: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}
    >
      <Box component="legend" sx={{ p: 0, mb: '6px', fontSize: 12, color: token('mt') }}>
        {label}
      </Box>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: '4px 12px',
        }}
      >
        {options.map((option) => (
          <Box
            component="label"
            key={option.value}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            <Box
              component="input"
              type="checkbox"
              checked={values.includes(option.value)}
              onChange={() =>
                onChange(
                  values.includes(option.value)
                    ? values.filter((value) => value !== option.value)
                    : [...values, option.value],
                )
              }
              sx={{ accentColor: token('ac'), m: 0 }}
            />
            {option.label}
          </Box>
        ))}
      </Box>
      {(error ?? hint) && (
        <Box id={`${id}-error`} sx={{ fontSize: 13, color: error ? token('bad') : token('mt') }}>
          {error ?? hint}
        </Box>
      )}
    </Box>
  );
}
