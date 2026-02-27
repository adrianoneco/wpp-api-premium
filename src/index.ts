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
import path from 'path';
import { defaultLogger } from '@wppconnect-team/wppconnect';
import cors from 'cors';
import express, { Express, NextFunction, Router } from 'express';
import boolParser from 'express-query-boolean';
import { createServer } from 'http';
import mergeDeep from 'merge-deep';
import process from 'process';
import { Server as Socket } from 'socket.io';
import axios from 'axios';
import { shouldSendWebhook, sendWebhook } from './util/webhook';
import { formatEventLog } from './util/logFormat';
import { Logger } from 'winston';

import fs from 'fs';

import { version } from '../package.json';
import config from './config';
import { convert } from './mapper/index';
import routes from './routes';
import storageRouter from './routes/storage';
import { ServerOptions } from './types/ServerOptions';
import {
  createFolders,
  setMaxListners,
  startAllSessions,
} from './util/functions';
import { createLogger } from './util/logger';

//require('dotenv').config();

export const logger = createLogger(config.log);

export function initServer(serverOptions: Partial<ServerOptions>): {
  app: Express;
  routes: Router;
  logger: Logger;
} {
  if (typeof serverOptions !== 'object') {
    serverOptions = {};
  }

  serverOptions = mergeDeep({}, config, serverOptions);
  defaultLogger.level = serverOptions?.log?.level
    ? serverOptions.log.level
    : 'silly';

  setMaxListners(serverOptions as ServerOptions);

  const app = express();
  const PORT = process.env.PORT || serverOptions.port;

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));
  const filesDir = (config as any).dataDir
    ? String((config as any).dataDir)
    : './data';
  app.use(
    '/files',
    express.static(path.join(process.cwd(), filesDir, 'WhatsAppImages'))
  );
  app.use(boolParser());

  if (config?.aws_s3?.access_key_id && config?.aws_s3?.secret_key) {
    process.env['AWS_ACCESS_KEY_ID'] = config.aws_s3.access_key_id;
    process.env['AWS_SECRET_ACCESS_KEY'] = config.aws_s3.secret_key;
  }

  // Add request options
  app.use((req: any, res: any, next: NextFunction) => {
    req.serverOptions = serverOptions;
    req.logger = logger;
    req.io = io as any;

    const oldSend = res.send;

    res.send = async function (data: any) {
      const content = req.headers['content-type'];
      if (content == 'application/json') {
        data = JSON.parse(data);
        if (!data.session) data.session = req.client ? req.client.session : '';
        if (data.mapper && req.serverOptions.mapper.enable) {
          data.response = await convert(
            req.serverOptions.mapper.prefix,
            data.response,
            data.mapper
          );
          delete data.mapper;
        }
      }
      res.send = oldSend;
      return res.send(data);
    };
    next();
  });

  app.use(routes);
  // storage files (protected by x-storage-key header or ?key=)
  app.use('/storage', storageRouter as any);

  createFolders();
  const http = createServer(app);
  const io = new Socket(http, {
    cors: {
      origin: '*',
    },
  });

  // start queue workers
  import('./queues/worker')
    .then(() => {})
    .catch((err) => logger.warn('Failed to start queue workers: ' + (err as any).message));

  io.on('connection', (sock) => {
    logger.info(`ID: ${sock.id} entrou`);

    sock.on('disconnect', () => {
      logger.info(`ID: ${sock.id} saiu`);
    });

    const API_PORT = process.env.PORT || serverOptions.port || 21465;
    const API_HOST = `http://localhost:${API_PORT}`;

    // Generic API proxy using dot-separated event name: 'api.request'
    sock.on('api.request', async (req: any) => {
      const { id, method = 'get', path = '/', data = {}, headers = {} } = req || {};
      logger.info(formatEventLog(req?.session || null, 'websocket', `Received api.request ${path}`));
      try {
        const url = `${API_HOST}${path}`;
        const resp = await axios.request({ method, url, data, headers });
        sock.emit('api.response', { id, status: resp.status, data: resp.data });
        logger.info(formatEventLog(req?.session || null, 'websocket', `Responded api.request ${path} status=${resp.status}`));
        if (shouldSendWebhook('api.request')) await sendWebhook('api.request', { id, method, path, data }, logger);
      } catch (err: any) {
        sock.emit('api.response', { id, status: err?.response?.status || 500, error: err?.response?.data || err.message });
        logger.warn(formatEventLog(req?.session || null, 'websocket', `api.request error ${path}: ${err?.message || err}`));
        if (shouldSendWebhook('api.request')) await sendWebhook('api.request', { id, error: err?.response?.data || err.message }, logger);
      }
    });

    // messages.upsert -> POST /api/:session/send-message
    sock.on('messages.upsert', async (payload: any) => {
      const { session, message } = payload || {};
      logger.info(formatEventLog(session || null, 'websocket', `Received messages.upsert`));
      if (!session || !message) return sock.emit('messages.upsert.response', { ok: false, error: 'missing session or message' });
      try {
        const url = `${API_HOST}/api/${session}/send-message`;
        const resp = await axios.post(url, message, { headers: { 'Content-Type': 'application/json' } });
        sock.emit('messages.upsert.response', { ok: true, data: resp.data });
        logger.info(formatEventLog(session || null, 'websocket', `messages.upsert responded`));
        if (shouldSendWebhook('messages.upsert')) await sendWebhook('messages.upsert', { session, message, response: resp.data }, logger);
      } catch (err: any) {
        sock.emit('messages.upsert.response', { ok: false, error: err?.response?.data || err.message });
        logger.warn(formatEventLog(session || null, 'websocket', `messages.upsert error: ${err?.message || err}`));
        if (shouldSendWebhook('messages.upsert')) await sendWebhook('messages.upsert', { session, message, error: err?.response?.data || err.message }, logger);
      }
    });

    // sessions.start -> POST /api/:session/start-session
    sock.on('sessions.start', async (payload: any) => {
      const { session, body = {} } = payload || {};
      logger.info(formatEventLog(session || null, 'websocket', `Received sessions.start`));
      if (!session) return sock.emit('sessions.start.response', { ok: false, error: 'missing session' });
      try {
        const url = `${API_HOST}/api/${session}/start-session`;
        const resp = await axios.post(url, body, { headers: { 'Content-Type': 'application/json' } });
        sock.emit('sessions.start.response', { ok: true, data: resp.data });
        logger.info(formatEventLog(session || null, 'websocket', `sessions.start responded`));
        if (shouldSendWebhook('sessions.start')) await sendWebhook('sessions.start', { session, body, response: resp.data }, logger);
      } catch (err: any) {
        sock.emit('sessions.start.response', { ok: false, error: err?.response?.data || err.message });
        logger.warn(formatEventLog(session || null, 'websocket', `sessions.start error: ${err?.message || err}`));
        if (shouldSendWebhook('sessions.start')) await sendWebhook('sessions.start', { session, body, error: err?.response?.data || err.message }, logger);
      }
    });

    // sessions.close -> POST /api/:session/close-session
    sock.on('sessions.close', async (payload: any) => {
      const { session } = payload || {};
      logger.info(formatEventLog(session || null, 'websocket', `Received sessions.close`));
      if (!session) return sock.emit('sessions.close.response', { ok: false, error: 'missing session' });
      try {
        const url = `${API_HOST}/api/${session}/close-session`;
        const resp = await axios.post(url);
        sock.emit('sessions.close.response', { ok: true, data: resp.data });
        logger.info(formatEventLog(session || null, 'websocket', `sessions.close responded`));
        if (shouldSendWebhook('sessions.close')) await sendWebhook('sessions.close', { session, response: resp.data }, logger);
      } catch (err: any) {
        sock.emit('sessions.close.response', { ok: false, error: err?.response?.data || err.message });
        logger.warn(formatEventLog(session || null, 'websocket', `sessions.close error: ${err?.message || err}`));
        if (shouldSendWebhook('sessions.close')) await sendWebhook('sessions.close', { session, error: err?.response?.data || err.message }, logger);
      }
    });

    // sessions.getAll -> GET /api/:secretkey/show-all-sessions
    sock.on('sessions.getAll', async () => {
      logger.info(formatEventLog(null, 'websocket', 'Received sessions.getAll'));
      try {
        const url = `${API_HOST}/api/show-all-sessions`;
        const resp = await axios.get(url);
        sock.emit('sessions.getAll.response', { ok: true, data: resp.data });
        logger.info(formatEventLog(null, 'websocket', 'sessions.getAll responded'));
        if (shouldSendWebhook('sessions.getAll')) await sendWebhook('sessions.getAll', { response: resp.data }, logger);
      } catch (err: any) {
        sock.emit('sessions.getAll.response', { ok: false, error: err?.response?.data || err.message });
        logger.warn(formatEventLog(null, 'websocket', `sessions.getAll error: ${err?.message || err}`));
        if (shouldSendWebhook('sessions.getAll')) await sendWebhook('sessions.getAll', { error: err?.response?.data || err.message }, logger);
      }
    });
  });

  // Wrap io.emit so internal server emits (req.io.emit) are also forwarded to webhook when enabled
  const originalEmit = (io as any).emit.bind(io);
  (io as any).emit = async (event: string, ...args: any[]) => {
    originalEmit(event, ...args);
    try {
      logger.info(formatEventLog(args?.[0]?.session || null, 'websocket', `Emitted ${event}`));
      if (shouldSendWebhook(event)) await sendWebhook(event, args.length === 1 ? args[0] : args, logger);
    } catch (err) {
      // ignore webhook errors
    }
  };

  http.listen(PORT, () => {
    logger.info(`Server is running on port: http://localhost:${PORT}`);
    logger.info(
      `\x1b[31m Visit ${serverOptions.host}:${PORT}/api-docs for Swagger docs`
    );
    logger.info(`WPPConnect-Server version: ${version}`);

    // Start sessions (MongoDB is used for persistence)
    setImmediate(async () => {
      if (serverOptions.startAllSession) startAllSessions(serverOptions, logger);
    });

    // Auto-start single session from env when `SESSION_NAME` is set
    const AUTO_SESSION = process.env.SESSION_NAME || '';
    if (AUTO_SESSION) {
      try {
        const dataDir = (config as any).dataDir || 'data';
        const tokenPath = path.join(process.cwd(), dataDir, 'tokens', `${AUTO_SESSION}.data.json`);
        if (!fs.existsSync(tokenPath)) {
          fs.mkdirSync(path.dirname(tokenPath), { recursive: true });
          fs.writeFileSync(tokenPath, JSON.stringify({ createdAt: new Date().toISOString() }, null, 2));
          logger.info(`Created session token file for ${AUTO_SESSION}`);
        }

        const reqLike: any = {
          serverOptions,
          logger,
          io,
          body: {
            webhook: process.env.WEBHOOK_URL || serverOptions.webhook?.url || '',
            phone: process.env.PHONE_NUMBER || process.env.PHONE_TEST_NUMBER || undefined,
          },
          session: AUTO_SESSION,
        };

        // start in background and log progress (dynamic import to avoid circular deps)
        logger.info(`Auto-start: invoking opendata for session ${AUTO_SESSION}`);
        setImmediate(async () => {
          try {
            const mod = await import('./util/createSessionUtil');
            const Creator = (mod as any).default;
            const creator = new Creator();
            await creator.opendata(reqLike, AUTO_SESSION);
            logger.info(`Auto-start: opendata finished for session ${AUTO_SESSION}`);
          } catch (e: any) {
            logger.error(`Auto-start session error: ${e?.message || e}`);
          }
        });
      } catch (e: any) {
        logger.error('Auto-start setup failed: ' + (e?.message || e));
      }
    }
  });

  if (config.log.level === 'error' || config.log.level === 'warn') {
    console.log(`\x1b[33m ======================================================
Attention:
Your configuration is configured to show only a few logs, before opening an issue, 
please set the log to 'silly', copy the log that shows the error and open your issue.
======================================================
`);
  }

  return {
    app,
    routes,
    logger,
  };
}
