import {
  uuidSchema,
  type ApproveRegistrationResponse,
  type PendingRegistration,
} from '@wgm/shared';
import express from 'express';

import { discordAvatarUrl } from '../auth/discord-oauth.js';
import { Member, Registration } from '../db/models/index.js';
import { DomainError } from '../domain/errors.js';
import { approveRegistration, rejectRegistration } from '../domain/registrations.js';
import type { JobEnqueuer } from '../jobs/index.js';
import { currentGuild, requireGuildPermission } from './guild-access.js';
import { currentUser, requireUser } from './me.js';

/** Requests to join the roster, made with /register, for the Guild Master and Officers. */
export function registrationsRouter(jobs: JobEnqueuer) {
  const router = express.Router();
  const base = '/guilds/:guildId/registrations';

  router.get(base, requireUser, requireGuildPermission('addCharacters'), async (_req, res) => {
    const { guild } = currentGuild(res);
    const registrations = await Registration.findAll({
      where: { guildId: guild.id, status: 'pending' },
      order: [['createdAt', 'ASC']],
    });
    // Whether each person is on the roster now, or was removed from it.
    const members = await Member.findAll({
      where: {
        guildId: guild.id,
        discordUserId: registrations.map((registration) => registration.discordUserId),
      },
      attributes: ['discordUserId', 'removedAt'],
    });
    const memberOf = new Map(members.map((member) => [member.discordUserId, member]));
    res.json(
      registrations.map((registration) => {
        const member = memberOf.get(registration.discordUserId);
        return {
          id: registration.id,
          discordUserId: registration.discordUserId,
          discordName: registration.discordName,
          avatarUrl: discordAvatarUrl(registration.discordUserId, registration.discordAvatar),
          onRoster: member !== undefined && !member.removedAt,
          returning: member !== undefined && member.removedAt !== null,
          requestedAt: registration.createdAt.toISOString(),
        };
      }) satisfies PendingRegistration[],
    );
  });

  router.post(
    `${base}/:registrationId/approve`,
    requireUser,
    requireGuildPermission('addCharacters'),
    async (req, res) => {
      const { guild } = currentGuild(res);
      const { registration, member, restored } = await approveRegistration(
        guild,
        registrationId(req.params.registrationId),
        currentUser(res),
      );
      await jobs.enqueue('registration-reviewed', { registrationId: registration.id });
      res.json({ memberId: member.id, restored } satisfies ApproveRegistrationResponse);
    },
  );

  router.post(
    `${base}/:registrationId/reject`,
    requireUser,
    requireGuildPermission('addCharacters'),
    async (req, res) => {
      const { guild } = currentGuild(res);
      const registration = await rejectRegistration(
        guild,
        registrationId(req.params.registrationId),
        currentUser(res),
      );
      await jobs.enqueue('registration-reviewed', { registrationId: registration.id });
      res.status(204).end();
    },
  );

  return router;
}

function registrationId(id: unknown): string {
  if (!uuidSchema.safeParse(id).success) throw new DomainError({ code: 'NOT_FOUND' });
  return id as string;
}
