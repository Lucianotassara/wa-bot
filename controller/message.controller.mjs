import express from 'express';
import { randomUUID } from 'crypto';
import { Job, ScheduledMessage } from '../models/index.mjs';
import { processSingleJob, processBulkJob } from '../utils/jobs.mjs';

const messageController = express.Router();

// ---------------------------------------------------------------------------
// Media helpers
// ---------------------------------------------------------------------------

async function fetchMediaFromUrl(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch media from URL: ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    return {
        data: buffer.toString('base64'),
        mimetype: res.headers.get('content-type') || 'application/octet-stream',
        filename: url.split('/').pop() || 'file',
    };
}

async function resolveMedia(mediaInput) {
    if (!mediaInput) return null;
    if (mediaInput.url) return fetchMediaFromUrl(mediaInput.url);
    return {
        data: mediaInput.data,
        mimetype: mediaInput.mimetype,
        filename: mediaInput.filename || 'file',
    };
}

// ---------------------------------------------------------------------------
// POST /sendMessage
// ---------------------------------------------------------------------------
/**
 * Send one message to one or more specific recipients.
 *
 * Body:
 * {
 *   "to": "5491112345678"              — single number
 *         | ["54911...", "54912..."],  — multiple numbers
 *   "message": "Hola %NOMBRE%!",
 *
 *   // Optional placeholders — global values apply to all recipients;
 *   // per-number values override global ones for that number.
 *   "placeholders": {
 *     "global": { "ROL": "Admin" },
 *     "5491112345678": { "NOMBRE": "Juan" },
 *     "5491187654321": { "NOMBRE": "María" }
 *   },
 *
 *   // Optional media — pass either a public URL or base64 data.
 *   "media": {
 *     "url": "https://example.com/image.jpg"
 *     // OR
 *     "data": "<base64>", "mimetype": "image/jpeg", "filename": "photo.jpg"
 *   },
 *
 *   // Optional — ISO 8601 future date to schedule the send.
 *   "scheduledAt": "2026-05-01T09:00:00Z"
 * }
 *
 * Response 202: { jobId, status: "queued" | "scheduled" }
 */
messageController.post('/sendMessage', async (req, res) => {
    const { to, message, placeholders = {}, media: mediaInput, scheduledAt } = req.body;

    if (!to || !message) {
        return res.status(400).json({ error: '"to" and "message" are required' });
    }
    if (!req.client?.info) {
        return res.status(503).json({ error: 'WhatsApp client is not ready — open /qr to authenticate.' });
    }

    const toArray = Array.isArray(to) ? to : [to];
    const jobId = randomUUID();

    const recipients = toArray.map((number) => ({
        to: number,
        placeholders: { ...(placeholders.global || {}), ...(placeholders[number] || {}) },
    }));

    if (scheduledAt) {
        const schedDate = new Date(scheduledAt);
        if (isNaN(schedDate.getTime()) || schedDate <= new Date()) {
            return res.status(400).json({ error: '"scheduledAt" must be a future ISO 8601 date' });
        }
        const media = await resolveMedia(mediaInput);
        await ScheduledMessage.create({ jobId, scheduledAt: schedDate, type: 'single', recipients, message, media });
        await Job.create({ jobId, status: 'queued', type: 'single', total: recipients.length });
        return res.status(202).json({ jobId, status: 'scheduled', scheduledAt: schedDate });
    }

    const media = await resolveMedia(mediaInput);
    await Job.create({ jobId, status: 'queued', type: 'single', total: recipients.length });

    // Fire and forget — client polls /jobs/:id for progress
    processSingleJob(req.client, jobId, recipients, message, media).catch(console.error);

    res.status(202).json({ jobId, status: 'queued' });
});

// ---------------------------------------------------------------------------
// POST /sendBulk
// ---------------------------------------------------------------------------
/**
 * Send a message to all recipients in Google Sheets (Enviar = "si").
 * Supports %NOMBRE%, %APODO%, %ROL%, %GRUPO%, %SEXO% from sheet columns
 * plus any extra %CUSTOM% placeholders you add to the template.
 *
 * Body:
 * {
 *   "message": "Hola %APODO%!",
 *   "media": { ... },          — optional, same shape as /sendMessage
 *   "scheduledAt": "..."       — optional ISO 8601 future date
 * }
 *
 * Response 202: { jobId, status: "queued" | "scheduled" }
 */
messageController.post('/sendBulk', async (req, res) => {
    const { message, media: mediaInput, scheduledAt } = req.body;

    if (!message) {
        return res.status(400).json({ error: '"message" is required' });
    }
    if (!req.client?.info) {
        return res.status(503).json({ error: 'WhatsApp client is not ready — open /qr to authenticate.' });
    }

    const jobId = randomUUID();

    if (scheduledAt) {
        const schedDate = new Date(scheduledAt);
        if (isNaN(schedDate.getTime()) || schedDate <= new Date()) {
            return res.status(400).json({ error: '"scheduledAt" must be a future ISO 8601 date' });
        }
        const media = await resolveMedia(mediaInput);
        await ScheduledMessage.create({ jobId, scheduledAt: schedDate, type: 'bulk', message, media });
        await Job.create({ jobId, status: 'queued', type: 'bulk', total: 0 });
        return res.status(202).json({ jobId, status: 'scheduled', scheduledAt: schedDate });
    }

    const media = await resolveMedia(mediaInput);
    await Job.create({ jobId, status: 'queued', type: 'bulk', total: 0 });

    processBulkJob(req.client, jobId, message, media).catch(console.error);

    res.status(202).json({ jobId, status: 'queued' });
});

// ---------------------------------------------------------------------------
// GET /jobs
// ---------------------------------------------------------------------------
/**
 * List recent jobs. Supports query filters:
 *   ?status=queued|running|done|failed
 *   ?type=single|bulk
 *   ?limit=N  (default 50)
 */
messageController.get('/jobs', async (req, res) => {
    const { status, type, limit = 50 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (type)   filter.type   = type;
    const jobs = await Job.find(filter).sort({ createdAt: -1 }).limit(Number(limit)).lean();
    res.json(jobs);
});

// ---------------------------------------------------------------------------
// GET /jobs/:id
// ---------------------------------------------------------------------------
messageController.get('/jobs/:id', async (req, res) => {
    const job = await Job.findOne({ jobId: req.params.id }).lean();
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json(job);
});

// ---------------------------------------------------------------------------
// DELETE /jobs/scheduled/:id  — cancel a pending scheduled job
// ---------------------------------------------------------------------------
messageController.delete('/jobs/scheduled/:id', async (req, res) => {
    const scheduled = await ScheduledMessage.findOneAndUpdate(
        { jobId: req.params.id, status: 'pending' },
        { status: 'cancelled' }
    );
    if (!scheduled) {
        return res.status(404).json({ error: 'Scheduled job not found or already processed' });
    }
    await Job.findOneAndUpdate(
        { jobId: req.params.id },
        { status: 'failed', errors: ['Cancelled by user'], updatedAt: new Date() }
    );
    res.json({ jobId: req.params.id, status: 'cancelled' });
});

export default messageController;
