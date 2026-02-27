/*
 * Copyright 2021 WPPConnect Team
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { NextFunction, Request, Response } from 'express';

import { clientsArray } from '../util/sessionUtil';

function formatSession(session: string) {
  return session.split(':')[0];
}

/**
 * Middleware that resolves the session from the route param (or env fallback)
 * and attaches session + client to the request. No authentication required.
 */
const setSession = (req: Request, res: Response, next: NextFunction): any => {
  const { session } = req.params;
  const sessionParam = session || process.env.SESSION_NAME || '';

  if (!sessionParam)
    return res.status(400).send({ message: 'Session not informed' });

  req.session = formatSession(sessionParam);
  req.token = '';
  req.client = clientsArray[req.session];
  next();
};

export default setSession;
