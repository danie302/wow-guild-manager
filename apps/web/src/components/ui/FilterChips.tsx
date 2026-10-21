import Box from '@mui/material/Box';

import { token, type TokenName } from './tokens';

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
    <Box
      role="radiogroup"
      aria-label={label}
      sx={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Box
            key={option.value}
            component="button"
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              p: '5px 12px',
              font: 'inherit',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              bgcolor: selected ? token('tx') : 'transparent',
              color: selected ? token('bg') : token('tx'),
              border: `1px solid ${selected ? token('tx') : token('dv')}`,
              '&:hover': { bgcolor: selected ? token('tx') : token('sf2') },
              '&:focus-visible': { outline: `2px solid ${token('ac')}`, outlineOffset: 2 },
            }}
          >
            {option.dot && (
              <Box component="span" sx={{ width: 8, height: 8, bgcolor: token(option.dot) }} />
            )}
            {option.label}
          </Box>
        );
      })}
    </Box>
  );
}
