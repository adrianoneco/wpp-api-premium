import { Worker, QueueScheduler, Job } from 'bullmq';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import { formatEventLog } from '../util/logFormat';
import { createLogger } from '../util/logger';

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
    const { tmpPath, destPath, session } = job.data;
    if (!tmpPath || !destPath) throw new Error('Invalid upload job data');

    // storage service config
    const storageHost = process.env.STORAGE_HOST || 'localhost';
    const storagePort = process.env.STORAGE_PORT || '80';
    const storageSecret = process.env.STORAGE_SECRET_KEY || '';
    const protocol = process.env.STORAGE_PROTOCOL || 'http';
    const uploadUrl = `${protocol}://${storageHost}:${storagePort}/upload`;

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
  logger.warn(formatEventLog(job?.data?.session || null, 'upload', `Failed upload ${job?.data?.destPath}: ${err?.message || err}`));
});

export { webhookWorker, uploadWorker, webHookScheduler, uploadScheduler };