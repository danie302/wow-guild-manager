import Box from '@mui/material/Box';
import { Link } from 'react-router';

import { token } from './tokens';

export interface LinkCardProps {
  to: string;
  title: string;
  /** A muted line under the title. */
  detail?: string;
  /** A highlighted line at the end, e.g. "Next: Thu 15 Oct". */
  highlight?: string;
}

/** A small shaded card that opens a page, e.g. a recurring series. */
export function LinkCard({ to, title, detail, highlight }: LinkCardProps) {
  return (
    <Box
      component={Link}
      to={to}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: '3px',
        p: '12px',
        mb: '2px',
        bgcolor: token('sf'),
        color: token('tx'),
        textDecoration: 'none',
        '&:hover': { bgcolor: token('sf2') },
        '&:focus-visible': { outline: `2px solid ${token('ac')}`, outlineOffset: -2 },
      }}
    >
      <Box component="span" sx={{ fontWeight: 800 }}>
        {title}
      </Box>
      {detail && (
        <Box component="span" sx={{ fontSize: 12.5, color: token('mt') }}>
          {detail}
        </Box>
      )}
      {highlight && (
        <Box component="span" sx={{ fontSize: 12.5, fontWeight: 600, color: token('ac-ink') }}>
          {highlight}
        </Box>
      )}
    </Box>
  );
}
