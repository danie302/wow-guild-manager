import Box from '@mui/material/Box';
import type { ReactNode } from 'react';

import { token } from './tokens';

/** A shaded box for one item, e.g. a character or a note; its children wrap side by side. */
export function Card({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <Box
      role={label ? 'group' : undefined}
      aria-label={label}
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '6px 16px',
        alignItems: 'center',
        p: '12px 14px',
        bgcolor: token('sf'),
      }}
    >
      {children}
    </Box>
  );
}

/** A column inside a card, e.g. a name with a line under it. */
function Column({ children, grow = 1 }: { children: ReactNode; grow?: number }) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
        flex: `${grow} 1 140px`,
        minWidth: 0,
      }}
    >
      {children}
    </Box>
  );
}

Card.Column = Column;
