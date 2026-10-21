import { approveRegistrationSchema, uuidSchema, type PendingRegistration } from '@wgm/shared';
import express from 'express';

import { discordAvatarUrl } from '../auth/discord-oauth.js';
import { CharacterRegistration, Member } from '../db/models/index.js';
import { DomainError } from '../domain/errors.js';
import { approveRegistration, rejectRegistration } from '../domain/registrations.js';
import type { JobEnqueuer } from '../jobs/index.js';
import { parseBody } from './errors.js';
import { currentGuild, requireGuildPermission } from './guild-access.js';
import { currentUser, requireUser } from './me.js';

/** Characters registered with /register, for the Guild Master and Officers to review. */
export function registrationsRouter(jobs: JobEnqueuer) {
  const router = express.Router();
  const base = '/guilds/:guildId/registrations';

  router.get(base, requireUser, requireGuildPermission('addCharacters'), async (_req, res) => {
    const { guild } = currentGuild(res);
    const registrations = await CharacterRegistration.findAll({
      where: { guildId: guild.id, status: 'pending' },
      order: [['createdAt', 'ASC']],
    });
    const onRoster = new Set(
      (
        await Member.findAll({
          where: {
            guildId: guild.id,
            removedAt: null,
            discordUserId: registrations.map((registration) => registration.discordUserId),
          },
          attributes: ['discordUserId'],
        })
      ).map((member) => member.discordUserId),
    );
    res.json(
      registrations.map((registration) =>
        toPendingRegistration(registration, onRoster.has(registration.discordUserId)),
      ) satisfies PendingRegistration[],
    );
  });

  router.post(
    `${base}/:registrationId/approve`,
    requireUser,
    requireGuildPermission('addCharacters'),
    async (req, res) => {
      const { guild } = currentGuild(res);
      const input = parseBody(approveRegistrationSchema, req.body, res);
      if (!input) return;
      const registration = await approveRegistration(
        guild,
        registrationId(req.params.registrationId),
        input,
        currentUser(res),
      );
      await jobs.enqueue('registration-reviewed', { registrationId: registration.id });
      res.status(204).end();
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

function toPendingRegistration(
  registration: CharacterRegistration,
  onRoster: boolean,
): PendingRegistration {
  const found = registration.lookup === 'found';
  return {
    id: registration.id,
    name: registration.name,
    discordUserId: registration.discordUserId,
    discordName: registration.discordName,
    avatarUrl: discordAvatarUrl(registration.discordUserId, registration.discordAvatar),
    onRoster,
    registeredAt: registration.createdAt.toISOString(),
    lookup: registration.lookup,
    lookedUpAt: registration.lookedUpAt?.toISOString() ?? null,
    character: found
      ? {
          faction: registration.faction!,
          race: registration.race!,
          class: registration.characterClass!,
          level: registration.level!,
        }
      : null,
  };
}
