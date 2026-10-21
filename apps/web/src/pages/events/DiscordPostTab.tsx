import type { EventResponse } from '@wgm/shared';
import { Fragment, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { useEventDiscordPost } from '../../api/events';
import { useGuild } from '../../api/guilds';
import { guildPath } from '../../app/guildSelection';
import { Button, DiscordMessage, Loading, Notice, Page } from '../../components/ui';
import { useFormat } from '../../i18n/format';

type Format = ReturnType<typeof useFormat>;

/**
 * The event's Discord post: a preview built from the same embed the bot sends, whether the
 * guild has an events channel, why the bot couldn't post it, and a link to the real post.
 */
export function DiscordPostTab({ guildId, event }: { guildId: string; event: EventResponse }) {
  const { t } = useTranslation();
  const format = useFormat();
  const guild = useGuild(guildId);
  const post = useEventDiscordPost(guildId, event.id);

  if (post.isPending) return <Loading label={t('eventPage.post.loading')} />;
  if (post.isError) return <Notice tone="bad" title={t('eventPage.post.loadFailed')} />;

  const { channel, locale, embed } = post.data;
  const guildName = guild.data?.name ?? t('app.name');
  const { error, url } = event.discordPost;

  return (
    <Page.Stack>
      {!channel && (
        <Notice tone="warn" title={t('eventPage.post.noChannel')}>
          {t('eventPage.post.noChannelHelp')}
          {guild.data?.access === 'guild_master' && (
            <Button variant="text" to={guildPath(guildId, 'settings')}>
              {t('eventPage.post.chooseChannel')}
            </Button>
          )}
        </Notice>
      )}
      {channel && error && (
        <Notice tone="bad" title={t('eventPage.post.failed')}>
          {t(`eventPage.post.errors.${error}`, { channel: channelName(channel) })}
        </Notice>
      )}
      {channel && (
        <Page.Text>
          {t('eventPage.post.note', {
            channel: channelName(channel),
            language: t(`languages.${locale}`),
          })}
        </Page.Text>
      )}
      {url && (
        <Page.Inline>
          <Button href={url} newTab endIcon="external">
            {t('eventPage.post.open')}
          </Button>
        </Page.Inline>
      )}
      <DiscordMessage
        author={{ name: guildName, initials: guildName.slice(0, 2).toUpperCase() }}
        appLabel={t('eventPage.post.app')}
        embed={{
          color: `#${embed.color.toString(16).padStart(6, '0')}`,
          title: discordText(embed.title, format),
          description: embed.description && discordText(embed.description, format),
          fields: embed.fields.map((field) => ({
            name: discordText(field.name, format),
            value: discordText(field.value, format),
            inline: field.inline,
          })),
        }}
      />
    </Page.Stack>
  );
}

function channelName(channel: { id: string; name: string | null }) {
  return `#${channel.name ?? channel.id}`;
}

/** Bold, struck-through text, and timestamps: the Discord markdown the bot's posts use. */
const MARKDOWN = /\*\*(.+?)\*\*|~~(.+?)~~|<t:(\d+):([FR])>/g;

/**
 * Shows the post's text as Discord does: markdown as formatting, and timestamps in the app
 * user's time zone and language (each Discord reader sees their own).
 */
export function discordText(text: string, format: Format): ReactNode {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(MARKDOWN)) {
    parts.push(text.slice(last, match.index));
    const [, bold, struck, seconds, style] = match;
    if (bold !== undefined) parts.push(<strong>{bold}</strong>);
    else if (struck !== undefined) parts.push(<s>{struck}</s>);
    else {
      const date = new Date(Number(seconds) * 1000);
      parts.push(
        style === 'R'
          ? format.fromNow(date)
          : format.dateTime(date, { dateStyle: 'full', timeStyle: 'short' }),
      );
    }
    last = match.index + match[0].length;
  }
  parts.push(text.slice(last));
  return parts.map((part, index) => <Fragment key={index}>{part}</Fragment>);
}
