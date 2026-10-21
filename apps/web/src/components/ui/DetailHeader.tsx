import Box from '@mui/material/Box';
import type { ReactNode } from 'react';

import { Button } from './Button';
import { token } from './tokens';

export interface DetailHeaderProps {
  back: { to: string; label: string };
  /** A small label before the facts, e.g. the event type. */
  badge: string;
  /** Short facts after the badge, e.g. "20 players · Every Thursday · 20:00". */
  facts: string;
  title: string;
  /** e.g. the date and time, in bold under the title. */
  when?: string;
  /** Muted lines under it, e.g. when Tentative sign-ups close. */
  details?: readonly string[];
  description?: string;
  /** Buttons on the right. */
  actions?: ReactNode;
  /** A strong red banner under it, e.g. that the event was cancelled. */
  banner?: { label: string; text: string };
}

/** The header of a page about one thing, such as an event. */
export function DetailHeader({
  back,
  badge,
  facts,
  title,
  when,
  details = [],
  description,
  actions,
  banner,
}: DetailHeaderProps) {
  return (
    <Box
      component="header"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        pb: '18px',
        borderBottom: `2px solid ${token('dv')}`,
      }}
    >
      <Button variant="text" startIcon="chevronLeft" to={back.to}>
        {back.label}
      </Button>
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 2,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            minWidth: 0,
            flex: '1 1 360px',
          }}
        >
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
            <Box
              component="span"
              sx={{
                fontSize: 11.5,
                fontWeight: 700,
                p: '2px 8px',
                bgcolor: token('sf2'),
                color: token('tx'),
              }}
            >
              {badge}
            </Box>
            <Box component="span" sx={{ fontSize: 12.5, color: token('mt') }}>
              {facts}
            </Box>
          </Box>
          <Box
            component="h1"
            sx={{ m: 0, fontSize: 32, fontWeight: 800, letterSpacing: '-.015em', lineHeight: 1.1 }}
          >
            {title}
          </Box>
          {when && <Box sx={{ fontSize: 15, fontWeight: 600 }}>{when}</Box>}
          {details.map((detail) => (
            <Box key={detail} sx={{ fontSize: 13, color: token('mt') }}>
              {detail}
            </Box>
          ))}
          {description && (
            <Box
              component="p"
              sx={{ m: '2px 0 0', color: token('mt'), maxWidth: 720, whiteSpace: 'pre-line' }}
            >
              {description}
            </Box>
          )}
        </Box>
        {actions && <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>{actions}</Box>}
      </Box>
      {banner && (
        <Box
          role="status"
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px 12px',
            alignItems: 'center',
            p: '12px 14px',
            bgcolor: token('bad-bg'),
            color: token('bad'),
          }}
        >
          <Box
            component="span"
            sx={{
              fontSize: 11.5,
              fontWeight: 800,
              letterSpacing: '.08em',
              textTransform: 'uppercase',
              p: '2px 8px',
              bgcolor: token('bad'),
              color: token('bg'),
            }}
          >
            {banner.label}
          </Box>
          <Box component="span" sx={{ fontWeight: 600 }}>
            {banner.text}
          </Box>
        </Box>
      )}
    </Box>
  );
}
