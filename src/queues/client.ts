import { Queue } from 'bullmq';

const connection = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: Number(process.env.REDIS_PORT || 6379),
  password: process.env.REDIS_PASSWORD || undefined,
};

export const webhookQueue = new Queue('webhooks', { connection });
export const uploadQueue = new Queue('uploads', { connection });
export const downloadQueue = new Queue('downloads', { connection });
export const scheduleQueue = new Queue('schedules', { connection });

export default { webhookQueue, uploadQueue, downloadQueue, scheduleQueue };
