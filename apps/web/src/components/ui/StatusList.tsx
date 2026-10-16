import Box from '@mui/material/Box';
import type { ReactNode } from 'react';

import { token } from './tokens';

export type Tone = 'ok' | 'warn' | 'bad' | 'muted';

/**
 * A list of named statuses, each with a colored marker.
 *
 * <StatusList>
 *   <StatusList.Item label="Database" tone="ok">Up</StatusList.Item>
 * </StatusList>
 */
function StatusListRoot({ children }: { children: ReactNode }) {
  return (
    <Box component="dl" sx={{ m: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
      {children}
    </Box>
  );
}

export interface StatusListItemProps {
  label: string;
  tone: Tone;
  /** The status text, e.g. "Up". */
  children: ReactNode;
}

function Item({ label, tone, children }: StatusListItemProps) {
  const color = tone === 'muted' ? token('mt') : token(tone);
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 2,
        p: '12px 16px',
        bgcolor: token('sf'),
      }}
    >
      <Box component="dt" sx={{ fontWeight: 700 }}>
        {label}
      </Box>
      <Box
        component="dd"
        data-tone={tone}
        sx={{ m: 0, display: 'flex', alignItems: 'center', gap: '8px', color, fontWeight: 700 }}
      >
        <Box component="span" sx={{ width: 8, height: 8, bgcolor: color, flex: 'none' }} />
        {children}
      </Box>
    </Box>
  );
}

export const StatusList = Object.assign(StatusListRoot, { Item });
