import {
  ATTENDANCE_STATUSES,
  CLASS_NAMES,
  type AttendanceRecordResponse,
  type AttendanceStatus,
  type EventResponse,
} from '@wgm/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAttendance, useSaveAttendance } from '../../api/events';
import { useRoster } from '../../api/roster';
import {
  ActionList,
  Button,
  ChoiceGroup,
  ComboBox,
  FormRow,
  Loading,
  Notice,
  Page,
  Tag,
  type TagProps,
} from '../../components/ui';
import { apiErrorText } from '../../i18n/api-errors';
import { useFormat } from '../../i18n/format';

/** How each status reads: attended in green, partly in amber, not attended muted, no-show red. */
export const STATUS_TONE: Record<AttendanceStatus, TagProps['tone']> = {
  present: 'ok',
  late: 'warn',
  left_early: 'warn',
  bench: 'neutral',
  absent_with_notice: 'neutral',
  no_show: 'bad',
};

/**
 * Records who attended, once the event has started: every member who signed up (pre-filled
 * from their sign-up until the first save), members added by hand, and the corrections made
 * after the first save.
 */
export function AttendanceTab({ guildId, event }: { guildId: string; event: EventResponse }) {
  const { t } = useTranslation();
  const format = useFormat();
  const attendance = useAttendance(guildId, event.id);

  if (event.cancelled) return <Notice tone="warn" title={t('attendance.cancelled')} />;
  if (attendance.isPending) return <Loading label={t('attendance.loading')} />;
  if (attendance.isError) return <Notice tone="bad" title={t('attendance.loadFailed')} />;
  if (!attendance.data.open) {
    return (
      <Notice tone="warn" title={t('attendance.locked')}>
        {t('attendance.starts', { date: format.dateTime(new Date(event.startsAt)) })}
      </Notice>
    );
  }
  // A new key starts the form over from the saved list after each save.
  return (
    <AttendanceForm
      key={attendance.data.recorded?.at ?? 'draft'}
      guildId={guildId}
      eventId={event.id}
      data={attendance.data}
    />
  );
}

function AttendanceForm({
  guildId,
  eventId,
  data,
}: {
  guildId: string;
  eventId: string;
  data: NonNullable<ReturnType<typeof useAttendance>['data']>;
}) {
  const { t } = useTranslation();
  const format = useFormat();
  const roster = useRoster(guildId);
  const save = useSaveAttendance(guildId, eventId);
  const [rows, setRows] = useState<AttendanceRecordResponse[]>(data.records);
  const [adding, setAdding] = useState('');

  const saved = new Map(data.records.map((row) => [row.memberId, row.status]));
  const dirty =
    !data.recorded ||
    rows.length !== data.records.length ||
    rows.some((row) => saved.get(row.memberId) !== row.status);
  const setStatus = (memberId: string, status: AttendanceStatus) =>
    setRows((current) =>
      current.map((row) => (row.memberId === memberId ? { ...row, status } : row)),
    );
  const listed = new Set(rows.map((row) => row.memberId));
  const addable = (roster.data ?? []).filter(
    (member) => !listed.has(member.id) && member.characters.length > 0,
  );

  const add = () => {
    const member = addable.find((candidate) => candidate.id === adding);
    const main = member?.characters[0];
    if (!member || !main) return;
    setRows((current) => [
      ...current,
      {
        memberId: member.id,
        discordName: member.discordName,
        character: { id: main.id, name: main.name, class: main.class, race: main.race },
        role: null,
        signedUp: false,
        status: 'present',
      },
    ]);
    setAdding('');
  };

  return (
    <Page.Stack>
      <Page.Inline>
        {ATTENDANCE_STATUSES.map((status) => (
          <Tag key={status} tone={STATUS_TONE[status]}>
            {t(`attendance.status.${status}`)} {rows.filter((row) => row.status === status).length}
          </Tag>
        ))}
      </Page.Inline>
      <Page.Inline>
        <Page.Muted>
          {!data.recorded
            ? t('attendance.notSaved')
            : dirty
              ? t('attendance.unsaved')
              : t('attendance.saved', {
                  date: format.dateTime(new Date(data.recorded.at)),
                  name: data.recorded.by ?? t('member.unknownUser'),
                })}
        </Page.Muted>
        <Button
          onClick={() =>
            setRows((current) => current.map((row) => ({ ...row, status: 'present' })))
          }
        >
          {t('attendance.allPresent')}
        </Button>
        <Button
          variant="primary"
          onClick={() =>
            save.mutate({
              records: rows.map(({ memberId, status }) => ({ memberId, status })),
            })
          }
          disabled={!dirty || save.isPending}
        >
          {t('attendance.save')}
        </Button>
      </Page.Inline>
      {save.error && (
        <Notice tone="bad" title={t('attendance.saveFailed')}>
          {apiErrorText(t, save.error)}
        </Notice>
      )}

      <ActionList label={t('attendance.title')} empty={t('attendance.empty')}>
        {rows.map((row) => (
          <ActionList.Item
            key={row.memberId}
            title={row.character.name}
            detail={[
              row.discordName,
              CLASS_NAMES[row.character.class],
              row.signedUp ? null : t('attendance.added'),
            ]
              .filter(Boolean)
              .join(' · ')}
            actions={
              // Before the first save, someone added by hand can be taken off again.
              !data.recorded && !row.signedUp ? (
                <Button
                  variant="text"
                  tone="danger"
                  onClick={() =>
                    setRows((current) => current.filter((other) => other.memberId !== row.memberId))
                  }
                >
                  {t('attendance.takeOff')}
                </Button>
              ) : null
            }
          >
            <ChoiceGroup
              label={t('attendance.statusOf', { name: row.character.name })}
              hideLabel
              size="small"
              value={row.status}
              onChange={(status: AttendanceStatus) => setStatus(row.memberId, status)}
            >
              {ATTENDANCE_STATUSES.map((status) => (
                <ChoiceGroup.Option key={status} value={status}>
                  {t(`attendance.status.${status}`)}
                </ChoiceGroup.Option>
              ))}
            </ChoiceGroup>
          </ActionList.Item>
        ))}
      </ActionList>

      <FormRow>
        <ComboBox
          variant="field"
          label={t('attendance.addMember')}
          value={adding}
          options={addable.map((member) => ({
            value: member.id,
            label: member.discordName,
            detail: member.characters[0]?.name,
          }))}
          onChange={setAdding}
          noOptionsText={t('attendance.noMember')}
          disabled={roster.isPending}
        />
        <FormRow.Fit>
          <Button size="medium" onClick={add} disabled={!adding}>
            {t('attendance.add')}
          </Button>
        </FormRow.Fit>
      </FormRow>
      <Page.Text>{t('attendance.addHint')}</Page.Text>

      <Page.Block title={t('attendance.history')}>
        <ActionList label={t('attendance.history')} empty={t('attendance.noHistory')}>
          {data.history.map((change) => (
            <ActionList.Item
              key={change.id}
              title={change.character.name}
              detail={`${change.by ?? t('member.unknownUser')} · ${format.dateTime(new Date(change.at))}`}
              actions={null}
            >
              {change.from ? (
                <Tag tone={STATUS_TONE[change.from]}>{t(`attendance.status.${change.from}`)}</Tag>
              ) : (
                <Tag>{t('attendance.addedTag')}</Tag>
              )}{' '}
              → <Tag tone={STATUS_TONE[change.to]}>{t(`attendance.status.${change.to}`)}</Tag>
            </ActionList.Item>
          ))}
        </ActionList>
      </Page.Block>
    </Page.Stack>
  );
}
