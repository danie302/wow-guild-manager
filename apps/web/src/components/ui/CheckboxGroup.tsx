import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import FormHelperText from '@mui/material/FormHelperText';
import FormLabel from '@mui/material/FormLabel';
import MuiCheckbox from '@mui/material/Checkbox';
import { useId } from 'react';

import { checkboxSx } from './Checkbox';
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
  const toggle = (value: string) =>
    onChange(values.includes(value) ? values.filter((v) => v !== value) : [...values, value]);
  return (
    <FormControl
      component="fieldset"
      error={Boolean(error)}
      aria-describedby={(error ?? hint) ? `${id}-message` : undefined}
      sx={{ display: 'flex', flexDirection: 'column', gap: '6px' }}
    >
      <FormLabel
        component="legend"
        sx={{
          p: 0,
          mb: '6px',
          fontSize: 12,
          color: token('mt'),
          '&.Mui-focused': { color: token('mt') },
        }}
      >
        {label}
      </FormLabel>
      <FormGroup
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: '4px 12px',
        }}
      >
        {options.map((option) => (
          <FormControlLabel
            key={option.value}
            label={option.label}
            control={
              <MuiCheckbox
                checked={values.includes(option.value)}
                onChange={() => toggle(option.value)}
                disableRipple
                size="small"
                sx={checkboxSx}
              />
            }
            sx={{
              m: 0,
              gap: '8px',
              '& .MuiFormControlLabel-label': { font: 'inherit', fontSize: 14 },
            }}
          />
        ))}
      </FormGroup>
      {(error ?? hint) && (
        <FormHelperText
          id={`${id}-message`}
          sx={{ m: 0, font: 'inherit', fontSize: 13, color: error ? token('bad') : token('mt') }}
        >
          {error ?? hint}
        </FormHelperText>
      )}
    </FormControl>
  );
}
