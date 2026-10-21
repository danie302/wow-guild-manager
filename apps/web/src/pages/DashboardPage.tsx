import { useTranslation } from 'react-i18next';

import { useGuild } from '../api/guilds';
import { useGuildIdParam } from '../app/guildSelection';
import { DetailList, Loading, Notice, Page } from '../components/ui';

/** The Guild Master's and Officers' home page. Story 034 fills it in. */
export function DashboardPage() {
  const { t } = useTranslation();
  // GuildRoute has checked that the user can open this guild.
  const guild = useGuild(useGuildIdParam());

  if (guild.isPending) {
    return <Loading label={t('dashboard.loading')} />;
  }
  if (guild.isError) {
    return <Notice tone="bad" title={t('dashboard.loadFailed')} />;
  }

  const { name, faction, discordServer, officerRole } = guild.data;
  return (
    <Page>
      <Page.Header>
        <Page.Title>{name}</Page.Title>
      </Page.Header>
      <Page.Section title={t('nav.dashboard')}>
        <p>{t('dashboard.lead')}</p>
        <DetailList>
          <DetailList.Item label={t('dashboard.faction')}>
            {t(`factions.${faction}`)}
          </DetailList.Item>
          <DetailList.Item label={t('dashboard.discordServer')}>
            {discordServer.name ?? t('dashboard.unavailable')}
          </DetailList.Item>
          <DetailList.Item label={t('dashboard.officerRole')}>
            {officerRole.name ?? t('dashboard.unavailable')}
          </DetailList.Item>
        </DetailList>
      </Page.Section>
    </Page>
  );
}
