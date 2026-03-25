import express from 'express';
import { Message } from '../models/index.mjs';
import { sendBulkMessages } from './wabot.controller.mjs';
import CONFIG from '../utils/config.mjs';

const messageController = express.Router();

/**
 * POST /sendMessage
 * Send a single WhatsApp message to one recipient.
 *
 * Body: { to: "5491112345678", message: "Hello!" }
 */
messageController.post('/sendMessage', async (req, res) => {
    const { to, message } = req.body;

    if (!to || !message) {
        return res.status(400).json({ error: '"to" and "message" are required' });
    }

    if (!req.client?.info) {
        return res.status(503).json({ error: 'WhatsApp client is not ready. Scan the QR first.' });
    }

    const number = to.includes('@c.us') ? to : `${to}@c.us`;
    const sent = await req.client.sendMessage(number, message);

    await Message.findOneAndUpdate(
        { 'id._serialized': sent.id._serialized },
        sent,
        { upsert: true }
    );

    res.json({
        status: 'sent',
        to: number,
        messageId: sent.id._serialized,
    });
});

/**
 * POST /sendBulk
 * Send a message to all recipients loaded from Google Sheets
 * (rows where Enviar === "si"). Supports %APODO% and %NOMBRE% placeholders.
 *
 * Body: { message: "Hola %APODO%!" }
 */
messageController.post('/sendBulk', async (req, res) => {
    const { message } = req.body;

    if (!message) {
        return res.status(400).json({ error: '"message" is required' });
    }

    if (!req.client?.info) {
        return res.status(503).json({ error: 'WhatsApp client is not ready. Scan the QR first.' });
    }

    const { sent, errors } = await sendBulkMessages(req.client, message);

    res.json({
        status: 'done',
        sent,
        errors,
    });
});

export default messageController;
