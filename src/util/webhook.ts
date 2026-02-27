import { Logger } from 'winston';
import { formatEventLog } from './logFormat';
import { webhookQueue } from '../queues/client';

const WEBHOOK_URL = process.env.WEBHOOK_URL || '';
const WEBHOOK_EVENTS = process.env.WEBHOOK_EVENTS || '';

function matchesPattern(patterns: string[], event: string): boolean {
    if (patterns.includes('*')) return true;
    return patterns.some((p) => p.trim() === event || event.startsWith(p.trim() + '.'));
}

export function shouldSendWebhook(event: string): boolean {
    if (!WEBHOOK_URL) return false;
    if (!WEBHOOK_EVENTS) return true; // default: send all if URL set and no filter
    const patterns = WEBHOOK_EVENTS.split(',').map((s) => s.trim()).filter(Boolean);
    if (patterns.length === 0) return true;
    return matchesPattern(patterns, event);
}

export async function sendWebhook(event: string, payload: any, logger?: Logger) {
    if (!WEBHOOK_URL) return;
    try {
        // enqueue webhook delivery job with retries
        await webhookQueue.add(
            'deliver',
            { event, payload },
            { attempts: 5, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: true }
        );
        const logMsg = formatEventLog(payload?.session || null, 'webhook', `Enqueued ${event}`);
        if (logger) logger.info(logMsg);
        else console.info(logMsg);
    } catch (err: any) {
        const logMsg = formatEventLog(payload?.session || null, 'webhook', `Enqueue failed ${event}: ${err?.message || err}`);
        if (logger) logger.warn(logMsg);
        else console.warn(logMsg);
    }
}

export default { shouldSendWebhook, sendWebhook };
