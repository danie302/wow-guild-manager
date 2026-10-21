import Box from '@mui/material/Box';

import { token } from './tokens';

export interface CheckboxProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/** One checkbox with its label, e.g. a filter like "Left Discord only". */
export function Checkbox({ label, checked, onChange }: CheckboxProps) {
  return (
    <Box
      component="label"
      sx={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: 13, cursor: 'pointer' }}
    >
      <Box
        component="input"
        type="checkbox"
        checked={checked}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => onChange(event.target.checked)}
        sx={{ accentColor: token('ac'), m: 0 }}
      />
      {label}
    </Box>
  );
}
