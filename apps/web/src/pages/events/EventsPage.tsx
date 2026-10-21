import { COMBAT_ROLE_NAMES, type EventResponse } from '@wgm/shared';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';

import { useEvents, type EventsQuery } from '../../api/events';
import { guildPath, useGuildIdParam } from '../../app/guildSelection';
import {
  AgendaList,
  Button,
  ChoiceGroup,
  Loading,
  MonthCalendar,
  Notice,
  Page,
  Tag,
  type MonthCalendarEntry,
} from '../../components/ui';
import {
  addMonths,
  dayInTimeZone,
  dayKey,
  firstWeekday,
  monthWeeks,
  noonUtc,
  utcRangeAround,
  type CalendarDay,
} from '../../i18n/calendar';
import { useFormat } from '../../i18n/format';

type View = 'list' | 'calendar';
type When = 'upcoming' | 'past';

const typeTone: Record<EventResponse['type'], MonthCalendarEntry['tone']> = {
  raid: 'accent',
  dungeon: 'ok',
  pvp: 'warn',
};

/**
 * The guild's events, as a list (upcoming or past) or as a month calendar. The view, list, and
 * month are in the URL, so going back to the page keeps them.
 */
export function EventsPage() {
  const { t } = useTranslation();
  const guildId = useGuildIdParam()!;
  const [params, setParams] = useSearchParams();
  const view: View = params.get('view') === 'calendar' ? 'calendar' : 'list';
  const when: When = params.get('when') === 'past' ? 'past' : 'upcoming';
  const set = (changes: Record<string, string>) =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      for (const [key, value] of Object.entries(changes)) next.set(key, value);
      return next;
    });

  return (
    <Page>
      <Page.Header>
        <Page.Title>{t('events.title')}</Page.Title>
        <ChoiceGroup
          label={t('events.view')}
          hideLabel
          value={view}
          onChange={(next: View) => set({ view: next })}
        >
          <ChoiceGroup.Option value="list">{t('events.list')}</ChoiceGroup.Option>
          <ChoiceGroup.Option value="calendar">{t('events.calendar')}</ChoiceGroup.Option>
        </ChoiceGroup>
        <Button variant="primary" to={guildPath(guildId, 'events/new')}>
          {t('events.new')}
        </Button>
      </Page.Header>

      {view === 'list' ? (
        <>
          <ChoiceGroup
            label={t('events.when')}
            hideLabel
            value={when}
            onChange={(next: When) => set({ when: next })}
          >
            <ChoiceGroup.Option value="upcoming">{t('events.upcoming')}</ChoiceGroup.Option>
            <ChoiceGroup.Option value="past">{t('events.past')}</ChoiceGroup.Option>
          </ChoiceGroup>
          <EventList guildId={guildId} when={when} />
        </>
      ) : (
        <EventCalendar
          guildId={guildId}
          month={params.get('month')}
          onMonth={(month) => set({ month })}
        />
      )}
    </Page>
  );
}

function EventList({ guildId, when }: { guildId: string; when: When }) {
  const { t } = useTranslation();
  const format = useFormat();
  const events = useEvents(guildId, { scope: when });
  if (events.isPending) return <Loading label={t('events.loading')} />;
  if (events.isError) return <Notice tone="bad" title={t('events.loadFailed')} />;

  return (
    <AgendaList
      label={t(when === 'upcoming' ? 'events.upcoming' : 'events.past')}
      empty={t(when === 'upcoming' ? 'events.noUpcoming' : 'events.noPast')}
    >
      {events.data.map((event) => {
        const startsAt = new Date(event.startsAt);
        return (
          <AgendaList.Item
            key={event.id}
            to={guildPath(guildId, `events/${event.id}`)}
            date={{
              weekday: format.parts(startsAt, { weekday: 'short' }),
              day: format.parts(startsAt, { day: 'numeric' }),
              month: format.parts(startsAt, { month: 'short' }),
            }}
            title={event.name}
            struck={event.cancelled !== null}
            detail={
              <>
                {format.shortTime(startsAt)} · {t(`events.types.${event.type}`)} ·{' '}
                {t('events.players', { count: event.size })}
                <br />
                {slotsText(event)}
              </>
            }
            aside={event.cancelled && <Tag tone="bad">{t('events.cancelled')}</Tag>}
          />
        );
      })}
    </AgendaList>
  );
}

/** "4 Tank · 10 Healer · 26 DPS", leaving out roles without slots. */
function slotsText({ slots }: EventResponse): string {
  return (['tank', 'healer', 'dps'] as const)
    .filter((role) => slots[role] > 0)
    .map((role) => `${slots[role]} ${COMBAT_ROLE_NAMES[role]}`)
    .join(' · ');
}

function EventCalendar({
  guildId,
  month: monthParam,
  onMonth,
}: {
  guildId: string;
  month: string | null;
  onMonth: (month: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const format = useFormat();
  const today = dayInTimeZone(new Date(), format.timeZone);
  const month = parseMonth(monthParam) ?? { ...today, day: 1 };
  const weeks = monthWeeks(month, firstWeekday(i18n.language));
  const range = utcRangeAround(weeks[0]![0]!, weeks.at(-1)!.at(-1)!);
  const events = useEvents(guildId, range satisfies EventsQuery);

  // Each event goes on the day it starts in the user's time zone.
  const byDay = new Map<string, MonthCalendarEntry[]>();
  for (const event of events.data ?? []) {
    const startsAt = new Date(event.startsAt);
    const key = dayKey(dayInTimeZone(startsAt, format.timeZone));
    byDay.set(key, [
      ...(byDay.get(key) ?? []),
      {
        key: event.id,
        to: guildPath(guildId, `events/${event.id}`),
        label: event.name,
        detail: format.shortTime(startsAt),
        struck: event.cancelled !== null,
        tone: event.cancelled ? 'muted' : typeTone[event.type],
      },
    ]);
  }
  const utcDay = (day: CalendarDay, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(i18n.language, { ...options, timeZone: 'UTC' }).format(noonUtc(day));

  return (
    <>
      {events.isError && <Notice tone="bad" title={t('events.loadFailed')} />}
      <MonthCalendar
        title={utcDay(month, { month: 'long', year: 'numeric' })}
        weekdays={weeks[0]!.map((day) => utcDay(day, { weekday: 'short' }))}
        weeks={weeks.map((week) =>
          week.map((day) => ({
            key: dayKey(day),
            number: day.day,
            inMonth: day.month === month.month,
            today: dayKey(day) === dayKey(today),
            entries: byDay.get(dayKey(day)) ?? [],
          })),
        )}
        onPrevious={() => onMonth(monthParamOf(addMonths(month, -1)))}
        onNext={() => onMonth(monthParamOf(addMonths(month, 1)))}
        previousLabel={t('events.previousMonth')}
        nextLabel={t('events.nextMonth')}
      />
    </>
  );
}

/** "2026-11" in the URL. */
function parseMonth(value: string | null): CalendarDay | null {
  const match = value?.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const month = Number(match[2]);
  return month >= 1 && month <= 12 ? { year: Number(match[1]), month, day: 1 } : null;
}

function monthParamOf({ year, month }: CalendarDay): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}
