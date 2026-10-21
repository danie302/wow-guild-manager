import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { Icon } from './Icon';

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

/** A stack of `Splash.Choice` or `Splash.Card` rows. */
function List({ children }: { children: ReactNode }) {
  return <Box sx={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>{children}</Box>;
}

export interface SplashChoiceProps {
  /** Where the row leads, inside the app. */
  to: string;
  /** One or two letters in the square badge. */
  initials: string;
  title: string;
  detail?: string;
}

/** A row that opens something, e.g. one guild in a guild picker. */
function Choice({ to, initials, title, detail }: SplashChoiceProps) {
  return (
    <Box
      component={Link}
      to={to}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        p: '14px 16px',
        bgcolor: token('sf'),
        color: token('tx'),
        textDecoration: 'none',
        '&:hover': { bgcolor: token('sf2') },
        '&:focus-visible': { outline: `2px solid ${token('ac')}`, outlineOffset: 2 },
      }}
    >
      <Box
        aria-hidden
        sx={{
          width: 36,
          height: 36,
          flex: 'none',
          display: 'grid',
          placeItems: 'center',
          fontWeight: 800,
          fontSize: 13,
          bgcolor: token('ac'),
          color: token('ac-on'),
        }}
      >
        {initials}
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
        <Box component="span" sx={{ fontWeight: 800, fontSize: 16 }}>
          {title}
        </Box>
        {detail && (
          <Box component="span" sx={{ fontSize: 12.5, color: token('mt') }}>
            {detail}
          </Box>
        )}
      </Box>
      <Box sx={{ color: token('mt'), display: 'flex' }}>
        <Icon name="arrowRight" />
      </Box>
    </Box>
  );
}

export interface SplashCardProps {
  title: string;
  children: ReactNode;
  /** A button on the right, e.g. "Create a new guild". */
  action?: ReactNode;
}

/** A row of explanation, optionally with an action. */
function Card({ title, children, action }: SplashCardProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '10px 16px',
        p: '12px 14px',
        bgcolor: token('sf'),
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: '1 1 240px' }}>
        <Box component="span" sx={{ fontWeight: 700 }}>
          {title}
        </Box>
        <Box component="span" sx={{ fontSize: 13, color: token('mt') }}>
          {children}
        </Box>
      </Box>
      {action}
    </Box>
  );
}

function Note({ children }: { children: ReactNode }) {
  return <Box sx={{ fontSize: 12.5, color: token('mt'), maxWidth: 420 }}>{children}</Box>;
}

function Actions({ children }: { children: ReactNode }) {
  return <Box sx={{ display: 'flex', alignSelf: 'flex-start' }}>{children}</Box>;
}

export const Splash = Object.assign(SplashRoot, { Note, Actions, List, Choice, Card });
