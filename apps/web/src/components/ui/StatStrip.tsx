import Box from '@mui/material/Box';

import { token, type TokenName } from './tokens';

export interface StatStripItem {
  key: string;
  label: string;
  /** The big value, e.g. "3/4". */
  value: string;
  /** A short note beside it, e.g. "Missing 1". */
  note?: string;
  noteTone?: 'ok' | 'warn' | 'bad' | 'muted';
  /** The color of the bar on top. */
  color: TokenName;
}

/** A row of small figures, each with a colored bar on top, e.g. how full each role is. */
export function StatStrip({ label, items }: { label: string; items: readonly StatStripItem[] }) {
  return (
    <Box
      role="list"
      aria-label={label}
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: '2px',
      }}
    >
      {items.map((item) => (
        <Box
          role="listitem"
          key={item.key}
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
            p: '14px 16px',
            bgcolor: token('sf'),
            boxShadow: `inset 0 3px 0 ${token(item.color)}`,
          }}
        >
          <Box component="span" sx={{ fontSize: 12, color: token('mt'), fontWeight: 600 }}>
            {item.label}
          </Box>
          <Box
            component="span"
            sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}
          >
            <Box component="span" sx={{ fontSize: 24, fontWeight: 800, lineHeight: 1 }}>
              {item.value}
            </Box>
            {item.note && (
              <Box
                component="span"
                sx={{
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: token(item.noteTone === 'muted' || !item.noteTone ? 'mt' : item.noteTone),
                }}
              >
                {item.note}
              </Box>
            )}
          </Box>
        </Box>
      ))}
    </Box>
  );
}
