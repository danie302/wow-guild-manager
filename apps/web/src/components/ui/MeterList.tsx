import Box from '@mui/material/Box';

import { token, type TokenName } from './tokens';

export interface MeterListItem {
  key: string;
  label: string;
  value: number;
  max: number;
  color: TokenName;
}

/** Small labelled bars with "value/max", e.g. how full each role of an event is. */
export function MeterList({ label, items }: { label: string; items: readonly MeterListItem[] }) {
  return (
    <Box
      role="list"
      aria-label={label}
      sx={{ display: 'flex', flexDirection: 'column', gap: '5px' }}
    >
      {items.map((item) => (
        <Box
          role="listitem"
          key={item.key}
          sx={{
            display: 'grid',
            gridTemplateColumns: 'minmax(72px, auto) 1fr 40px',
            alignItems: 'center',
            gap: 1,
            fontSize: 12,
          }}
        >
          <Box component="span" sx={{ color: token('mt') }}>
            {item.label}
          </Box>
          <Box component="span" sx={{ height: 5, bgcolor: token('ln'), display: 'block' }}>
            <Box
              component="span"
              sx={{
                display: 'block',
                height: 1,
                width: `${item.max > 0 ? Math.min(100, (item.value / item.max) * 100) : 0}%`,
                bgcolor: token(item.color),
              }}
            />
          </Box>
          <Box
            component="span"
            sx={{
              textAlign: 'right',
              fontWeight: 700,
              color: item.value < item.max ? token('warn') : token('tx'),
            }}
          >
            {item.value}/{item.max}
          </Box>
        </Box>
      ))}
    </Box>
  );
}
