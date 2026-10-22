import Box from '@mui/material/Box';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { token } from './tokens';

/**
 * Cards side by side that each open a page, e.g. the next events on the dashboard.
 *
 * <TileGrid label="Upcoming events">
 *   <TileGrid.Card to="…" eyebrow="Tue 10 Nov · 20:00" title="MC" meta="Raid · 40 players"
 *     footer={…}>…</TileGrid.Card>
 * </TileGrid>
 */
function TileGridRoot({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box
      role="list"
      aria-label={label}
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
        gap: '2px',
      }}
    >
      {children}
    </Box>
  );
}

export interface TileGridCardProps {
  to: string;
  /** A small line over the title, e.g. the date. */
  eyebrow: string;
  title: string;
  /** Struck through, e.g. a cancelled event. */
  struck?: boolean;
  meta?: string;
  /** The card's body, e.g. how full each role is. */
  children?: ReactNode;
  /** A line at the bottom, under a divider. */
  footer?: ReactNode;
}

function Card({ to, eyebrow, title, struck, meta, children, footer }: TileGridCardProps) {
  return (
    <Box
      role="listitem"
      component={Link}
      to={to}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        p: 2,
        bgcolor: token('sf'),
        color: token('tx'),
        textDecoration: 'none',
        minWidth: 0,
        '&:hover': { bgcolor: token('sf2') },
        '&:focus-visible': { outline: `2px solid ${token('ac')}`, outlineOffset: -2 },
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        <Box sx={{ fontSize: 12, color: token('mt') }}>{eyebrow}</Box>
        <Box
          sx={{
            fontSize: 17,
            fontWeight: 800,
            lineHeight: 1.2,
            textDecoration: struck ? 'line-through' : 'none',
          }}
        >
          {title}
        </Box>
        {meta && <Box sx={{ fontSize: 12, color: token('mt') }}>{meta}</Box>}
      </Box>
      {children}
      {footer && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
            pt: '10px',
            borderTop: `1px solid ${token('ln')}`,
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          {footer}
        </Box>
      )}
    </Box>
  );
}

export const TileGrid = Object.assign(TileGridRoot, { Card });
