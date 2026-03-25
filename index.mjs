import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import helmet from 'helmet';
import * as fs from 'fs';
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
} from './controller/index.mjs';

import qrcode from 'qrcode-terminal';
import basicAuth from 'express-basic-auth';
import CONFIG from './utils/config.mjs';

const app = express();

mongoose.connect(CONFIG.WA.MONGO_URI || 'mongodb://localhost/wa-bot');

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

client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
    console.log('QR RECEIVED', qr);
});

client.on('authenticated', () => {
    console.log('AUTHENTICATED');
});

client.on('auth_failure', (msg) => {
    console.error('AUTHENTICATION FAILURE', msg);
});

client.on('ready', () => {
    console.log('READY');
    client.sendMessage(CONFIG.WA.ADMIN_GROUP, '🤖 BOT PREPARADO 🤖');
});

client.on('message', async (msg) => {
    if (msg.id.remote === 'status@broadcast') return;

    console.log('<<<<< RECEIVED:', msg.body);

    if (msg.body === '!ping') {
        msg.reply('pong');
        return;
    }

    const fromAllowedGroup = msg.from.endsWith(CONFIG.WA.SENDER_GROUP) || msg.fromMe;
    if (!fromAllowedGroup) {
        return;
    }

    if (msg.body.startsWith(CONFIG.CMD.SEND_MSG)) {
        sendReceivers(client, msg);
    } else if (msg.body === CONFIG.CMD.GET_STATUS) {
        getStatus(msg);
    } else if (msg.body === CONFIG.CMD.UPDATE_CONTACTS) {
        processContacts(client, msg);
    }
});

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
});

client.on('disconnected', (reason) => {
    console.log('Client was logged out', reason);
});

// Attach WhatsApp client to every request
app.use((req, res, next) => {
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
    users: { 'admin': CONFIG.API.LOGIN_PSSWD },
    challenge: true,
}));

app.use(gSheetController, clientController, viewController, messageController);

function notFound(req, res, next) {
    const error = new Error(`Not Found - ${req.originalUrl}`);
    error.status = 404;
    next(error);
}

function errorHandler(err, req, res, next) {
    const status = err.status || 500;
    res.status(status).json({ status, error: err.message });
}

app.use(notFound);
app.use(errorHandler);

const expressPort = CONFIG.API.PORT || 3010;
app.listen(expressPort, () => {
    console.log(`Server started on port ${expressPort} (Node ${process.version})`);
});
