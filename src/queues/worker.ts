import { Worker, QueueScheduler, Job } from 'bullmq';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import { formatEventLog } from '../util/logFormat';
import { createLogger } from '../util/logger';
import { clientsArray } from '../util/sessionUtil';

const connection = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: Number(process.env.REDIS_PORT || 6379),
  password: process.env.REDIS_PASSWORD || undefined,
};

const webHookScheduler = new QueueScheduler('webhooks', { connection });
const uploadScheduler = new QueueScheduler('uploads', { connection });

const logger = createLogger({ level: 'info', logger: ['console'] } as any);

// small helper sleep
function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

function extractErrorMessage(err: any): string {
  if (!err) return '';
  // Axios error
  if (err.isAxiosError) {
    try {
      const info = (err as any).toJSON ? (err as any).toJSON() : { message: err.message };
      return `AxiosError: ${err.message} ${JSON.stringify(info)}`;
    } catch {
      return `AxiosError: ${err.message}`;
    }
  }
  // AggregateError
  if (typeof AggregateError !== 'undefined' && err instanceof AggregateError) {
    return (err as AggregateError).errors.map((e: any) => extractErrorMessage(e)).join('; ');
  }
  if (err && err.message) return err.message;
  return String(err);
}

// Webhook worker with retries/backoff and better error messages
const webhookWorker = new Worker(
  'webhooks',
  async (job: Job) => {
    const { event, payload } = job.data;
    const url = process.env.WEBHOOK_URL || '';
    if (!url) throw new Error('No WEBHOOK_URL configured');

    const maxRetries = parseInt(process.env.WEBHOOK_RETRIES || '3');
    const baseBackoff = parseInt(process.env.WEBHOOK_BACKOFF_MS || '2000');

    let lastErr: any = null;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        await axios.post(url, { event, payload }, { headers: { 'Content-Type': 'application/json' }, timeout: 10000 });
        logger.info(formatEventLog(payload?.session || null, 'webhook', `Delivered ${event}`));
        lastErr = null;
        break;
      } catch (err) {
        lastErr = err;
        const msg = extractErrorMessage(err);
        logger.warn(formatEventLog(payload?.session || null, 'webhook', `Attempt ${attempt + 1} failed for ${event}: ${msg}`));
        if (attempt < maxRetries - 1) {
          const backoff = baseBackoff * Math.pow(2, attempt);
          await sleep(backoff);
        }
      }
    }

    if (lastErr) {
      // let the worker mark job as failed so BullMQ can retry based on job opts
      throw lastErr;
    }
  },
  {
    connection,
    concurrency: 2,
    // automatic retry handled by job options
  }
);

webhookWorker.on('failed', (job, err) => {
  const msg = extractErrorMessage(err);
  logger.warn(formatEventLog(job?.data?.payload?.session || null, 'webhook', `Failed ${job?.data?.event}: ${msg}`));
});

// Upload worker - upload file via HTTP to external storage service
const uploadWorker = new Worker(
  'uploads',
  async (job: Job) => {
    const { tmpPath, destPath, session } = job.data || {};
    // destPath may be an empty string when callers want the storage service
    // to generate the final filename (syncService passes ''). Require only tmpPath.
    if (!tmpPath) {
      // Log full job payload for debugging before failing
      try {
        logger.warn(formatEventLog((job as any)?.data?.session || session || null, 'upload', `Invalid upload job data payload: ${JSON.stringify(job.data)}`));
      } catch {}
      throw new Error('Invalid upload job data: missing tmpPath');
    }

    // storage service config
    const storageHost = process.env.STORAGE_HOST || 'localhost';
    const storagePort = process.env.STORAGE_PORT || '80';
    const storageSecret = process.env.STORAGE_SECRET_KEY || '';
    const protocol = process.env.STORAGE_PROTOCOL || 'http';
    // storage routes are mounted under /storage on the main server
    const uploadUrl = `${protocol}://${storageHost}:${storagePort}/storage/upload`;

    // stream file and post as multipart/form-data
    const form = new FormData();
    form.append('file', fs.createReadStream(tmpPath));
    form.append('session', session || '');
    form.append('destPath', destPath || '');

    const headers = Object.assign({}, form.getHeaders());
    if (storageSecret) headers['x-storage-key'] = storageSecret;

    await axios.post(uploadUrl, form, { headers, maxContentLength: Infinity, maxBodyLength: Infinity, timeout: 30000 });

    // remove tmp file on success
    try {
      fs.unlinkSync(tmpPath);
    } catch (e) {}

    logger.info(formatEventLog(session || null, 'upload', `Uploaded ${path.basename(destPath)}`));
  },
  { connection, concurrency: 2 }
);

uploadWorker.on('failed', (job, err) => {
  try {
    logger.warn(formatEventLog(job?.data?.session || null, 'upload', `Failed upload ${job?.data?.destPath}: ${err?.message || err} payload=${JSON.stringify(job?.data)}`));
  } catch (e) {
    logger.warn(formatEventLog(job?.data?.session || null, 'upload', `Failed upload ${job?.data?.destPath}: ${err?.message || err}`));
  }
});

