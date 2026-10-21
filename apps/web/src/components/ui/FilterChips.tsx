import Box from '@mui/material/Box';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { controlRadius, token, type TokenName } from './tokens';

export interface FilterChipOption<Value extends string> {
  value: Value;
  label: string;
  /** A color token for a small square before the label, e.g. a class color ("c-mage"). */
  dot?: TokenName;
}

export interface FilterChipsProps<Value extends string> {
  /** Accessible name of the group. */
  label: string;
  value: Value;
  options: readonly FilterChipOption<Value>[];
  onChange: (value: Value) => void;
}

/** Pick one filter from a row of small buttons, e.g. a rank or a class. */
export function FilterChips<Value extends string>({
  label,
  value,
  options,
  onChange,
}: FilterChipsProps<Value>) {
  return (
    <ToggleButtonGroup
      exclusive
      aria-label={label}
      value={value}
      onChange={(_, next: Value | null) => next !== null && onChange(next)}
      sx={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}
    >
      {options.map((option) => (
        <ToggleButton
          key={option.value}
          value={option.value}
          disableRipple
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            m: '0 !important',
            p: '5px 12px',
            font: 'inherit',
            fontSize: 13,
            fontWeight: 600,
            lineHeight: 1.45,
            textTransform: 'none',
            borderRadius: `${controlRadius} !important`,
            border: `1px solid ${token('dv')} !important`,
            color: token('tx'),
            '&:hover': { bgcolor: token('sf2') },
            '&.Mui-selected, &.Mui-selected:hover': {
              bgcolor: token('tx'),
              color: token('bg'),
              borderColor: `${token('tx')} !important`,
            },
            '&.Mui-focusVisible': { outline: `2px solid ${token('ac')}`, outlineOffset: 2 },
          }}
        >
          {option.dot && (
            <Box component="span" sx={{ width: 8, height: 8, bgcolor: token(option.dot) }} />
          )}
          {option.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
