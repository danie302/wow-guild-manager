import Box from '@mui/material/Box';
import type { ReactNode } from 'react';

import { token } from './tokens';

/**
 * Labeled values, one per row.
 *
 * <DetailList>
 *   <DetailList.Item label="Faction">Alliance</DetailList.Item>
 * </DetailList>
 */
function DetailListRoot({ children }: { children: ReactNode }) {
  return (
    <Box
      component="dl"
      sx={{
        m: 0,
        display: 'grid',
        gridTemplateColumns: 'minmax(120px, max-content) 1fr',
        maxWidth: 560,
      }}
    >
      {children}
    </Box>
  );
}

export interface DetailListItemProps {
  label: string;
  children: ReactNode;
}

function Item({ label, children }: DetailListItemProps) {
  const row = { py: '10px', borderBottom: `1px solid ${token('ln')}` };
  return (
    <>
      <Box component="dt" sx={{ ...row, pr: 3, color: token('mt') }}>
        {label}
      </Box>
      <Box component="dd" sx={{ ...row, m: 0, fontWeight: 600 }}>
        {children}
      </Box>
    </>
  );
}

export const DetailList = Object.assign(DetailListRoot, { Item });
