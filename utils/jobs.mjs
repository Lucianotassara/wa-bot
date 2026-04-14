import pkg from 'whatsapp-web.js';
const { MessageMedia } = pkg;
import { Message, Job, ScheduledMessage } from '../models/index.mjs';
import { getReceivers } from './get-receivers.mjs';
import { applyPlaceholders } from './placeholders.mjs';
import CONFIG from './config.mjs';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function buildMedia(mediaInput) {
    if (!mediaInput) return null;
    return new MessageMedia(
        mediaInput.mimetype,
        mediaInput.data,
        mediaInput.filename || 'media'
    );
}

async function sendOne(client, number, text, mediaInput) {
    const to = number.includes('@c.us') ? number : `${number}@c.us`;
    const m = mediaInput
        ? await client.sendMessage(to, buildMedia(mediaInput), { caption: text })
        : await client.sendMessage(to, text);

    await Message.findOneAndUpdate(
        { 'id._serialized': m.id._serialized },
        m,
        { upsert: true }
    );
    return m.id._serialized;
}

// ---------------------------------------------------------------------------
// Public job processors
// ---------------------------------------------------------------------------

/**
 * Process a single/multi-recipient job.
 * recipients: Array<{ to: string, placeholders: Record<string, string> }>
 */
export async function processSingleJob(client, jobId, recipients, message, mediaInput) {
    await Job.findOneAndUpdate(
        { jobId },
        { status: 'running', total: recipients.length, updatedAt: new Date() }
    );

    let sent = 0;
    const errors = [];

    for (const { to, placeholders } of recipients) {
        try {
            const text = applyPlaceholders(message, placeholders || {});
            await sendOne(client, to, text, mediaInput);
            sent++;
        } catch (err) {
            console.error(`Error sending to ${to}:`, err.message);
            errors.push(`${to}: ${err.message}`);
        }
    }

    await Job.findOneAndUpdate(
        { jobId },
        { status: sent === 0 ? 'failed' : 'done', sent, errors, updatedAt: new Date() }
    );

    return { sent, errors };
}

/**
 * Process a bulk job — recipients come from Google Sheets.
 * Automatically applies %NOMBRE%, %APODO%, %ROL%, %GRUPO%, %SEXO% placeholders
 * from sheet columns (caller-supplied placeholders in message template are also supported).
 */
export async function processBulkJob(client, jobId, message, mediaInput) {
    await Job.findOneAndUpdate({ jobId }, { status: 'running', updatedAt: new Date() });

    const receivers = await getReceivers();
    const valid = receivers.filter((r) => r.phone);

    await Job.findOneAndUpdate({ jobId }, { total: valid.length, updatedAt: new Date() });

    if (valid.length > CONFIG.WA.MSG_LIMIT) {
        const errMsg = `Too many recipients: ${valid.length} exceeds limit of ${CONFIG.WA.MSG_LIMIT}`;
        await Job.findOneAndUpdate(
            { jobId },
            { status: 'failed', errors: [errMsg], updatedAt: new Date() }
        );
        return { sent: 0, errors: [errMsg] };
    }

    let sent = 0;
    const errors = [];

    for (const receiver of valid) {
        try {
            const text = applyPlaceholders(message, {
                NOMBRE: receiver.name     || '',
                APODO:  receiver.nickname || '',
                ROL:    receiver.role     || '',
                GRUPO:  receiver.age      || '',
                SEXO:   receiver.sex      || '',
            });
            await sendOne(client, receiver.phone, text, mediaInput);
            sent++;
        } catch (err) {
            console.error(`Error sending to ${receiver.phone}:`, err.message);
            errors.push(`${receiver.phone}: ${err.message}`);
        }
    }

    await Job.findOneAndUpdate(
        { jobId },
        { status: sent === 0 ? 'failed' : 'done', sent, errors, updatedAt: new Date() }
    );

    return { sent, errors };
}

// ---------------------------------------------------------------------------
// Scheduler
// ---------------------------------------------------------------------------

/**
 * Start the scheduled-message dispatcher.
 * Polls every 30 s for messages due to be sent.
 *
 * @param {() => Client} getClient - returns the current WhatsApp client instance
 */
export function startScheduler(getClient) {
    const INTERVAL_MS = 30_000;

    const tick = async () => {
        try {
            const due = await ScheduledMessage.find({
                status: 'pending',
                scheduledAt: { $lte: new Date() },
            }).limit(10);

            for (const scheduled of due) {
                // Atomic claim to prevent double-processing across restarts
                const claimed = await ScheduledMessage.findOneAndUpdate(
                    { jobId: scheduled.jobId, status: 'pending' },
                    { status: 'sent' }
                );
                if (!claimed) continue;

                const client = getClient();
                if (!client?.info) {
                    // Client not authenticated — defer by 1 minute and retry
                    await ScheduledMessage.findOneAndUpdate(
                        { jobId: scheduled.jobId },
                        { status: 'pending', scheduledAt: new Date(Date.now() + 60_000) }
                    );
                    console.warn(`Scheduler: client not ready, deferring job ${scheduled.jobId}`);
                    continue;
                }

                try {
                    if (scheduled.type === 'bulk') {
                        await processBulkJob(client, scheduled.jobId, scheduled.message, scheduled.media);
                    } else {
                        await processSingleJob(
                            client,
                            scheduled.jobId,
                            scheduled.recipients,
                            scheduled.message,
                            scheduled.media
                        );
                    }
                    console.log(`Scheduler: job ${scheduled.jobId} completed`);
                } catch (err) {
                    console.error(`Scheduler: job ${scheduled.jobId} failed:`, err.message);
                    await Job.findOneAndUpdate(
                        { jobId: scheduled.jobId },
                        { status: 'failed', errors: [err.message], updatedAt: new Date() }
                    );
                }
            }
        } catch (err) {
            console.error('Scheduler tick error:', err.message);
        }
    };

    setInterval(tick, INTERVAL_MS);
    console.log(`Scheduler started (${INTERVAL_MS / 1000}s interval)`);
}
