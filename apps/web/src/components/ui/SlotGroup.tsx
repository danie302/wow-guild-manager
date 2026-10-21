import Box from '@mui/material/Box';
import type { ReactNode } from 'react';

import { token, type TokenName } from './tokens';

export interface SlotGroupProps {
  title: string;
  /** e.g. "3/4 filled". */
  count: string;
  tag?: { label: string; tone: 'ok' | 'warn' };
  color: TokenName;
  /** Its rows: people in it, then open slots. */
  children: ReactNode;
}

/** A group of numbered slots under a colored heading, e.g. the Tanks of an event. */
function SlotGroupRoot({ title, count, tag, color, children }: SlotGroupProps) {
  return (
    <Box component="section" aria-label={title} sx={{ display: 'flex', flexDirection: 'column' }}>
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 1.5,
          pb: '10px',
          borderBottom: `2px solid ${token(color)}`,
        }}
      >
        <Box component="span" sx={{ width: 12, height: 12, bgcolor: token(color), flex: 'none' }} />
        <Box component="h2" sx={{ m: 0, fontSize: 19, fontWeight: 800 }}>
          {title}
        </Box>
        <Box component="span" sx={{ fontSize: 15, fontWeight: 800 }}>
          {count}
        </Box>
        {tag && (
          <Box
            component="span"
            sx={{
              fontSize: 12,
              fontWeight: 700,
              p: '2px 8px',
              bgcolor: token(tag.tone === 'ok' ? 'ok-bg' : 'warn-bg'),
              color: token(tag.tone),
            }}
          >
            {tag.label}
          </Box>
        )}
      </Box>
      {children}
    </Box>
  );
}

/** A numbered row, e.g. an open slot. */
function Row({ number, children }: { number: number; children: ReactNode }) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '4px 14px',
        p: '5px 8px',
        minHeight: 40,
        borderBottom: `1px solid ${token('ln')}`,
      }}
    >
      <Box component="span" sx={{ fontSize: 12, color: token('mt'), width: 22, flex: 'none' }}>
        {number}
      </Box>
      {children}
    </Box>
  );
}

/** An open slot: dashed, with a hint such as "No one on the waitlist". */
function OpenRow({ number, label, hint }: { number: number; label: string; hint?: string }) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '6px 12px',
        p: '5px 8px',
        minHeight: 40,
        mt: '4px',
        border: `1px dashed ${token('dv')}`,
      }}
    >
      <Box component="span" sx={{ fontSize: 12, color: token('mt'), width: 22, flex: 'none' }}>
        {number}
      </Box>
      <Box
        component="span"
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '4px 10px',
          alignItems: 'baseline',
          flex: '1 1 220px',
        }}
      >
        <Box component="span" sx={{ fontWeight: 700, color: token('warn') }}>
          {label}
        </Box>
        {hint && (
          <Box component="span" sx={{ fontSize: 12.5, color: token('mt') }}>
            {hint}
          </Box>
        )}
      </Box>
    </Box>
  );
}

export const SlotGroup = Object.assign(SlotGroupRoot, { Row, OpenRow });
