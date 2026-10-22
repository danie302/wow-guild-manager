import Box from '@mui/material/Box';
import type { ReactNode } from 'react';

import { token } from './tokens';

/**
 * Actions that can't be undone, under a red heading at the end of a settings page.
 *
 * <DangerZone title="Danger zone" description="…">
 *   <DangerZone.Action title="Disband guild" description="…"><Button …/></DangerZone.Action>
 * </DangerZone>
 */
function DangerZoneRoot({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Box
      component="section"
      aria-label={title}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        pt: 3,
        borderTop: `2px solid ${token('dv')}`,
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <Box component="h2" sx={{ m: 0, fontSize: 15, fontWeight: 800, color: token('bad') }}>
          {title}
        </Box>
        <Box component="span" sx={{ fontSize: 12.5, color: token('mt') }}>
          {description}
        </Box>
      </Box>
      {children}
    </Box>
  );
}

/** One action: what it does on the left, its controls on the right. */
function Action({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '16px 24px',
        alignItems: 'flex-end',
        p: 2,
        bgcolor: token('sf'),
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          flex: '1 1 260px',
          minWidth: 0,
        }}
      >
        <Box component="span" sx={{ fontWeight: 800 }}>
          {title}
        </Box>
        <Box component="span" sx={{ fontSize: 13, color: token('mt') }}>
          {description}
        </Box>
      </Box>
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 1,
          alignItems: 'flex-end',
          justifyContent: 'flex-end',
          flex: '1 1 320px',
          minWidth: 0,
          '& > :first-of-type:not(:last-child)': { flex: '1 1 200px' },
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

export const DangerZone = Object.assign(DangerZoneRoot, { Action });