// ─── Download worker (profile pics & media attachments) ───────────────
const downloadScheduler = new QueueScheduler('downloads', { connection });

const STORAGE_DIR = process.env.STORAGE_PATH || path.join(process.cwd(), 'data', 'uploads');

const downloadWorker = new Worker(
  'downloads',
  async (job: Job) => {
    const { type, session } = job.data || {};
    if (!type || !session) throw new Error('Invalid download job: missing type or session');

    const client = (clientsArray as any)[session];
    if (!client || !client.page) {
      throw new Error(`Client for session "${session}" not connected`);
    }

    if (type === 'profile-pic') {
      await handleProfilePic(job, client, session);
    } else if (type === 'media') {
      await handleMediaDownload(job, client, session);
    } else {
      throw new Error(`Unknown download job type: ${type}`);
    }
  },
  { connection, concurrency: 2 }
);

async function handleProfilePic(job: Job, client: any, session: string) {
  const { contactId } = job.data;
  if (!contactId) throw new Error('Missing contactId');

  const dir = path.join(STORAGE_DIR, 'profile-pics');
  const filename = contactId.replace(/[@.:]/g, '_') + '.jpg';
  const filePath = path.join(dir, filename);

  // Skip if already downloaded
  if (fs.existsSync(filePath) && fs.statSync(filePath).size > 0) {
    logger.info(formatEventLog(session, 'download', `Profile pic already exists for ${contactId}, skipping`));
    // Ensure DB is updated even if file existed before
    try {
      const mongo = require('../util/db/mongo');
      const { Contact } = await mongo.getModels(session);
      await Contact.updateOne({ wa_id: contactId }, { $set: { profile_pic: filePath } });
    } catch {}
    return;
  }

  const pic = await client.getProfilePicFromServer(contactId);
  if (!pic || (!pic.imgFull && !pic.eurl)) {
    logger.info(formatEventLog(session, 'download', `No profile pic for ${contactId}`));
    return;
  }

  const url = pic.imgFull || pic.eurl;
  const resp = await axios.get(url, { responseType: 'arraybuffer', timeout: 30000 });

  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, resp.data);

  // Update contact in MongoDB
  try {
    const mongo = require('../util/db/mongo');
    const { Contact } = await mongo.getModels(session);
    await Contact.updateOne({ wa_id: contactId }, { $set: { profile_pic: filePath } });
  } catch {}

  logger.info(formatEventLog(session, 'download', `Profile pic saved for ${contactId}`));
}

async function handleMediaDownload(job: Job, client: any, session: string) {
  const { msgId } = job.data;
  if (!msgId) throw new Error('Missing msgId');

  const dir = path.join(STORAGE_DIR, 'media');
  const safeId = String(msgId).replace(/[^a-zA-Z0-9_-]/g, '_');

  // Check if any file for this message already exists on disk
  if (fs.existsSync(dir)) {
    const existing = fs.readdirSync(dir).find((f) => f.startsWith(safeId + '.'));
    if (existing) {
      const filePath = path.join(dir, existing);
      if (fs.statSync(filePath).size > 0) {
        logger.info(formatEventLog(session, 'download', `Media already exists for ${msgId}, skipping`));
        try {
          const mongo = require('../util/db/mongo');
          const { Message } = await mongo.getModels(session);
          await Message.updateOne({ wa_id: msgId }, { $set: { media_path: filePath } });
        } catch {}
        return;
      }
    }
  }

  // Retrieve the message object from WhatsApp
  const msg = await client.getMessageById(msgId);
  if (!msg) throw new Error(`Message ${msgId} not found`);

  let buffer: Buffer | null = null;
  let ext = '';

  // Try decryptFile first (returns Buffer), fallback to downloadMedia (returns base64)
  try {
    buffer = await client.decryptFile(msg);
  } catch {
    try {
      const b64 = await client.downloadMedia(msg);
      if (b64 && typeof b64 === 'string') {
        buffer = Buffer.from(b64, 'base64');
      }
    } catch {}
  }

  if (!buffer || buffer.length === 0) {
    throw new Error(`Could not download media for message ${msgId}`);
  }

  const mime = msg.mimetype || '';
  ext = mime.split('/').pop()?.split(';')[0] || 'bin';

  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const filename = `${safeId}.${ext}`;
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, buffer);

  // Update message in MongoDB
  try {
    const mongo = require('../util/db/mongo');
    const { Message } = await mongo.getModels(session);
    await Message.updateOne({ wa_id: msgId }, { $set: { media_path: filePath } });
  } catch {}

  logger.info(formatEventLog(session, 'download', `Media saved for ${msgId} → ${filename}`));
}

downloadWorker.on('failed', (job, err) => {
  const msg = extractErrorMessage(err);
  logger.warn(formatEventLog(job?.data?.session || null, 'download', `Failed ${job?.data?.type} ${job?.data?.contactId || job?.data?.msgId}: ${msg}`));
});

export { webhookWorker, uploadWorker, downloadWorker, webHookScheduler, uploadScheduler, downloadScheduler };