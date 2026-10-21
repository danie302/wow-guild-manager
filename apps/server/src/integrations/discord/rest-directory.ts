import {
  ChannelType,
  DiscordAPIError,
  OverwriteType,
  REST,
  Routes,
  type APIGuild,
  type APIOverwrite,
  type APIGuildMember,
  type RESTGetAPICurrentUserGuildsResult,
} from 'discord.js';

import {
  DiscordUnavailableError,
  type DiscordChannel,
  type DiscordDirectory,
  type DiscordMember,
  type DiscordMemberProfile,
  type DiscordServer,
  type DiscordServerSummary,
} from './directory.js';

/** Discord returns at most this many servers, or members, per page. */
const SERVERS_PER_PAGE = 200;
const MEMBERS_PER_PAGE = 1000;

/** Reads Discord's REST API with the bot token. discord.js's REST client waits out rate limits. */
export function createRestDiscordDirectory(botToken: string): DiscordDirectory {
  const rest = new REST({ version: '10' }).setToken(botToken);

  return {
    async botServers() {
      const servers: DiscordServerSummary[] = [];
      let after: string | undefined;
      for (;;) {
        const query = new URLSearchParams({ limit: String(SERVERS_PER_PAGE) });
        if (after) query.set('after', after);
        const page = (await call(() =>
          rest.get(Routes.userGuilds(), { query }),
        )) as RESTGetAPICurrentUserGuildsResult;
        servers.push(...page.map(({ id, name, icon }) => ({ id, name, icon })));
        if (page.length < SERVERS_PER_PAGE) return servers;
        after = page.at(-1)!.id;
      }
    },

    async server(serverId) {
      const guild = (await callOrNull(() => rest.get(Routes.guild(serverId)))) as APIGuild | null;
      return guild && toServer(guild);
    },

    async member(serverId, userId) {
      const member = (await callOrNull(() =>
        rest.get(Routes.guildMember(serverId, userId)),
      )) as APIGuildMember | null;
      return member && ({ ...toProfile(member), roleIds: member.roles } satisfies DiscordMember);
    },

    async searchMembers(serverId, query, limit) {
      const members = (await call(() =>
        rest.get(Routes.guildMembersSearch(serverId), {
          query: new URLSearchParams({ query, limit: String(limit) }),
        }),
      )) as APIGuildMember[];
      return members.map(toProfile);
    },

    async channels(serverId) {
      const channels = (await callOrNull(() => rest.get(Routes.guildChannels(serverId)))) as
        RawChannel[] | null;
      return (channels ?? []).map(toChannel);
    },

    async membersWithRole(serverId, roleId) {
      const ids: string[] = [];
      let after = '0';
      for (;;) {
        const query = new URLSearchParams({ limit: String(MEMBERS_PER_PAGE), after });
        const page = (await call(() =>
          rest.get(Routes.guildMembers(serverId), { query }),
        )) as APIGuildMember[];
        ids.push(...page.filter((member) => member.roles.includes(roleId)).map(memberId));
        if (page.length < MEMBERS_PER_PAGE) return ids;
        after = memberId(page.at(-1)!);
      }
    },
  };
}

function toProfile(member: APIGuildMember): DiscordMemberProfile {
  return {
    id: member.user.id,
    name: member.nick ?? member.user.global_name ?? member.user.username,
    avatar: member.user.avatar,
  };
}

function memberId(member: APIGuildMember): string {
  return member.user.id;
}

const CHANNEL_TYPES: Partial<Record<ChannelType, DiscordChannel['type']>> = {
  [ChannelType.GuildText]: 'text',
  [ChannelType.GuildAnnouncement]: 'announcement',
  [ChannelType.GuildCategory]: 'category',
};

/** The fields we read from each of a server's channels (their shape depends on the type). */
interface RawChannel {
  id: string;
  name: string;
  type: ChannelType;
  position?: number;
  parent_id?: string | null;
  permission_overwrites?: APIOverwrite[];
}

function toChannel(channel: RawChannel): DiscordChannel {
  return {
    id: channel.id,
    name: channel.name,
    type: CHANNEL_TYPES[channel.type] ?? 'other',
    position: channel.position ?? 0,
    parentId: channel.parent_id ?? null,
    overwrites: (channel.permission_overwrites ?? []).map((overwrite) => ({
      id: overwrite.id,
      type: overwrite.type === OverwriteType.Member ? 'member' : 'role',
      allow: BigInt(overwrite.allow),
      deny: BigInt(overwrite.deny),
    })),
  };
}

function toServer(guild: APIGuild): DiscordServer {
  return {
    id: guild.id,
    name: guild.name,
    icon: guild.icon,
    ownerId: guild.owner_id,
    roles: guild.roles.map((role) => ({
      id: role.id,
      name: role.name,
      color: role.color,
      position: role.position,
      permissions: BigInt(role.permissions),
      managed: role.managed,
    })),
  };
}

async function call<T>(request: () => Promise<T>): Promise<T> {
  try {
    return await request();
  } catch (err) {
    throw new DiscordUnavailableError('Discord request failed', { cause: err });
  }
}

/** Like `call`, but a missing server or member (404, or 403 when the bot isn't in it) is null. */
async function callOrNull<T>(request: () => Promise<T>): Promise<T | null> {
  try {
    return await request();
  } catch (err) {
    if (err instanceof DiscordAPIError && (err.status === 404 || err.status === 403)) {
      return null;
    }
    throw new DiscordUnavailableError('Discord request failed', { cause: err });
  }
}
