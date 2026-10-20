import { updateMeSchema } from '@wgm/shared';
import express, { type RequestHandler, type Response } from 'express';

import { toMeResponse } from '../auth/users.js';
import { User } from '../db/models/index.js';
import { sendError, sendValidationError } from './errors.js';

/** Loads the logged-in user into `res.locals.user`, or answers 401. */
export const requireUser: RequestHandler = async (req, res, next) => {
  const userId = req.session.userId;
  const user = userId === undefined ? null : await User.findByPk(userId);
  if (!user) {
    sendError(res, 401, { code: 'UNAUTHENTICATED' });
    return;
  }
  res.locals.user = user;
  next();
};

/** The user that `requireUser` loaded for this request. */
export function currentUser(res: Response): User {
  return res.locals.user as User;
}

export function meRouter() {
  const router = express.Router();

  router.get('/me', requireUser, (_req, res) => {
    res.json(toMeResponse(currentUser(res)));
  });

  router.patch('/me', requireUser, async (req, res) => {
    const result = updateMeSchema.safeParse(req.body);
    if (!result.success) {
      sendValidationError(res, result.error, req.body);
      return;
    }
    await currentUser(res).update(result.data);
    res.json(toMeResponse(currentUser(res)));
  });

  return router;
}
