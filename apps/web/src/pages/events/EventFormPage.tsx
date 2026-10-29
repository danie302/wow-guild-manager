import {
  COMBAT_ROLE_NAMES,
  COMBAT_ROLE_PLURAL_NAMES,
  COMBAT_ROLES,
  createEventSchema,
  DUNGEON_SLOTS,
  EVENT_DESCRIPTION_MAX_LENGTH,
  EVENT_NAME_MAX_LENGTH,
  EVENT_TYPES,
  eventSlotIssues,
  PVP_MAX_SIZE,
  PVP_MIN_SIZE,
  RAID_SIZES,
  signUpsLosingSlots,
  toValidationIssues,
  type CombatRole,
  type CreateEventInput,
  type EventResponse,
  type EventType,
  type SeriesResponse,
  type ValidationIssue,
} from '@wgm/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';

import { ApiRequestError } from '../../api/client';
import {
  useCreateEvent,
  useCreateSeries,
  useEvent,
  useEventSignUps,
  useSeries,
  useSeriesSignUps,
  useUpdateEvent,
  useUpdateSeries,
} from '../../api/events';
import { guildPath, useGuildIdParam } from '../../app/guildSelection';
import {
  Button,
  Checkbox,
  ChoiceGroup,
  ComboBox,
  FormColumns,
  FormGrid,
  Loading,
  Notice,
  Page,
  Stepper,
  TextField,
  TotalMeter,
} from '../../components/ui';
import { apiErrorText, validationIssueMessage } from '../../i18n/api-errors';
import { fromZonedFields, toZonedFields } from '../../i18n/calendar';
import { useFormat } from '../../i18n/format';
import { useGuild, useGuildChannels } from '../../api/guilds';
import { roleColor } from './eventText';
import { PreConfirmSection, type PreConfirmed } from './PreConfirmSection';

type Slots = Record<CombatRole, number>;

interface Draft {
  type: EventType;
  name: string;
  description: string;
  date: string;
  time: string;
  size: number;
  slots: Slots;
  /** Its own Tentative deadline in hours, as typed; null uses the guild's. */
  ownDeadline: string | null;
}

/** Slots a new event starts with, by type and size. */
function defaultSlots(type: EventType, size: number): Slots {
  if (type === 'dungeon') return { ...DUNGEON_SLOTS };
  if (type === 'pvp')
    return { tank: 0, healer: Math.round(size / 5), dps: size - Math.round(size / 5) };
  const tank = size === 40 ? 4 : 2;
  const healer = size === 40 ? 10 : size === 20 ? 5 : 3;
  return { tank, healer, dps: size - tank - healer };
}

const defaultSize: Record<EventType, number> = { raid: 40, dungeon: 5, pvp: 10 };

/**
 * Creates an event or a weekly series (`events/new`), or edits an event that hasn't started
 * (`events/:eventId/edit`) or a running series (`events/series/:seriesId/edit`).
 */
export function EventFormPage() {
  const { t } = useTranslation();
  const guildId = useGuildIdParam()!;
  const { eventId, seriesId } = useParams();
  const event = useEvent(guildId, eventId ?? '');
  const series = useSeries(guildId, seriesId ?? '');

  if (!eventId && !seriesId) return <EventForm guildId={guildId} />;
  const query = eventId ? event : series;
  if (query.isPending) return <Loading label={t('events.loading')} />;
  if (query.isError) return <Notice tone="bad" title={t('events.loadFailed')} />;
  if (eventId) {
    const data = event.data!;
    if (data.cancelled || new Date(data.startsAt) <= new Date()) {
      return <Notice tone="warn" title={t('eventForm.readOnly')} />;
    }
    return <EventForm guildId={guildId} editing={{ kind: 'event', value: data }} />;
  }
  if (series.data!.stopped) return <Notice tone="warn" title={t('eventForm.seriesStopped')} />;
  return <EventForm guildId={guildId} editing={{ kind: 'series', value: series.data! }} />;
}

type Editing = { kind: 'event'; value: EventResponse } | { kind: 'series'; value: SeriesResponse };

