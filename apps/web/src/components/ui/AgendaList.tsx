import Box from '@mui/material/Box';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { token } from './tokens';

export interface AgendaListProps {
  /** Accessible name of the list. */
  label: string;
  children: ReactNode;
  /** Shown instead of the items when there are none. */
  empty?: string;
}

/**
 * Dated items that each open a page, e.g. events.
 *
 * <AgendaList label="Upcoming events" empty="No events.">
 *   <AgendaList.Item to="…" date={{ weekday: 'Tue', day: '10', month: 'Nov' }} title="MC">…</AgendaList.Item>
 * </AgendaList>
 */
function AgendaListRoot({ label, children, empty }: AgendaListProps) {
  return (
    <Box
      role="list"
      aria-label={label}
      sx={{ display: 'flex', flexDirection: 'column', borderTop: `2px solid ${token('dv')}` }}
    >
      {children}
      {empty && (
        <Box sx={{ p: '20px 8px', color: token('mt'), '&:not(:last-child)': { display: 'none' } }}>
          {empty}
        </Box>
      )}
    </Box>
  );
}

export interface AgendaListItemProps {
  to: string;
  /** The date block on the left, already formatted. */
  date: { weekday: string; day: string; month: string };
  title: string;
  /** Crossed out, e.g. a cancelled event. */
  struck?: boolean;
  /** A line under the title, e.g. "7:00 PM · Raid". */
  detail: ReactNode;
  /** Things on the right, e.g. the size and a "Cancelled" tag. */
  aside?: ReactNode;
}

function Item({ to, date, title, struck, detail, aside }: AgendaListItemProps) {
  return (
    <Box
      role="listitem"
      component={Link}
      to={to}
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '12px 20px',
        p: '14px 8px',
        color: token('tx'),
        textDecoration: 'none',
        borderBottom: `1px solid ${token('ln')}`,
        '&:hover': { bgcolor: token('sf') },
        '&:focus-visible': { outline: `2px solid ${token('ac')}`, outlineOffset: -2 },
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', width: 56, flex: 'none' }}>
        <Box component="span" sx={small}>
          {date.weekday}
        </Box>
        <Box component="span" sx={{ fontSize: 24, fontWeight: 800, lineHeight: 1 }}>
          {date.day}
        </Box>
        <Box component="span" sx={{ ...small, textTransform: 'none', letterSpacing: 0 }}>
          {date.month}
        </Box>
      </Box>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: '3px',
          flex: '1 1 200px',
          minWidth: 0,
        }}
      >
        <Box
          component="span"
          sx={{ fontSize: 16, fontWeight: 800, textDecoration: struck ? 'line-through' : 'none' }}
        >
          {title}
        </Box>
        <Box component="span" sx={{ fontSize: 12.5, color: token('mt') }}>
          {detail}
        </Box>
      </Box>
      {aside && (
        <Box
          sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}
        >
          {aside}
        </Box>
      )}
    </Box>
  );
}

const small = {
  fontSize: 11.5,
  color: token('mt'),
  textTransform: 'uppercase',
  letterSpacing: '.06em',
} as const;

export const AgendaList = Object.assign(AgendaListRoot, { Item });
