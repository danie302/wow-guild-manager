import Box from '@mui/material/Box';

import { token } from './tokens';

export interface MarkerListItem {
  key: string;
  label: string;
  /** Muted text on the right, e.g. "3 December 2025 · by Morwenna". */
  detail: string;
  /** Marks the item with the accent color, e.g. the current rank. */
  highlight?: boolean;
}

/** Rows with a small square, a bold label, and a detail on the right, e.g. a rank history. */
export function MarkerList({ label, items }: { label: string; items: readonly MarkerListItem[] }) {
  return (
    <Box role="list" aria-label={label} sx={{ display: 'flex', flexDirection: 'column' }}>
      {items.map((item) => (
        <Box
          role="listitem"
          key={item.key}
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '4px 12px',
            alignItems: 'center',
            p: '10px 0',
            borderBottom: `1px solid ${token('ln')}`,
          }}
        >
          <Box
            component="span"
            sx={{
              width: 10,
              height: 10,
              flex: 'none',
              bgcolor: token(item.highlight ? 'ac' : 'dv'),
            }}
          />
          <Box component="span" sx={{ fontWeight: 700, flex: 1 }}>
            {item.label}
          </Box>
          <Box component="span" sx={{ fontSize: 12.5, color: token('mt') }}>
            {item.detail}
          </Box>
        </Box>
      ))}
    </Box>
  );
}
