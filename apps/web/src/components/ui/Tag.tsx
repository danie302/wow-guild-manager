import Box from '@mui/material/Box';
import type { ReactNode } from 'react';

import { token } from './tokens';

export interface TagProps {
  children: ReactNode;
  tone?: 'neutral' | 'accent' | 'warn';
}

/** A small label next to a name, e.g. "Main" or "Left Discord". */
export function Tag({ children, tone = 'neutral' }: TagProps) {
  const colors = {
    neutral: { bgcolor: token('sf2'), color: token('mt') },
    accent: { bgcolor: token('ac-bg'), color: token('ac-ink') },
    warn: { bgcolor: token('warn-bg'), color: token('warn') },
  }[tone];
  return (
    <Box
      component="span"
      sx={{ ...colors, fontSize: 11.5, fontWeight: 700, p: '2px 8px', whiteSpace: 'nowrap' }}
    >
      {children}
    </Box>
  );
}
