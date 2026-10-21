import MuiTab from '@mui/material/Tab';
import MuiTabs from '@mui/material/Tabs';

import { token } from './tokens';

export interface TabsProps<Value extends string> {
  label: string;
  value: Value;
  tabs: readonly { value: Value; label: string }[];
  onChange: (value: Value) => void;
}

/** Tabs that switch what a page shows below them. */
export function Tabs<Value extends string>({ label, value, tabs, onChange }: TabsProps<Value>) {
  return (
    <MuiTabs
      aria-label={label}
      value={value}
      onChange={(_, next: Value) => onChange(next)}
      variant="scrollable"
      scrollButtons={false}
      slotProps={{ indicator: { sx: { height: 3, bgcolor: token('ac') } } }}
      sx={{ minHeight: 0, borderBottom: `2px solid ${token('dv')}` }}
    >
      {tabs.map((tab) => (
        <MuiTab
          key={tab.value}
          value={tab.value}
          label={tab.label}
          disableRipple
          sx={{
            minHeight: 0,
            minWidth: 0,
            p: '10px 16px',
            font: 'inherit',
            fontWeight: 700,
            textTransform: 'none',
            color: token('mt'),
            '&:hover': { color: token('tx') },
            '&.Mui-selected': { color: token('tx') },
            '&.Mui-focusVisible': { outline: `2px solid ${token('ac')}`, outlineOffset: -2 },
          }}
        />
      ))}
    </MuiTabs>
  );
}
