import { attendanceReportQuerySchema } from '@wgm/shared';
import express from 'express';

import { attendanceReport } from '../domain/reports.js';
import { parseBody } from './errors.js';
import { currentGuild, requireGuildPermission } from './guild-access.js';
import { requireUser } from './me.js';

/** The guild-wide attendance report, to compare members. */
export function reportsRouter() {
  const router = express.Router();

  router.get(
    '/guilds/:guildId/attendance',
    requireUser,
    requireGuildPermission('viewAttendance'),
    async (req, res) => {
      const { guild } = currentGuild(res);
      const query = parseBody(attendanceReportQuerySchema, req.query, res);
      if (!query) return;
      res.json(await attendanceReport(guild, query.period, query.type));
    },
  );

  return router;
}
