import { EVENT_TYPES, type AttendanceRate, type Locale } from '@wgm/shared';
import { InteractionContextType, MessageFlags, SlashCommandBuilder } from 'discord.js';

import { memberAttendance } from '../../domain/reports.js';
import { memberOnServer } from '../../domain/roster.js';
import { translator, type Translate } from '../../i18n/index.js';
import { discordLocalizations } from '../locale.js';
import type { SlashCommand } from './types.js';

const en = translator('en');
/** How many of their latest events the reply lists. */
const RECENT_EVENTS = 10;
/** The guild's accent, as on event posts. */
const COLOR = 0xdcae55;

/**
 * `/attendance`: the member sees their own attendance rate for the last 8 weeks and all time,
 * per event type, their late arrivals and no-shows, and their latest events. Only they see it.
 */
export const attendance: SlashCommand = {
  definition: new SlashCommandBuilder()
    .setName('attendance')
    .setDescription(en('commands.attendance.description'))
    .setDescriptionLocalizations(discordLocalizations('commands.attendance.description'))
    .setContexts(InteractionContextType.Guild)
    .toJSON(),

  async execute(interaction, { locale, t }) {
    const reply = (content: string) =>
      interaction.reply({ content, flags: MessageFlags.Ephemeral });
    if (!interaction.inGuild()) return void (await reply(t('commands.attendance.noGuild')));

    const { guild, member } = await memberOnServer(interaction.guildId, interaction.user.id);
    if (!guild) return void (await reply(t('commands.attendance.noGuild')));
    if (!member) {
      return void (await reply(t('commands.attendance.notOnRoster', { guild: guild.name })));
    }

    const [recent, allTime] = await Promise.all([
      memberAttendance(member, guild, '8'),
      memberAttendance(member, guild, 'all'),
    ]);
    if (allTime.overall.total === 0) {
      return void (await reply(t('commands.attendance.noRecords', { guild: guild.name })));
    }

    const rate = (value: AttendanceRate) => rateLine(value, locale, t);
    await interaction.reply({
      embeds: [
        {
          title: t('commands.attendance.title', { guild: guild.name }),
          color: COLOR,
          fields: [
            {
              name: t('commands.attendance.recent'),
              value: [
                rate(recent.overall),
                ...(recent.overall.band
                  ? [t(`commands.attendance.bands.${recent.overall.band}`)]
                  : []),
              ].join(' · '),
              inline: true,
            },
            { name: t('commands.attendance.allTime'), value: rate(allTime.overall), inline: true },
            {
              name: t('commands.attendance.byType'),
              value: EVENT_TYPES.map(
                (type) => `${t(`commands.attendance.types.${type}`)}: ${rate(recent.byType[type])}`,
              ).join('\n'),
            },
            {
              name: t('commands.attendance.counts'),
              value: t('commands.attendance.countsValue', {
                late: recent.late,
                noShow: recent.noShow,
              }),
            },
            {
              name: t('commands.attendance.latest'),
              value: allTime.history
                .slice(0, RECENT_EVENTS)
                .map(
                  (row) =>
                    `<t:${Math.floor(new Date(row.startsAt).getTime() / 1000)}:d> **${row.name}** – ${t(`commands.attendance.statuses.${row.status}`)}`,
                )
                .join('\n'),
            },
          ],
          footer: { text: t('commands.attendance.footer') },
        },
      ],
      flags: MessageFlags.Ephemeral,
    });
  },
};

/** "92% (11 of 12)", or "—" without records. */
function rateLine({ attended, total, rate }: AttendanceRate, locale: Locale, t: Translate) {
  if (rate === null) return '—';
  const percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 });
  return t('commands.attendance.rate', { rate: percent.format(rate), attended, total });
}
