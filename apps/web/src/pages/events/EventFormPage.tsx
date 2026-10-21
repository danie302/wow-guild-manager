import {
  COMBAT_ROLE_NAMES,
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
  toValidationIssues,
  type CombatRole,
  type CreateEventInput,
  type EventResponse,
  type EventType,
  type ValidationIssue,
} from '@wgm/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';

import { ApiRequestError } from '../../api/client';
import { useCreateEvent, useEvent, useUpdateEvent } from '../../api/events';
import { guildPath, useGuildIdParam } from '../../app/guildSelection';
import {
  Button,
  ChoiceGroup,
  FormGrid,
  Loading,
  Notice,
  Page,
  Stepper,
  TextField,
} from '../../components/ui';
import { apiErrorText, validationIssueMessage } from '../../i18n/api-errors';
import { fromZonedFields, toZonedFields } from '../../i18n/calendar';
import { useFormat } from '../../i18n/format';

type Slots = Record<CombatRole, number>;

interface Draft {
  type: EventType;
  name: string;
  description: string;
  date: string;
  time: string;
  size: number;
  slots: Slots;
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

/** Creates an event, or edits one (`events/:eventId/edit`) that hasn't started. */
export function EventFormPage() {
  const { t } = useTranslation();
  const guildId = useGuildIdParam()!;
  const eventId = useParams().eventId;
  const event = useEvent(guildId, eventId ?? '');

  if (!eventId) return <EventForm guildId={guildId} />;
  if (event.isPending) return <Loading label={t('events.loading')} />;
  if (event.isError) return <Notice tone="bad" title={t('events.loadFailed')} />;
  if (event.data.cancelled || new Date(event.data.startsAt) <= new Date()) {
    return <Notice tone="warn" title={t('eventForm.readOnly')} />;
  }
  return <EventForm guildId={guildId} event={event.data} />;
}

function EventForm({ guildId, event }: { guildId: string; event?: EventResponse }) {
  const { t } = useTranslation();
  const format = useFormat();
  const navigate = useNavigate();
  const create = useCreateEvent(guildId);
  const update = useUpdateEvent(guildId, event?.id ?? '');
  const save = event ? update : create;
  const [submitted, setSubmitted] = useState(false);
  const [draft, setDraft] = useState<Draft>(() =>
    event
      ? {
          type: event.type,
          name: event.name,
          description: event.description,
          ...toZonedFields(new Date(event.startsAt), format.timeZone),
          size: event.size,
          slots: { ...event.slots },
        }
      : {
          type: 'raid',
          name: '',
          description: '',
          date: '',
          time: '',
          size: defaultSize.raid,
          slots: defaultSlots('raid', defaultSize.raid),
        },
  );
  const change = (changes: Partial<Draft>) => setDraft((current) => ({ ...current, ...changes }));
  const resize = (type: EventType, size: number) =>
    change({ type, size, slots: defaultSlots(type, size) });

  const startsAt = fromZonedFields(draft.date, draft.time, format.timeZone);
  const input: CreateEventInput = {
    type: draft.type,
    name: draft.name,
    description: draft.description,
    startsAt: startsAt?.toISOString() ?? '',
    size: draft.size,
    slots: draft.slots,
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
  const errorFor = (field: string) => {
    const issue = [...(submitted ? localIssues : []), ...serverIssues].find(
      (candidate) => candidate.field === field || candidate.field.startsWith(`${field}.`),
    );
    return issue && validationIssueMessage(t, issue);
  };
  const total = draft.slots.tank + draft.slots.healer + draft.slots.dps;
  const slotProblem = eventSlotIssues(draft.type, draft)[0];

  const submit = () => {
    setSubmitted(true);
    if (localIssues.length > 0) return;
    const done = {
      onSuccess: (saved: EventResponse) => void navigate(guildPath(guildId, `events/${saved.id}`)),
    };
    if (!event) return create.mutate(input, done);
    const { name, description, startsAt: start, size, slots } = input;
    update.mutate({ name, description, startsAt: start, size, slots }, done);
  };
  const back = () => void navigate(guildPath(guildId, event ? `events/${event.id}` : 'events'));

  return (
    <Page>
      <Page.Header>
        <div>
          <Button onClick={back}>{t('eventForm.back')}</Button>
          <Page.Title>
            {event ? t('eventForm.editTitle', { name: event.name }) : t('eventForm.newTitle')}
          </Page.Title>
        </div>
      </Page.Header>

      <Page.Section title={t('eventForm.details')}>
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
        <FormGrid>
          <FormGrid.Wide>
            <TextField
              label={t('eventForm.name')}
              value={draft.name}
              onChange={(name) => change({ name })}
              maxLength={EVENT_NAME_MAX_LENGTH}
              placeholder={t('eventForm.namePlaceholder')}
              error={errorFor('name')}
            />
          </FormGrid.Wide>
          <FormGrid.Wide>
            <TextField
              label={t('eventForm.description')}
              multiline
              value={draft.description}
              onChange={(description) => change({ description })}
              maxLength={EVENT_DESCRIPTION_MAX_LENGTH}
              hint={t('eventForm.descriptionHint')}
              error={errorFor('description')}
            />
          </FormGrid.Wide>
          <TextField
            label={t('eventForm.date')}
            type="date"
            value={draft.date}
            onChange={(date) => change({ date })}
            error={errorFor('startsAt')}
          />
          <TextField
            label={t('eventForm.time')}
            type="time"
            value={draft.time}
            onChange={(time) => change({ time })}
            hint={t('eventForm.timeZone', { timeZone: format.timeZone })}
          />
        </FormGrid>
      </Page.Section>

      <Page.Section title={t('eventForm.size')}>
        {draft.type === 'raid' && (
          <ChoiceGroup
            label={t('eventForm.size')}
            hideLabel
            value={String(draft.size)}
            onChange={(size: string) => resize('raid', Number(size))}
          >
            {RAID_SIZES.map((size) => (
              <ChoiceGroup.Option key={size} value={String(size)}>
                {t('events.players', { count: size })}
              </ChoiceGroup.Option>
            ))}
          </ChoiceGroup>
        )}
        {draft.type === 'pvp' && (
          <Stepper
            label={t('eventForm.players')}
            value={draft.size}
            min={PVP_MIN_SIZE}
            max={PVP_MAX_SIZE}
            onChange={(size) => change({ size })}
            decreaseLabel={t('eventForm.decrease', { what: t('eventForm.players') })}
            increaseLabel={t('eventForm.increase', { what: t('eventForm.players') })}
          />
        )}
        {draft.type === 'dungeon' && <Page.Text>{t('eventForm.dungeonFixed')}</Page.Text>}

        {COMBAT_ROLES.map((role) => (
          <Stepper
            key={role}
            label={COMBAT_ROLE_NAMES[role]}
            value={draft.slots[role]}
            max={PVP_MAX_SIZE}
            disabled={draft.type === 'dungeon'}
            onChange={(value) => change({ slots: { ...draft.slots, [role]: value } })}
            decreaseLabel={t('eventForm.decrease', { what: COMBAT_ROLE_NAMES[role] })}
            increaseLabel={t('eventForm.increase', { what: COMBAT_ROLE_NAMES[role] })}
          />
        ))}
        <Notice
          tone={slotProblem ? 'warn' : 'ok'}
          title={t('eventForm.total', { total, size: draft.size })}
        >
          {slotProblem && validationIssueMessage(t, slotProblem)}
          {errorFor('size')}
        </Notice>
      </Page.Section>

      {save.error && serverIssues.length === 0 && (
        <Notice tone="bad" title={t('eventForm.saveFailed')}>
          {apiErrorText(t, save.error)}
        </Notice>
      )}
      <div>
        <Button variant="primary" onClick={submit} disabled={save.isPending}>
          {event ? t('eventForm.save') : t('eventForm.create')}
        </Button>{' '}
        <Button onClick={back}>{t('eventForm.cancel')}</Button>
      </div>
    </Page>
  );
}
