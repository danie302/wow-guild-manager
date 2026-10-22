import {
  ATTENDANCE_PERIODS,
  DEFAULT_ATTENDANCE_PERIOD,
  EVENT_TYPES,
  RANK_NAMES,
  type AttendancePeriod,
  type AttendanceReportRow,
  type EventType,
} from '@wgm/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAttendanceReport } from '../../api/roster';
import { guildPath, useGuildIdParam } from '../../app/guildSelection';
import {
  CharacterName,
  ChoiceGroup,
  ListTable,
  Loading,
  Notice,
  Page,
  RateBar,
  StatStrip,
} from '../../components/ui';
import { useFormat } from '../../i18n/format';
import { BAND_COLOR, rateText } from '../attendanceText';

/** The columns the list sorts by, in the order of its headings. */
const SORTABLE = { 0: 'name', 2: 'rate', 3: 'attended', 4: 'late', 5: 'noShow' } as const;
type SortColumn = keyof typeof SORTABLE;

/** Each column's first direction: the lowest rate first, the most late arrivals first. */
const FIRST_DIRECTION: Record<SortColumn, 'asc' | 'desc'> = {
  0: 'asc',
  2: 'asc',
  3: 'desc',
  4: 'desc',
  5: 'desc',
};

/** Members without records come last, whichever way the list is sorted. */
function compare(column: SortColumn, direction: 'asc' | 'desc') {
  const sign = direction === 'asc' ? 1 : -1;
  return (a: AttendanceReportRow, b: AttendanceReportRow) => {
    const key = SORTABLE[column];
    if (key === 'name') return sign * a.discordName.localeCompare(b.discordName);
    if (a.rate === null || b.rate === null) {
      return (a.rate === null ? 1 : 0) - (b.rate === null ? 1 : 0);
    }
    return sign * ((a[key] ?? 0) - (b[key] ?? 0)) || a.discordName.localeCompare(b.discordName);
  };
}

/**
 * Every member's attendance, to compare them when there are more players than slots: the
 * guild average, how many members are in each band, and a list sortable by rate, filtered by
 * period and event type.
 */
export function AttendanceReportPage() {
  const { t } = useTranslation();
  const format = useFormat();
  const guildId = useGuildIdParam()!;
  const [period, setPeriod] = useState<AttendancePeriod>(DEFAULT_ATTENDANCE_PERIOD);
  const [type, setType] = useState<EventType | 'all'>('all');
  const [sort, setSort] = useState<{ column: SortColumn; direction: 'asc' | 'desc' }>({
    column: 2,
    direction: 'asc',
  });
  // The same heading again turns the order around.
  const sortBy = (column: number) =>
    setSort((current) =>
      current.column === column
        ? { column, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { column: column as SortColumn, direction: FIRST_DIRECTION[column as SortColumn] },
    );
  const report = useAttendanceReport(guildId, period, type);

  return (
    <Page>
      <Page.Header>
        <Page.Title>{t('reports.title')}</Page.Title>
      </Page.Header>
      <Page.Filters>
        <ChoiceGroup
          label={t('reports.type')}
          hideLabel
          size="small"
          value={type}
          onChange={(next: EventType | 'all') => setType(next)}
        >
          <ChoiceGroup.Option value="all">{t('reports.allTypes')}</ChoiceGroup.Option>
          {EVENT_TYPES.map((option) => (
            <ChoiceGroup.Option key={option} value={option}>
              {t(`events.types.${option}`)}
            </ChoiceGroup.Option>
          ))}
        </ChoiceGroup>
        <ChoiceGroup
          label={t('reports.period')}
          hideLabel
          size="small"
          value={period}
          onChange={(next: AttendancePeriod) => setPeriod(next)}
        >
          {ATTENDANCE_PERIODS.map((option) => (
            <ChoiceGroup.Option key={option} value={option}>
              {t(`reports.periods.${option}`)}
            </ChoiceGroup.Option>
          ))}
        </ChoiceGroup>
      </Page.Filters>

      {report.isPending ? (
        <Loading label={t('reports.loading')} />
      ) : report.isError ? (
        <Notice tone="bad" title={t('reports.loadFailed')} />
      ) : (
        <>
          <StatStrip
            label={t('reports.summary')}
            items={[
              {
                key: 'average',
                label: t('reports.average'),
                value: rateText(format, report.data.average),
                color: 'dv',
              },
              {
                key: 'good',
                label: `${t('reports.bands.good')} · ${t('reports.goodRange', { n: report.data.thresholds.good })}`,
                value: String(report.data.bands.good),
                color: 'ok',
              },
              {
                key: 'watch',
                label: `${t('reports.bands.watch')} · ${t('reports.watchRange', { a: report.data.thresholds.atRisk, b: report.data.thresholds.good - 1 })}`,
                value: String(report.data.bands.watch),
                color: 'warn',
              },
              {
                key: 'at_risk',
                label: `${t('reports.bands.at_risk')} · ${t('reports.riskRange', { n: report.data.thresholds.atRisk })}`,
                value: String(report.data.bands.at_risk),
                color: 'bad',
              },
            ]}
          />
          <ListTable
            label={t('reports.title')}
            columns={[
              t('reports.member'),
              t('roster.rank'),
              t('reports.rate'),
              t('reports.attended'),
              t('reports.late'),
              t('reports.noShows'),
            ]}
            widths={['1.4fr', '0.8fr', '1.4fr', '0.6fr', '0.5fr', '0.6fr']}
            empty={t('roster.empty')}
            sort={{
              columns: [0, 2, 3, 4, 5],
              column: sort.column,
              direction: sort.direction,
              onSort: sortBy,
            }}
          >
            {[...report.data.members].sort(compare(sort.column, sort.direction)).map((row) => (
              <ListTable.Row key={row.memberId} to={guildPath(guildId, `roster/${row.memberId}`)}>
                <div>
                  {row.main ? (
                    <CharacterName name={row.main.name} characterClass={row.main.class} />
                  ) : (
                    <strong>{row.discordName}</strong>
                  )}
                  <Page.Text>{row.discordName}</Page.Text>
                </div>
                <span>{RANK_NAMES[row.rank]}</span>
                <RateBar
                  value={row.rate}
                  label={rateText(format, row.rate)}
                  color={row.band ? BAND_COLOR[row.band] : 'mt'}
                  marks={[report.data.thresholds.atRisk / 100, report.data.thresholds.good / 100]}
                />
                <span>{t('reports.attendedOf', { attended: row.attended, total: row.total })}</span>
                <span>{row.late}</span>
                <span>{row.noShow}</span>
              </ListTable.Row>
            ))}
          </ListTable>
        </>
      )}
    </Page>
  );
}
