import Box from '@mui/material/Box';

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
    <Box
      role="tablist"
      aria-label={label}
      sx={{ display: 'flex', flexWrap: 'wrap', borderBottom: `2px solid ${token('dv')}` }}
    >
      {tabs.map((tab) => {
        const selected = tab.value === value;
        return (
          <Box
            key={tab.value}
            component="button"
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.value)}
            sx={{
              p: '10px 16px',
              mb: '-2px',
              font: 'inherit',
              fontWeight: 700,
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              bgcolor: 'transparent',
              border: 0,
              borderBottom: `3px solid ${selected ? token('ac') : 'transparent'}`,
              color: selected ? token('tx') : token('mt'),
              '&:hover': { color: token('tx') },
            }}
          >
            {tab.label}
          </Box>
        );
      })}
    </Box>
  );
}
