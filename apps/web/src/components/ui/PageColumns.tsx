import Box from '@mui/material/Box';
import type { ReactNode } from 'react';

import { token } from './tokens';

export interface PageColumnsProps {
  children: ReactNode;
  /** A narrow column on the right (below on narrow screens), with a heading. */
  aside: { title: string; content: ReactNode } | null;
}

/** A page's main content with a narrow column beside it, e.g. events and their series. */
export function PageColumns({ children, aside }: PageColumnsProps) {
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '32px', alignItems: 'flex-start' }}>
      <Box
        sx={{
          flex: '1 1 560px',
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        {children}
      </Box>
      {aside && (
        <Box
          component="aside"
          aria-label={aside.title}
          sx={{
            flex: '0 1 300px',
            minWidth: 240,
            display: 'flex',
            flexDirection: 'column',
            borderTop: `2px solid ${token('dv')}`,
          }}
        >
          <Box
            component="h2"
            sx={{
              m: 0,
              p: '12px 0',
              fontSize: 12,
              letterSpacing: '.08em',
              textTransform: 'uppercase',
              color: token('mt'),
              fontWeight: 700,
            }}
          >
            {aside.title}
          </Box>
          {aside.content}
        </Box>
      )}
    </Box>
  );
}
