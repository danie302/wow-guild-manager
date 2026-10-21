import Box from '@mui/material/Box';
import type { ReactNode } from 'react';

import { Icon, type IconName } from './Icon';
import { token } from './tokens';

/** A short accent line with an icon, e.g. "🔁 Every Thursday". */
export function IconLabel({ icon, children }: { icon: IconName; children: ReactNode }) {
  return (
    <Box
      component="span"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: '5px',
        fontSize: 12,
        color: token('ac-ink'),
      }}
    >
      <Icon name={icon} size={12} />
      {children}
    </Box>
  );
}
