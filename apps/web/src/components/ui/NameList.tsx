import Box from '@mui/material/Box';
import type { ReactNode } from 'react';

import { token } from './tokens';

export interface NameListProps {
  /** e.g. "Declined (3)". */
  label: string;
  children: ReactNode;
}

/** A labeled line of names under a divider, e.g. the characters who declined an event. */
export function NameList({ label, children }: NameListProps) {
  return (
    <Box
      component="section"
      aria-label={label}
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '6px 12px',
        alignItems: 'baseline',
        pt: 1.5,
        borderTop: `2px solid ${token('dv')}`,
        fontSize: 13,
      }}
    >
      <Box
        component="span"
        sx={{
          fontSize: 11.5,
          letterSpacing: '.08em',
          textTransform: 'uppercase',
          color: token('mt'),
          fontWeight: 700,
        }}
      >
        {label}
      </Box>
      {children}
    </Box>
  );
}
