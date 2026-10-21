import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router';

import { useLogout, useMe } from '../api/me';
import { guildPath } from '../app/guildSelection';
import { Button, Splash } from '../components/ui';

/** For a user with access to more than one guild: choose which one to open. */
export function GuildPickerPage() {
  const { t } = useTranslation();
  const me = useMe().data;
  const logout = useLogout();
  const guilds = me?.guilds ?? [];

  if (guilds.length === 0) {
    return <Navigate to="/no-access" replace />;
  }

  return (
    <Splash
      initials="GM"
      title={t('guildPicker.title')}
      lead={me ? t('noAccess.signedInAs', { name: me.name }) : undefined}
    >
      <Splash.Note>{t('guildPicker.lead')}</Splash.Note>
      <Splash.List>
        {guilds.map((guild) => (
          <Splash.Choice
            key={guild.id}
            to={guildPath(guild.id, 'dashboard')}
            initials={guild.name.slice(0, 2).toUpperCase()}
            title={guild.name}
            detail={t('guildPicker.yourRank', {
              rank: guild.access === 'guild_master' ? 'Guild Master' : 'Officer',
            })}
          />
        ))}
      </Splash.List>
      <Splash.Actions>
        {me?.canCreateGuild && <Button href="/setup">{t('nav.createGuild')}</Button>}
        <Button onClick={() => logout.mutate()} disabled={logout.isPending}>
          {t('noAccess.otherAccount')}
        </Button>
      </Splash.Actions>
    </Splash>
  );
}
