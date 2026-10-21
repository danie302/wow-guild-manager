import Chip from '@mui/material/Chip';
import type { ReactNode } from 'react';

import { token } from './tokens';

export interface TagProps {
  children: ReactNode;
  tone?: 'neutral' | 'accent' | 'warn' | 'bad';
}

/** A small label next to a name, e.g. "Main" or "Left Discord". */
export function Tag({ children, tone = 'neutral' }: TagProps) {
  const colors = {
    neutral: { bgcolor: token('sf2'), color: token('mt') },
    accent: { bgcolor: token('ac-bg'), color: token('ac-ink') },
    warn: { bgcolor: token('warn-bg'), color: token('warn') },
    bad: { bgcolor: token('bad-bg'), color: token('bad') },
  }[tone];
  return (
    <Chip
      component="span"
      size="small"
      label={children}
      sx={{
        ...colors,
        height: 'auto',
        borderRadius: 0,
        fontSize: 11.5,
        fontWeight: 700,
        verticalAlign: 'middle',
        '& .MuiChip-label': { p: '2px 8px', whiteSpace: 'nowrap' },
      }}
    />
  );
}
