import {
  ATTENDANCE_PERIODS,
  DEFAULT_ATTENDANCE_PERIOD,
  EVENT_TYPES,
  type AttendancePeriod,
} from '@wgm/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useMemberAttendance } from '../../api/roster';
import {
  ActionList,
  ChoiceGroup,
  Loading,
  Notice,
  Page,
  StatStrip,
  Tag,
} from '../../components/ui';
import { useFormat } from '../../i18n/format';
import { BAND_COLOR, rateText } from '../attendanceText';
import { STATUS_TONE } from '../events/AttendanceTab';

/**
 * A member's attendance: their rate overall and per event type, late arrivals and no-shows,
 * and the events they have a record for, newest first.
 */
export function MemberAttendance({ guildId, memberId }: { guildId: string; memberId: string }) {
  const { t } = useTranslation();
  const format = useFormat();
  const [period, setPeriod] = useState<AttendancePeriod>(DEFAULT_ATTENDANCE_PERIOD);
  const attendance = useMemberAttendance(guildId, memberId, period);

  return (
    <Page.Block title={t('reports.memberTitle')}>
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
      {attendance.isPending ? (
        <Loading label={t('reports.loading')} />
      ) : attendance.isError ? (
        <Notice tone="bad" title={t('reports.loadFailed')} />
      ) : (
        <>
          <StatStrip
            label={t('reports.rates')}
            items={[
              {
                key: 'all',
                label: t('reports.overall'),
                value: rateText(format, attendance.data.overall.rate),
                note: t('reports.attendedOf', {
                  attended: attendance.data.overall.attended,
                  total: attendance.data.overall.total,
                }),
                noteTone: 'muted',
                color: attendance.data.overall.band
                  ? BAND_COLOR[attendance.data.overall.band]
                  : 'dv',
              },
              ...EVENT_TYPES.map((type) => ({
                key: type,
                label: t(`events.types.${type}`),
                value: rateText(format, attendance.data.byType[type].rate),
                note: t('reports.attendedOf', {
                  attended: attendance.data.byType[type].attended,
                  total: attendance.data.byType[type].total,
                }),
                noteTone: 'muted' as const,
                color: 'dv' as const,
              })),
            ]}
          />
          <StatStrip
            label={t('reports.counts')}
            items={[
              {
                key: 'late',
                label: t('reports.late'),
                value: String(attendance.data.late),
                color: 'warn',
              },
              {
                key: 'bench',
                label: t('reports.bench'),
                value: String(attendance.data.bench),
                color: 'dv',
              },
              {
                key: 'noShow',
                label: t('reports.noShows'),
                value: String(attendance.data.noShow),
                color: 'bad',
              },
            ]}
          />
          <ActionList label={t('reports.history')} empty={t('reports.noHistory')}>
            {attendance.data.history.map((row) => (
              <ActionList.Item
                key={row.eventId}
                title={row.name}
                detail={`${format.date(new Date(row.startsAt))} · ${t(`events.types.${row.type}`)} · ${row.character.name}`}
                actions={null}
              >
                <Tag tone={STATUS_TONE[row.status]}>{t(`attendance.status.${row.status}`)}</Tag>
              </ActionList.Item>
            ))}
          </ActionList>
        </>
      )}
    </Page.Block>
  );
}
