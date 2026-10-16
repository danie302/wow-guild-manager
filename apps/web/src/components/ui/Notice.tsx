import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import type { ReactNode } from 'react';

import { token } from './tokens';

export interface NoticeProps {
  tone: 'bad' | 'warn' | 'ok';
  title: string;
  children?: ReactNode;
}

/** A tinted message block, e.g. for an error state. */
export function Notice({ tone, title, children }: NoticeProps) {
  return (
    <Box
      role={tone === 'bad' ? 'alert' : 'status'}
      sx={{
        p: '14px 16px',
        bgcolor: token(`${tone}-bg`),
        borderLeft: `2px solid ${token(tone)}`,
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
      }}
    >
      <Box sx={{ fontWeight: 700 }}>{title}</Box>
      {children && <Box sx={{ color: token('mt') }}>{children}</Box>}
    </Box>
  );
}

export interface LoadingProps {
  /** Accessible description of what is loading. */
  label: string;
}

export function Loading({ label }: LoadingProps) {
  return (
    <Box role="status" aria-label={label} sx={{ display: 'flex', p: 2 }}>
      <CircularProgress size={20} sx={{ color: token('ac') }} />
    </Box>
  );
}
