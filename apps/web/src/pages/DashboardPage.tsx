import { COMBAT_ROLE_NAMES, COMBAT_ROLE_PLURAL_NAMES, COMBAT_ROLES, RANK_NAMES } from '@wgm/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useDashboard } from '../api/guilds';
import { guildPath, useGuildIdParam } from '../app/guildSelection';
import {
  AttentionList,
  Button,
  CharacterName,
  Loading,
  MeterList,
  Notice,
  Page,
  Tag,
  TileGrid,
} from '../components/ui';
import { useFormat } from '../i18n/format';
import { roleColor, whenText } from './events/eventText';

/**
 * The Guild Master's and Officers' home page: the next events and how full they are, and what
 * needs attention, each linking to where it's handled. The gear check section comes with
 * story 031.
 */
export function DashboardPage() {
  const { t } = useTranslation();
  const format = useFormat();
  // GuildRoute has checked that the user can open this guild.
  const guildId = useGuildIdParam()!;
  const dashboard = useDashboard(guildId);
  // When the page was opened, for "Closes in 6 h".
  const [now] = useState(() => Date.now());
  const path = (to: string) => guildPath(guildId, to);

  return (
    <Page>
      <Page.Header>
        <div>
          <Page.Muted>{format.parts(new Date(), { dateStyle: 'full' })}</Page.Muted>
          <Page.Title>{t('nav.dashboard')}</Page.Title>
        </div>
        <Page.Actions>
          <Button variant="primary" size="medium" startIcon="plus" to={path('events/new')}>
            {t('events.new')}
          </Button>
        </Page.Actions>
      </Page.Header>

      {dashboard.isPending ? (
        <Loading label={t('dashboard.loading')} />
      ) : dashboard.isError ? (
        <Notice tone="bad" title={t('dashboard.loadFailed')} />
      ) : (
        <>
          <Page.Section title={t('dashboard.upcoming')}>
            <Page.Inline>
              <Button variant="text" to={path('events')}>
                {t('dashboard.viewAll')}
              </Button>
            </Page.Inline>
            {dashboard.data.upcoming.length === 0 ? (
              <Page.Text>{t('events.noUpcoming')}</Page.Text>
            ) : (
              <TileGrid label={t('dashboard.upcoming')}>
                {dashboard.data.upcoming.map((event) => {
                  const filled = COMBAT_ROLES.reduce((sum, role) => sum + event.filled[role], 0);
                  const missing = event.size - filled;
                  return (
                    <TileGrid.Card
                      key={event.id}
                      to={path(`events/${event.id}`)}
                      eyebrow={whenText(format, new Date(event.startsAt))}
                      title={event.name}
                      struck={event.cancelled}
                      meta={`${t(`events.types.${event.type}`)} · ${t('events.players', { count: event.size })}`}
                      footer={
                        <>
                          <span>{t('dashboard.signedUp', { filled, size: event.size })}</span>
                          {event.cancelled ? (
                            <Tag tone="bad">{t('events.cancelled')}</Tag>
                          ) : missing > 0 ? (
                            <Tag tone="warn">{t('eventPage.missing', { count: missing })}</Tag>
                          ) : (
                            <Tag>{t('eventPage.full')}</Tag>
                          )}
                        </>
                      }
                    >
                      <MeterList
                        label={t('eventPage.slots')}
                        items={COMBAT_ROLES.filter((role) => event.slots[role] > 0).map((role) => ({
                          key: role,
                          label: COMBAT_ROLE_PLURAL_NAMES[role],
                          value: event.filled[role],
                          max: event.slots[role],
                          color: roleColor[role],
                        }))}
                      />
                    </TileGrid.Card>
                  );
                })}
              </TileGrid>
            )}
          </Page.Section>

          <Page.Columns>
            <AttentionList
              title={t('dashboard.missingRoles')}
              count={dashboard.data.missingRoles.length}
              empty={t('dashboard.none')}
            >
              {dashboard.data.missingRoles.map((event) => (
                <AttentionList.Item
                  key={event.id}
                  to={path(`events/${event.id}`)}
                  title={event.name}
                  detail={`${whenText(format, new Date(event.startsAt))} · ${t('events.players', { count: event.size })}`}
                >
                  {COMBAT_ROLES.filter((role) => event.missing[role] > 0).map((role) => (
                    <Tag key={role} tone="warn">
                      {event.missing[role]}{' '}
                      {event.missing[role] === 1
                        ? COMBAT_ROLE_NAMES[role]
                        : COMBAT_ROLE_PLURAL_NAMES[role]}
                    </Tag>
                  ))}
                </AttentionList.Item>
              ))}
            </AttentionList>

            <AttentionList
              title={t('dashboard.tentative')}
              count={dashboard.data.tentative.length}
              empty={t('dashboard.none')}
            >
              {dashboard.data.tentative.map((entry) => (
                <AttentionList.Item
                  key={entry.signUpId}
                  to={path(`events/${entry.eventId}`)}
                  title={
                    <CharacterName
                      name={entry.character.name}
                      characterClass={entry.character.class}
                    />
                  }
                  detail={`${entry.eventName} · ${whenText(format, new Date(entry.startsAt))} · ${COMBAT_ROLE_NAMES[entry.role]}`}
                >
                  <Tag tone="warn">
                    {t('dashboard.closesIn', {
                      hours: Math.max(
                        1,
                        Math.round((new Date(entry.deadlineAt).getTime() - now) / 3_600_000),
                      ),
                    })}
                  </Tag>
                </AttentionList.Item>
              ))}
            </AttentionList>

            <AttentionList
              title={t('dashboard.registrations')}
              count={dashboard.data.registrations.length}
              empty={t('dashboard.none')}
            >
              {dashboard.data.registrations.map((registration) => (
                <AttentionList.Item
                  key={registration.id}
                  to={path('registrations')}
                  title={registration.discordName}
                  detail={t('dashboard.requested', {
                    when: format.relative(new Date(registration.requestedAt)),
                  })}
                />
              ))}
            </AttentionList>

            <AttentionList
              title={t('dashboard.leftDiscord')}
              count={dashboard.data.leftDiscord.length}
              tone="bad"
              empty={t('dashboard.none')}
            >
              {dashboard.data.leftDiscord.map((member) => (
                <AttentionList.Item
                  key={member.memberId}
                  to={path(`roster/${member.memberId}`)}
                  title={member.discordName}
                  detail={
                    <>
                      {member.main && (
                        <CharacterName name={member.main.name} characterClass={member.main.class} />
                      )}{' '}
                      · {RANK_NAMES[member.rank]}
                    </>
                  }
                >
                  <Tag tone="bad">
                    {t('roster.leftDiscord', { date: format.date(new Date(member.leftAt)) })}
                  </Tag>
                </AttentionList.Item>
              ))}
            </AttentionList>
          </Page.Columns>
        </>
      )}
    </Page>
  );
}
