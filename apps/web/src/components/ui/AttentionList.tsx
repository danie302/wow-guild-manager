import Box from '@mui/material/Box';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { Icon } from './Icon';
import { token } from './tokens';

export interface AttentionListProps {
  title: string;
  /** How many items need attention; shown in red or amber when there are any. */
  count: number;
  tone?: 'warn' | 'bad';
  /** Shown when there's nothing to do. */
  empty: string;
  children: ReactNode;
}

/**
 * Things that need someone's attention, each opening the page where it's handled, e.g. the
 * dashboard's lists.
 *
 * <AttentionList title="Events missing roles" count={2} empty="Nothing to fix.">
 *   <AttentionList.Item to="…" title="MC" detail="Tue 20:00">…chips…</AttentionList.Item>
 * </AttentionList>
 */
function AttentionListRoot({ title, count, tone = 'warn', empty, children }: AttentionListProps) {
  return (
    <Box
      component="section"
      aria-label={title}
      sx={{ display: 'flex', flexDirection: 'column', borderTop: `2px solid ${token('dv')}` }}
    >
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: '10px', py: 1.5 }}>
        <Box component="h2" sx={{ m: 0, fontSize: 15, fontWeight: 800, flex: 1 }}>
          {title}
        </Box>
        <Box
          component="span"
          sx={{ fontSize: 13, fontWeight: 800, color: token(count > 0 ? tone : 'mt') }}
        >
          {count}
        </Box>
      </Box>
      {count === 0 ? <Box sx={{ p: '10px 8px', color: token('mt') }}>{empty}</Box> : children}
    </Box>
  );
}

export interface AttentionListItemProps {
  to: string;
  title: ReactNode;
  detail?: ReactNode;
  /** Tags or a short note on the right. */
  children?: ReactNode;
}

function Item({ to, title, detail, children }: AttentionListItemProps) {
  return (
    <Box
      component={Link}
      to={to}
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '8px 12px',
        p: '10px 8px',
        color: token('tx'),
        textDecoration: 'none',
        borderBottom: `1px solid ${token('ln')}`,
        '&:hover': { bgcolor: token('sf') },
        '&:focus-visible': { outline: `2px solid ${token('ac')}`, outlineOffset: -2 },
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', flex: '1 1 180px', minWidth: 0 }}>
        <Box component="span" sx={{ fontWeight: 700 }}>
          {title}
        </Box>
        {detail && (
          <Box component="span" sx={{ fontSize: 12, color: token('mt') }}>
            {detail}
          </Box>
        )}
      </Box>
      {children && <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>{children}</Box>}
      <Box component="span" sx={{ color: token('mt'), display: 'flex' }}>
        <Icon name="chevronRight" size={14} />
      </Box>
    </Box>
  );
}

export const AttentionList = Object.assign(AttentionListRoot, { Item });