function EventForm({ guildId, editing }: { guildId: string; editing?: Editing }) {
  const { t } = useTranslation();
  const format = useFormat();
  const navigate = useNavigate();
  const event = editing?.value;
  const editingSeries = editing?.kind === 'series';
  const createEvent = useCreateEvent(guildId);
  const createSeries = useCreateSeries(guildId);
  const updateEvent = useUpdateEvent(guildId, editing?.kind === 'event' ? editing.value.id : '');
  const updateSeries = useUpdateSeries(guildId, editingSeries ? editing.value.id : '');
  const [repeat, setRepeat] = useState(false);
  const [preConfirmed, setPreConfirmed] = useState<PreConfirmed[]>([]);
  const guild = useGuild(guildId).data;
  const isGuildMaster = guild?.access === 'guild_master';
  // A series' own channel; null uses its type's or the events channel.
  const [seriesChannel, setSeriesChannel] = useState<string | null>(
    editing?.kind === 'series' ? (editing.value.channel?.id ?? null) : null,
  );
  const forSeries = repeat || editingSeries;
  const channels = useGuildChannels(guildId, forSeries);
  const save = editing
    ? editingSeries
      ? updateSeries
      : updateEvent
    : repeat
      ? createSeries
      : createEvent;
  const [draft, setDraft] = useState<Draft>(() =>
    event
      ? {
          type: event.type,
          name: event.name,
          description: event.description,
          ...toZonedFields(new Date(event.startsAt), format.timeZone),
          size: event.size,
          slots: { ...event.slots },
          ownDeadline:
            editing?.kind === 'event'
              ? editing.value.tentativeDeadline.own
                ? String(editing.value.tentativeDeadline.hours)
                : null
              : editing?.kind === 'series' && editing.value.tentativeDeadlineHours !== null
                ? String(editing.value.tentativeDeadlineHours)
                : null,
        }
      : {
          type: 'raid',
          name: '',
          description: '',
          date: '',
          time: '',
          size: defaultSize.raid,
          slots: defaultSlots('raid', defaultSize.raid),
          ownDeadline: null,
        },
  );
  const change = (changes: Partial<Draft>) => setDraft((current) => ({ ...current, ...changes }));
  const resize = (type: EventType, size: number) =>
    change({ type, size, slots: defaultSlots(type, size) });

  const startsAt = fromZonedFields(draft.date, draft.time, format.timeZone);
  // Only the Guild Master pre-confirms, and only for a one-time raid.
  const canPreConfirm = isGuildMaster && !editing && !repeat && draft.type === 'raid';
  const input: CreateEventInput = {
    type: draft.type,
    name: draft.name,
    description: draft.description,
    startsAt: startsAt?.toISOString() ?? '',
    size: draft.size,
    slots: draft.slots,
    tentativeDeadlineHours: draft.ownDeadline === null ? null : Number(draft.ownDeadline),
    ...(canPreConfirm &&
      preConfirmed.length > 0 && {
        preConfirmed: preConfirmed.map(({ characterId, role }) => ({ characterId, role })),
      }),
  };
  const parsed = createEventSchema.safeParse(input);
  const localIssues: ValidationIssue[] = [
    ...(parsed.success ? [] : toValidationIssues(parsed.error, input)),
    ...(startsAt && startsAt <= new Date()
      ? [{ field: 'startsAt', code: 'EVENT_STARTS_IN_PAST' } as const]
      : []),
  ];
  const serverIssues =
    save.error instanceof ApiRequestError && save.error.error.code === 'VALIDATION_ERROR'
      ? save.error.error.issues
      : [];
  // Something missing only disables saving (the footer says what); a wrong value shows on its
  // field right away.
  const missing = (issue: ValidationIssue) =>
    issue.code === 'REQUIRED' || (issue.field === 'startsAt' && (!draft.date || !draft.time));
  const errorFor = (field: string) => {
    const issue = [...localIssues.filter((i) => !missing(i)), ...serverIssues].find(
      (candidate) => candidate.field === field || candidate.field.startsWith(`${field}.`),
    );
    return issue && validationIssueMessage(t, issue);
  };
  const firstProblem = localIssues[0];
  const saveHint = !firstProblem
    ? undefined
    : firstProblem.field === 'name'
      ? t('eventForm.hintName')
      : firstProblem.field === 'startsAt'
        ? missing(firstProblem)
          ? t('eventForm.hintDate')
          : t('eventForm.hintFuture')
        : firstProblem.field === 'size' || firstProblem.field.startsWith('slots')
          ? t('eventForm.hintSlots')
          : t('eventForm.hintFix');
  const total = draft.slots.tank + draft.slots.healer + draft.slots.dps;
  const slotProblem = eventSlotIssues(draft.type, draft)[0];

  // Fewer slots move the most recent participants of a role to the waitlist: say who first.
  const eventSignUps = useEventSignUps(guildId, editing?.kind === 'event' ? editing.value.id : '');
  const seriesSignUps = useSeriesSignUps(guildId, editingSeries ? editing.value.id : '');
  const losing = (
    editingSeries
      ? (seriesSignUps.data?.events ?? []).map((upcoming) => ({
          startsAt: upcoming.startsAt,
          signUps: upcoming.signUps,
        }))
      : [{ startsAt: null, signUps: eventSignUps.data ?? [] }]
  )
    .map(({ startsAt: at, signUps }) => ({
      at,
      names: signUpsLosingSlots(signUps, draft.slots).map((signUp) =>
        t('eventForm.losingSlotName', {
          name: signUp.character.name,
          role: COMBAT_ROLE_NAMES[signUp.role!],
        }),
      ),
    }))
    .filter(({ names }) => names.length > 0);
  const losingCount = losing.reduce((count, { names }) => count + names.length, 0);

  const submit = () => {
    if (localIssues.length > 0) return;
    const toEvent = { onSuccess: (saved: { id: string }) => open(`events/${saved.id}`) };
    const toSeries = { onSuccess: (saved: { id: string }) => open(`events/series/${saved.id}`) };
    if (!editing) {
      if (repeat) createSeries.mutate({ ...input, channelId: seriesChannel }, toSeries);
      else createEvent.mutate(input, toEvent);
      return;
    }
    const { name, description, startsAt: start, size, slots, tentativeDeadlineHours } = input;
    const details = { name, description, startsAt: start, size, slots, tentativeDeadlineHours };
    if (editingSeries) updateSeries.mutate({ ...details, channelId: seriesChannel }, toSeries);
    else updateEvent.mutate(details, toEvent);
  };
  const open = (path: string) => void navigate(guildPath(guildId, path));
  const back = () =>
    open(!event ? 'events' : editingSeries ? `events/series/${event.id}` : `events/${event.id}`);

  // Without its own channel, a series is posted where its type's events are.
  const fallback = guild?.typeChannels[draft.type] ?? guild?.eventsChannel ?? null;
  const defaultChannelLabel = fallback
    ? t('eventForm.channelDefault', { channel: `#${fallback.name ?? fallback.id}` })
    : t('eventForm.channelDefaultNone');
  // While the channels can't be listed, the saved one still shows.
  const savedChannel =
    editingSeries && editing.value.channel
      ? [
          {
            id: editing.value.channel.id,
            name: editing.value.channel.name ?? editing.value.channel.id,
            category: null,
          },
        ]
      : [];

  const fields = (
    <>
      {event ? (
        <Page.Text>
          {t('eventForm.type')}: {t(`events.types.${event.type}`)} · {t('eventForm.typeFixed')}
        </Page.Text>
      ) : (
        <ChoiceGroup
          label={t('eventForm.type')}
          value={draft.type}
          onChange={(type: EventType) => resize(type, defaultSize[type])}
        >
          {EVENT_TYPES.map((type) => (
            <ChoiceGroup.Option key={type} value={type}>
              {t(`events.types.${type}`)}
            </ChoiceGroup.Option>
          ))}
        </ChoiceGroup>
      )}
      <TextField
        label={t('eventForm.name')}
        wide
        value={draft.name}
        onChange={(name) => change({ name })}
        maxLength={EVENT_NAME_MAX_LENGTH}
        placeholder={t('eventForm.namePlaceholder')}
        error={errorFor('name')}
      />
      <TextField
        label={t('eventForm.description')}
        wide
        multiline
        value={draft.description}
        onChange={(description) => change({ description })}
        maxLength={EVENT_DESCRIPTION_MAX_LENGTH}
        error={errorFor('description')}
      />
      <FormGrid>
        <TextField
          label={editingSeries ? t('eventForm.nextDate') : t('eventForm.date')}
          type="date"
          wide
          value={draft.date}
          onChange={(date) => change({ date })}
          error={errorFor('startsAt')}
        />
        <TextField
          label={t('eventForm.time')}
          type="time"
          wide
          value={draft.time}
          onChange={(time) => change({ time })}
          hint={t('eventForm.timeZone', { timeZone: format.timeZone })}
        />
      </FormGrid>
      {!event && <Checkbox label={t('eventForm.repeat')} checked={repeat} onChange={setRepeat} />}
      {forSeries && <Page.Text>{t('eventForm.repeatHint')}</Page.Text>}
      {forSeries && (
        <ComboBox
          label={t('eventForm.channel')}
          value={seriesChannel ?? ''}
          options={[
            { value: '', label: defaultChannelLabel },
            ...(channels.data?.channels ?? savedChannel).map((channel) => ({
              value: channel.id,
              label: `#${channel.name}`,
              ...(channel.category && { group: channel.category }),
            })),
          ]}
          onChange={(channelId) => setSeriesChannel(channelId || null)}
          noOptionsText={t('guildSettings.noChannelMatch')}
          hint={
            errorFor('channelId') ??
            (channels.isError ? t('eventForm.channelsUnavailable') : t('eventForm.channelHelp'))
          }
          disabled={channels.isPending || channels.isError}
        />
      )}
      <ChoiceGroup
        label={t('eventForm.tentativeDeadline')}
        size="small"
        value={draft.ownDeadline === null ? 'guild' : 'own'}
        onChange={(mode: 'guild' | 'own') =>
          change({
            ownDeadline: mode === 'guild' ? null : String(guild?.tentativeDeadlineHours ?? 24),
          })
        }
      >
        <ChoiceGroup.Option value="guild">
          {t('eventForm.tentativeDeadlineGuild', { hours: guild?.tentativeDeadlineHours ?? 24 })}
        </ChoiceGroup.Option>
        <ChoiceGroup.Option value="own">{t('eventForm.tentativeDeadlineOwn')}</ChoiceGroup.Option>
      </ChoiceGroup>
      {draft.ownDeadline !== null && (
        <TextField
          label={t('eventForm.tentativeDeadlineHours')}
          type="number"
          width={90}
          unit={t('eventForm.tentativeDeadlineUnit')}
          value={draft.ownDeadline}
          onChange={(ownDeadline) => change({ ownDeadline })}
          error={errorFor('tentativeDeadlineHours')}
        />
      )}
    </>
  );

  const slots = (
    <>
      {draft.type === 'raid' && (
        <ChoiceGroup
          label={t('eventForm.size')}
          value={String(draft.size)}
          onChange={(size: string) => resize('raid', Number(size))}
        >
          {RAID_SIZES.map((size) => (
            <ChoiceGroup.Option key={size} value={String(size)}>
              {size}
            </ChoiceGroup.Option>
          ))}
        </ChoiceGroup>
      )}
      {draft.type === 'pvp' && (
        <Stepper
          label={t('eventForm.size')}
          value={draft.size}
          min={PVP_MIN_SIZE}
          max={PVP_MAX_SIZE}
          onChange={(size) => change({ size })}
          decreaseLabel={t('eventForm.decrease', { what: t('eventForm.players') })}
          increaseLabel={t('eventForm.increase', { what: t('eventForm.players') })}
        />
      )}
      {draft.type === 'dungeon' && <Page.Text>{t('eventForm.dungeonFixed')}</Page.Text>}
      <div>
        <Page.Text>{t('eventForm.slots')}</Page.Text>
        {COMBAT_ROLES.map((role) => (
          <Stepper
            key={role}
            label={COMBAT_ROLE_PLURAL_NAMES[role]}
            dot={roleColor[role]}
            value={draft.slots[role]}
            max={PVP_MAX_SIZE}
            disabled={draft.type === 'dungeon'}
            onChange={(value) => change({ slots: { ...draft.slots, [role]: value } })}
            decreaseLabel={t('eventForm.decrease', { what: COMBAT_ROLE_NAMES[role] })}
            increaseLabel={t('eventForm.increase', { what: COMBAT_ROLE_NAMES[role] })}
          />
        ))}
      </div>
      <TotalMeter
        label={t('eventForm.total')}
        value={total}
        max={draft.size}
        segments={COMBAT_ROLES.map((role) => ({
          key: role,
          value: draft.slots[role],
          color: roleColor[role],
        }))}
        tone={slotProblem ? 'warn' : 'ok'}
        message={slotProblem ? validationIssueMessage(t, slotProblem) : t('eventForm.slotsAddUp')}
      />
    </>
  );

  return (
    <Page>
      <Page.Header>
        <div>
          <Button variant="text" startIcon="chevronLeft" onClick={back}>
            {t('eventForm.back')}
          </Button>
          <Page.Title>
            {!event
              ? t('eventForm.newTitle')
              : editingSeries
                ? t('eventForm.editSeriesTitle', { name: event.name })
                : t('eventForm.editTitle', { name: event.name })}
          </Page.Title>
        </div>
      </Page.Header>

      <FormColumns panel={slots}>{fields}</FormColumns>

      {canPreConfirm && (
        <PreConfirmSection
          guildId={guildId}
          slots={draft.slots}
          value={preConfirmed}
          onChange={setPreConfirmed}
          error={errorFor('preConfirmed')}
        />
      )}

      {losingCount > 0 && (
        <Notice tone="warn" title={t('eventForm.losingSlots', { count: losingCount })}>
          {losing.map(({ at, names }) => (
            <div key={at ?? 'event'}>
              {at
                ? t('eventForm.losingSlotsOn', {
                    date: format.dateTime(new Date(at)),
                    names: names.join(', '),
                  })
                : names.join(', ')}
            </div>
          ))}
        </Notice>
      )}
      {save.error && serverIssues.length === 0 && (
        <Notice tone="bad" title={t('eventForm.saveFailed')}>
          {apiErrorText(t, save.error)}
        </Notice>
      )}
      <Page.Footer>
        <Button
          variant="primary"
          size="medium"
          onClick={submit}
          disabled={save.isPending || localIssues.length > 0}
        >
          {event
            ? t('eventForm.save')
            : repeat
              ? t('eventForm.createSeries')
              : t('eventForm.create')}
        </Button>
        <Button size="medium" onClick={back}>
          {t('eventForm.cancel')}
        </Button>
        {saveHint && <Page.Muted>{saveHint}</Page.Muted>}
      </Page.Footer>
    </Page>
  );
}
