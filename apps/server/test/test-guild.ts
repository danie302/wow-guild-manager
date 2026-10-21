import type { Faction } from '@wgm/shared';

import type { User } from '../src/db/models/index.js';
import { createGuild } from '../src/domain/guilds.js';
import { FakeDiscordDirectory, MANAGE_GUILD, role, server } from './fake-discord-directory.js';

export const OFFICER_ROLE_ID = '400000000000000001';

/** A guild led by `leader` on the Discord server `serverId`, with an "Officers" role. */
export async function createTestGuild(
  leader: User,
  {
    serverId,
    faction = 'horde',
    name = 'Horde',
  }: { serverId: string; faction?: Faction; name?: string },
) {
  const admins = '400000000000000002';
  const discord = new FakeDiscordDirectory()
    .addServer(
      server(serverId, 'Server', {
        roles: [
          role(OFFICER_ROLE_ID, 'Officers'),
          role(admins, 'Admins', { permissions: MANAGE_GUILD }),
        ],
      }),
    )
    .addMember(serverId, leader.discordId, [admins]);
  return createGuild(
    leader,
    { name, faction, discordServerId: serverId, officerRoleId: OFFICER_ROLE_ID },
    discord,
  );
}
