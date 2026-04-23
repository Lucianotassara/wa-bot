import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import { Message } from './models/index.mjs';

import {
    getStatus,
    sendReceivers,
    processContacts,
    gSheetController,
    clientController,
    viewController,
    messageController,
    qrController,
} from './controller/index.mjs';

import { setLatestQR, setAuthenticated } from './controller/qr.controller.mjs';
import { startScheduler } from './utils/jobs.mjs';

import qrTerminal from 'qrcode-terminal';
import basicAuth from 'express-basic-auth';
import CONFIG from './utils/config.mjs';

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------
mongoose.connect(CONFIG.WA.MONGO_URI || 'mongodb://localhost/wa-bot');

// ---------------------------------------------------------------------------
// WhatsApp client
// ---------------------------------------------------------------------------
const puppeteerArgs = ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'];

const client = new Client({
    authStrategy: new LocalAuth({ clientId: CONFIG.WA.CLIENT_ID }),
    puppeteer: {
        headless: true,
        args: puppeteerArgs,
        ...(process.env.ENV === 'ACC' ? { executablePath: 'chromium-browser' } : {}),
    },
    webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2409.0.html',
    },
});

client.initialize();

// ---------------------------------------------------------------------------
// WhatsApp events
// ---------------------------------------------------------------------------
client.on('qr', (qr) => {
    qrTerminal.generate(qr, { small: true });
    console.log('QR RECEIVED — open /qr in the browser to scan');
    setLatestQR(qr);
});

client.on('authenticated', () => {
    console.log('AUTHENTICATED');
});

client.on('ready', () => {
    console.log('READY');
    setAuthenticated();
    client.sendMessage(CONFIG.WA.ADMIN_GROUP, '🤖 BOT PREPARADO 🤖');
});

client.on('auth_failure', (msg) => {
    console.error('AUTHENTICATION FAILURE', msg);
});

// Messages received from others
client.on('message', async (msg) => {
    if (msg.id.remote === 'status@broadcast') return;
    console.log('<<<<< RECEIVED:', msg.body);
    handleCommand(msg);
});

// Messages sent from this account's own device (commands typed by the operator)
client.on('message_create', async (msg) => {
    if (!msg.fromMe) return;
    if (msg.id.remote === 'status@broadcast') return;
    console.log('<<<<< FROM ME:', msg.body);
    handleCommand(msg);
});

function handleCommand(msg) {
    if (msg.body === '!ping') {
        msg.reply('pong');
        return;
    }

    const from = msg.fromMe ? msg.to : msg.from;
    const fromAllowedGroup =
        !CONFIG.WA.SENDER_GROUP ||
        from.endsWith(CONFIG.WA.SENDER_GROUP);
    if (!fromAllowedGroup) return;

    if (msg.body.startsWith(CONFIG.CMD.SEND_MSG)) {
        sendReceivers(client, msg);
    } else if (msg.body === CONFIG.CMD.GET_STATUS) {
        getStatus(msg);
    } else if (msg.body === CONFIG.CMD.UPDATE_CONTACTS) {
        processContacts(client, msg);
    } else if (CONFIG.CMD.FORWARD_MODE && msg.body === CONFIG.CMD.FORWARD_MODE) {
        forwardMode = !forwardMode;
        client.sendMessage(CONFIG.WA.ADMIN_GROUP, `🤖 Modo reenvío: ${forwardMode ? 'activado' : 'desactivado'}`);
    }
}

client.on('message_ack', async (msg, ack) => {
    try {
        await Message.findOneAndUpdate(
            { 'id._serialized': msg.id._serialized },
            { $set: { ack } },
            { upsert: false }
        );
    } catch (err) {
        console.error('message_ack update error:', err);
    }

    // Webhook notification
    if (CONFIG.API?.WEBHOOK_URL) {
        fetch(CONFIG.API.WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                event: 'message_ack',
                messageId: msg.id._serialized,
                to: msg.to,
                ack,
                // ACK_ERROR:-1 ACK_PENDING:0 ACK_SERVER:1 ACK_DEVICE:2 ACK_READ:3 ACK_PLAYED:4
                timestamp: Date.now(),
            }),
        }).catch((err) => console.error('Webhook error:', err.message));
    }
});

client.on('disconnected', (reason) => {
    console.log('Client was logged out', reason);
});

// ---------------------------------------------------------------------------
// Scheduler — dispatches scheduled messages every 30 s
// ---------------------------------------------------------------------------
startScheduler(() => client);

// ---------------------------------------------------------------------------
// Express app
// ---------------------------------------------------------------------------
let forwardMode = false;

const app = express();

// Attach WhatsApp client to every request
app.use((req, _res, next) => {
    req.client = client;
    next();
});

app.use(cors());
app.use(helmet());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(morgan('tiny'));

app.set('view engine', 'ejs');
app.use('/', express.static(new URL('./views', import.meta.url).pathname));

app.use(basicAuth({
    users: { admin: CONFIG.API.LOGIN_PSSWD },
    challenge: true,
}));

app.use(
    gSheetController,
    clientController,
    viewController,
    messageController,
    qrController,
);

function notFound(req, res, next) {
    const error = new Error(`Not Found - ${req.originalUrl}`);
    error.status = 404;
    next(error);
}

function errorHandler(err, req, res, _next) {
    const status = err.status || 500;
    res.status(status).json({ status, error: err.message });
}

app.use(notFound);
app.use(errorHandler);

const expressPort = CONFIG.API.PORT || 3010;
app.listen(expressPort, () => {
    console.log(`Server started on port ${expressPort} (Node ${process.version})`);
});
