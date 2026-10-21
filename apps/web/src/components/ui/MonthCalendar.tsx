import Box from '@mui/material/Box';
import { Link } from 'react-router';

import { Icon } from './Icon';
import { token } from './tokens';

export interface MonthCalendarEntry {
  key: string;
  to: string;
  label: string;
  /** e.g. the time. */
  detail: string;
  /** Crossed out, e.g. a cancelled event. */
  struck?: boolean;
  /** The color of the bar on its left. */
  tone: 'accent' | 'ok' | 'warn' | 'muted';
}

export interface MonthCalendarDay {
  key: string;
  /** The day of the month. */
  number: number;
  /** False for days of the weeks around the month, shown faded. */
  inMonth: boolean;
  today: boolean;
  entries: MonthCalendarEntry[];
}

export interface MonthCalendarProps {
  /** e.g. "November 2026". */
  title: string;
  /** Weekday names, in the order of the columns. */
  weekdays: readonly string[];
  weeks: readonly (readonly MonthCalendarDay[])[];
  onPrevious: () => void;
  onNext: () => void;
  previousLabel: string;
  nextLabel: string;
}

const tones = { accent: 'ac', ok: 'ok', warn: 'warn', muted: 'mt' } as const;

/** A month as a grid of weeks, with entries that open a page on each day. */
export function MonthCalendar({
  title,
  weekdays,
  weeks,
  onPrevious,
  onNext,
  previousLabel,
  nextLabel,
}: MonthCalendarProps) {
  const arrow = {
    width: 34,
    height: 34,
    display: 'grid',
    placeItems: 'center',
    bgcolor: 'transparent',
    color: token('tx'),
    border: `1px solid ${token('dv')}`,
    cursor: 'pointer',
    '&:hover': { bgcolor: token('sf2') },
  };
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box
          component="button"
          type="button"
          aria-label={previousLabel}
          onClick={onPrevious}
          sx={arrow}
        >
          <Icon name="chevronLeft" size={14} />
        </Box>
        <Box component="button" type="button" aria-label={nextLabel} onClick={onNext} sx={arrow}>
          <Icon name="chevronRight" size={14} />
        </Box>
        <Box component="h2" sx={{ m: '0 0 0 8px', fontSize: 19, fontWeight: 800 }}>
          {title}
        </Box>
      </Box>
      <Box sx={{ overflowX: 'auto' }}>
        <Box
          role="grid"
          aria-label={title}
          sx={{
            minWidth: 720,
            display: 'flex',
            flexDirection: 'column',
            borderTop: `2px solid ${token('dv')}`,
          }}
        >
          <Box role="row" sx={grid}>
            {weekdays.map((weekday) => (
              <Box
                role="columnheader"
                key={weekday}
                sx={{
                  p: '6px 8px',
                  fontSize: 11.5,
                  textTransform: 'uppercase',
                  letterSpacing: '.06em',
                  color: token('mt'),
                  fontWeight: 700,
                }}
              >
                {weekday}
              </Box>
            ))}
          </Box>
          {weeks.map((week) => (
            <Box role="row" key={week[0]!.key} sx={grid}>
              {week.map((day) => (
                <Box
                  role="gridcell"
                  key={day.key}
                  aria-current={day.today ? 'date' : undefined}
                  sx={{
                    minHeight: 104,
                    p: '6px',
                    borderRight: `1px solid ${token('ln')}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    opacity: day.inMonth ? 1 : 0.45,
                  }}
                >
                  <Box
                    component="span"
                    sx={{
                      alignSelf: 'flex-start',
                      fontSize: 12.5,
                      fontWeight: 700,
                      p: '1px 6px',
                      bgcolor: day.today ? token('ac') : 'transparent',
                      color: day.today ? token('ac-on') : token('tx'),
                    }}
                  >
                    {day.number}
                  </Box>
                  {day.entries.map((entry) => (
                    <Box
                      key={entry.key}
                      component={Link}
                      to={entry.to}
                      sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1px',
                        p: '4px 6px',
                        bgcolor: token('sf'),
                        color: token('tx'),
                        textDecoration: 'none',
                        boxShadow: `inset 3px 0 0 ${token(tones[entry.tone])}`,
                        minWidth: 0,
                        '&:hover': { bgcolor: token('sf2') },
                      }}
                    >
                      <Box
                        component="span"
                        sx={{
                          fontSize: 12,
                          fontWeight: 700,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          textDecoration: entry.struck ? 'line-through' : 'none',
                        }}
                      >
                        {entry.label}
                      </Box>
                      <Box component="span" sx={{ fontSize: 11, color: token('mt') }}>
                        {entry.detail}
                      </Box>
                    </Box>
                  ))}
                </Box>
              ))}
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}

const grid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
  borderBottom: `1px solid ${token('ln')}`,
};
