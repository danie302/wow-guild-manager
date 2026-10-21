import Box from '@mui/material/Box';
import type { ReactNode } from 'react';

import { token } from './tokens';

export interface FormColumnsProps {
  /** The main fields, on the left. */
  children: ReactNode;
  /** A panel on the right (below on narrow screens), e.g. the size and slots of an event. */
  panel: ReactNode;
}

/** A form in two columns: its fields, and a shaded panel beside them. */
export function FormColumns({ children, panel }: FormColumnsProps) {
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '32px', alignItems: 'flex-start' }}>
      <Box
        sx={{
          flex: '1 1 420px',
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
        }}
      >
        {children}
      </Box>
      <Box
        sx={{
          flex: '1 1 360px',
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
          p: '20px',
          bgcolor: token('sf'),
        }}
      >
        {panel}
      </Box>
    </Box>
  );
}
