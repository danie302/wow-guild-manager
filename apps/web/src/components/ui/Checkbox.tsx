import FormControlLabel from '@mui/material/FormControlLabel';
import MuiCheckbox from '@mui/material/Checkbox';

import { token } from './tokens';

export interface CheckboxProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/** One checkbox with its label, e.g. a filter like "Left Discord only". */
export function Checkbox({ label, checked, onChange }: CheckboxProps) {
  return (
    <FormControlLabel
      label={label}
      control={
        <MuiCheckbox
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          disableRipple
          size="small"
          sx={checkboxSx}
        />
      }
      sx={{ m: 0, gap: '8px', '& .MuiFormControlLabel-label': { font: 'inherit', fontSize: 13 } }}
    />
  );
}

/** Our checkbox look: a small square in the accent color when checked. */
export const checkboxSx = {
  p: 0,
  color: token('dv'),
  '&.Mui-checked': { color: token('ac') },
  '&.Mui-focusVisible': { outline: `2px solid ${token('ac')}`, outlineOffset: 1 },
  '& .MuiSvgIcon-root': { fontSize: 18 },
} as const;
