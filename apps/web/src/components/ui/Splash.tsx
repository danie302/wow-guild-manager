import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';

import { token } from './tokens';

export interface SplashProps {
  /** One or two letters shown in the square badge. */
  initials: string;
  title: string;
  lead?: string;
  children: ReactNode;
}

/**
 * A full-screen page outside the app shell, like the login page.
 *
 * <Splash initials="GM" title="Guild Manager" lead="…">
 *   <Button variant="primary" size="large" href="…">Log in with Discord</Button>
 *   <Splash.Note>…</Splash.Note>
 * </Splash>
 */
function SplashRoot({ initials, title, lead, children }: SplashProps) {
  return (
    <Box
      component="main"
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        p: '48px clamp(24px, 9vw, 140px)',
        bgcolor: token('bg'),
        color: token('tx'),
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, maxWidth: 520 }}>
        <Box
          sx={{
            width: 40,
            height: 40,
            display: 'grid',
            placeItems: 'center',
            bgcolor: token('ac'),
            color: token('ac-on'),
            fontWeight: 800,
          }}
        >
          {initials}
        </Box>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
            pb: 3,
            borderBottom: `2px solid ${token('dv')}`,
          }}
        >
          <Typography
            variant="h1"
            sx={{ fontSize: 44, lineHeight: 1.05, fontWeight: 800, letterSpacing: '-.02em' }}
          >
            {title}
          </Typography>
          {lead && <Box sx={{ fontSize: 16, color: token('mt') }}>{lead}</Box>}
        </Box>
        {children}
      </Box>
    </Box>
  );
}

function Note({ children }: { children: ReactNode }) {
  return <Box sx={{ fontSize: 12.5, color: token('mt'), maxWidth: 420 }}>{children}</Box>;
}

function Actions({ children }: { children: ReactNode }) {
  return <Box sx={{ display: 'flex', alignSelf: 'flex-start' }}>{children}</Box>;
}

export const Splash = Object.assign(SplashRoot, { Note, Actions });
