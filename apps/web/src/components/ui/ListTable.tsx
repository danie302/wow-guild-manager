import Box from '@mui/material/Box';
import { createContext, useContext, type ReactNode } from 'react';
import { Link } from 'react-router';

import { compactBreakpoint, token } from './tokens';

const ColumnsContext = createContext<string>('1fr');

export interface ListTableProps {
  /** Accessible name of the list. */
  label: string;
  /** Column headings. */
  columns: readonly string[];
  /** CSS grid widths of the columns, e.g. ["2fr", "1fr"]. */
  widths: readonly string[];
  children: ReactNode;
  /** Shown instead of the rows when there are none. */
  empty?: string;
}

/**
 * A list of rows that each open something, laid out as a table on wide screens.
 *
 * <ListTable label="Roster" columns={['Discord', 'Rank']} widths={['2fr', '1fr']}>
 *   <ListTable.Row to="/…"><span>…</span><span>…</span></ListTable.Row>
 * </ListTable>
 */
function ListTableRoot({ label, columns, widths, children, empty }: ListTableProps) {
  const template = widths.join(' ');
  return (
    <ColumnsContext.Provider value={template}>
      <Box role="list" aria-label={label} sx={{ display: 'flex', flexDirection: 'column' }}>
        <Box
          aria-hidden
          sx={{
            display: 'grid',
            gridTemplateColumns: template,
            gap: 2,
            p: '8px 12px',
            fontSize: 12,
            fontWeight: 700,
            color: token('mt'),
            borderBottom: `2px solid ${token('dv')}`,
            [`@media (max-width: ${compactBreakpoint}px)`]: { display: 'none' },
          }}
        >
          {columns.map((column) => (
            <span key={column}>{column}</span>
          ))}
        </Box>
        {children}
        {empty && (
          <Box
            sx={{ p: '24px 12px', color: token('mt'), '&:not(:last-child)': { display: 'none' } }}
          >
            {empty}
          </Box>
        )}
      </Box>
    </ColumnsContext.Provider>
  );
}

function Row({ to, children }: { to: string; children: ReactNode }) {
  const template = useContext(ColumnsContext);
  return (
    <Box
      role="listitem"
      component={Link}
      to={to}
      sx={{
        display: 'grid',
        gridTemplateColumns: template,
        gap: 2,
        alignItems: 'center',
        p: '12px',
        color: token('tx'),
        textDecoration: 'none',
        borderBottom: `1px solid ${token('ln')}`,
        '&:hover': { bgcolor: token('sf') },
        '&:focus-visible': { outline: `2px solid ${token('ac')}`, outlineOffset: -2 },
        [`@media (max-width: ${compactBreakpoint}px)`]: { gridTemplateColumns: '1fr', gap: '4px' },
      }}
    >
      {children}
    </Box>
  );
}

export const ListTable = Object.assign(ListTableRoot, { Row });
