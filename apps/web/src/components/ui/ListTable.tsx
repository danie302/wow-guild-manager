import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import { Children, createContext, useContext, type ReactNode } from 'react';
import { Link } from 'react-router';

import { compactBreakpoint, token } from './tokens';

const ColumnsContext = createContext<string>('1fr');

/** Columns the list can be sorted by, by clicking their heading. */
export interface ListTableSort {
  /** Indexes of the sortable columns. */
  columns: readonly number[];
  /** The column it's sorted by now, and which way. */
  column: number;
  direction: 'asc' | 'desc';
  onSort: (column: number) => void;
}

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
  sort?: ListTableSort;
}

/**
 * A list of rows that each open something, laid out as a table on wide screens.
 *
 * <ListTable label="Roster" columns={['Discord', 'Rank']} widths={['2fr', '1fr']}>
 *   <ListTable.Row to="/…"><span>…</span><span>…</span></ListTable.Row>
 * </ListTable>
 */
function ListTableRoot({ label, columns, widths, children, empty, sort }: ListTableProps) {
  const template = widths.join(' ');
  return (
    <ColumnsContext.Provider value={template}>
      <Box role="list" aria-label={label} sx={{ display: 'flex', flexDirection: 'column' }}>
        <Box
          // Sortable headings are buttons, so they stay for screen readers.
          aria-hidden={sort ? undefined : true}
          sx={{
            display: 'grid',
            gridTemplateColumns: template,
            gap: 2,
            p: '8px 12px',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '.08em',
            textTransform: 'uppercase',
            color: token('mt'),
            borderBottom: `2px solid ${token('dv')}`,
            [`@media (max-width: ${compactBreakpoint}px)`]: { display: 'none' },
          }}
        >
          {columns.map((column, index) =>
            sort?.columns.includes(index) ? (
              <ButtonBase
                key={column}
                disableRipple
                onClick={() => sort.onSort(index)}
                aria-pressed={sort.column === index}
                sx={{
                  justifyContent: 'flex-start',
                  font: 'inherit',
                  letterSpacing: 'inherit',
                  textTransform: 'inherit',
                  color: sort.column === index ? token('tx') : 'inherit',
                  '&:hover': { color: token('tx') },
                  '&.Mui-focusVisible': { outline: `2px solid ${token('ac')}` },
                }}
              >
                {column}
                {sort.column === index && (sort.direction === 'asc' ? ' ↑' : ' ↓')}
              </ButtonBase>
            ) : (
              <span key={column}>{column}</span>
            ),
          )}
        </Box>
        {children}
        {empty && Children.toArray(children).length === 0 && (
          <Box sx={{ p: '24px 12px', color: token('mt') }}>{empty}</Box>
        )}
      </Box>
    </ColumnsContext.Provider>
  );
}

/** A row; with `to`, it opens that page, and without, it's only shown. */
function Row({ to, children }: { to?: string; children: ReactNode }) {
  const template = useContext(ColumnsContext);
  return (
    <Box
      role="listitem"
      {...(to ? { component: Link, to } : {})}
      sx={{
        display: 'grid',
        gridTemplateColumns: template,
        gap: 2,
        alignItems: 'center',
        p: '12px',
        color: token('tx'),
        textDecoration: 'none',
        borderBottom: `1px solid ${token('ln')}`,
        ...(to && { '&:hover': { bgcolor: token('sf') } }),
        '&:focus-visible': { outline: `2px solid ${token('ac')}`, outlineOffset: -2 },
        [`@media (max-width: ${compactBreakpoint}px)`]: { gridTemplateColumns: '1fr', gap: '4px' },
      }}
    >
      {children}
    </Box>
  );
}

export const ListTable = Object.assign(ListTableRoot, { Row });
