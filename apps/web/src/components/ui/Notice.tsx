import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
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
    <Alert
      severity={tone === 'bad' ? 'error' : tone === 'warn' ? 'warning' : 'success'}
      role={tone === 'bad' ? 'alert' : 'status'}
      icon={false}
      sx={{
        p: '14px 16px',
        borderRadius: 0,
        bgcolor: token(`${tone}-bg`),
        color: token('tx'),
        borderLeft: `2px solid ${token(tone)}`,
        font: 'inherit',
        '& .MuiAlert-message': { p: 0, display: 'flex', flexDirection: 'column', gap: '4px' },
      }}
    >
      <AlertTitle sx={{ m: 0, font: 'inherit', fontWeight: 700 }}>{title}</AlertTitle>
      {children && <Box sx={{ color: token('mt') }}>{children}</Box>}
    </Alert>
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
