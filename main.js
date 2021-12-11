import express from 'express';
import bodyParser from 'body-parser';
import morgan from 'morgan';
import cors from 'cors';
import helmet from 'helmet';
import * as fs from 'fs';
import mongoose from 'mongoose';
import { Client } from 'whatsapp-web.js';
import { Message } from './models'
import {
    getStatus,
    sendReceivers,
    processContacts,
    gSheetController,
    pm2Controller,
    viewController
} from './controller';


const qrcode = require('qrcode-terminal');
const basicAuth = require('express-basic-auth')
const CONFIG = require('./utils/config.json');
const SESSION_FILE_PATH = './utils/session.json';
const app = express();

mongoose.connect(CONFIG.WA_BOT_MONGO_URI || 'mongodb://localhost/wa-bot', { useNewUrlParser: true });
mongoose.set('debug', true);


let sessionCfg;
if (fs.existsSync(SESSION_FILE_PATH)) {
    sessionCfg = require(SESSION_FILE_PATH);
}

let client;

console.log(`Environment -----> ${process.env.ENV}`);

if (process.env.ENV === CONFIG.ENV_ACC) {
    client = new Client({ puppeteer: { headless: true, executablePath: 'chromium-browser', args: ['--no-sandbox'] }, session: sessionCfg });

}
if (process.env.ENV === CONFIG.ENV_DEV || process.env.ENV === CONFIG.ENV_PRD) {
    client = new Client({ puppeteer: { headless: false, args: ['--no-sandbox'] }, session: sessionCfg });
}

client.initialize();


client.on('qr', (qr) => {
    // NOTE: This event will not be fired if a session is specified.
    qrcode.generate(qr, { small: true });
    console.log('QR RECEIVED', qr);
});

client.on('authenticated', (session) => {
    console.log('AUTHENTICATED', session);
    sessionCfg = session;
    fs.writeFile(SESSION_FILE_PATH, JSON.stringify(session), function (err) {
        if (err) {
            console.error(err);
        }
    });
});

client.on('auth_failure', msg => {
    // Fired if session restore was unsuccessfull
    console.error('AUTHENTICATION FAILURE', msg);
});

client.on('ready', () => {
    console.log('READY');
    client.sendMessage(CONFIG.ADMIN_GROUP, '🤖🤖🤖🤖🤖🤖🤖🤖\n       BOT PREPARADO    \n🤖🤖🤖🤖🤖🤖🤖🤖');

});

client.on('message_create', (msg) => {
    // console.log('<<<<< RECEIVED_1: ', msg);
    if (msg.fromMe) {
        if (msg.to.endsWith(CONFIG.ALLOWED_SENDER_GROUP)) {
            if (msg.body.startsWith(CONFIG.SEND_MSG_CMD)) {
                sendReceivers(client, msg);

            } else if (msg.body === CONFIG.GET_STATUS_CMD) {
                getStatus(msg);

            } else if (msg.body === CONFIG.CONTACTS_CMD) {
                processContacts(client, msg);

            }
        }
    }
});

client.on('message', async msg => {
    (msg.id.remote === 'status@broadcast') ? '' : console.log('<<<<< RECEIVED: ', msg);
    if (msg.from.endsWith(CONFIG.ALLOWED_SENDER_GROUP)) {
        if (msg.body.startsWith(CONFIG.SEND_MSG_CMD)) {
            sendReceivers(client, msg);

        } else if (msg.body === CONFIG.GET_STATUS_CMD) {
            getStatus(msg);

        } else if (msg.body === CONFIG.CONTACTS_CMD) {
            processContacts(client, msg);

        }
    }
});

client.on('message_ack', (msg, ack) => {
    /*
        == ACK VALUES ==
        ACK_ERROR: -1
        ACK_PENDING: 0
        ACK_SERVER: 1
        ACK_DEVICE: 2
        ACK_READ: 3
        ACK_PLAYED: 4
    */

    // Mongoose: findOneAndUpdate, search for message sent and update the ack value.
    Message.findOneAndUpdate({ "id._serialized": msg.id._serialized },
        { $set: { 'ack': ack } }, { upsert: false }, function (err, r) {
            if (err) console.log('error: ', err)
        })

});

client.on('change_battery', (batteryInfo) => {
    // Battery percentage for attached device has changed
    const { battery, plugged } = batteryInfo;
    console.log(`Battery: ${battery}% - Charging? ${plugged}`);
});

client.on('disconnected', (reason) => {
    console.log('Client was logged out', reason);
});



let clientMiddleware = function (req, res, next) {
    req.client = client;
    console.log("Estoy dentro del middleware, wachoooooooo.. re piola")
    next();
};

app.use('/bot', clientMiddleware);
app.use('/restartBot', clientMiddleware);
app.use('/stopBot', clientMiddleware);
app.use('/botStatus', clientMiddleware);

app.use(cors());
app.use(helmet());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(morgan('tiny'));

app.set("view engine", "ejs");

app.use("/", express.static(__dirname + "/views"));

app.use(basicAuth({
    users: { 'admin': CONFIG.LOGIN_PSSWD },
    challenge: true,
    // realm: 'foo',
}))


// API
app.use(gSheetController, pm2Controller, viewController);


function notFound(req, res, next) {
    const error = new Error(`Not Found - ${req.originalUrl}`);
    error.status = 404;
    next(error);
}

// eslint-disable-next-line
function errorHandler(err, req, res, next) {
    const status = err.status || 500;
    res.status(status);
    res.json({
        status,
        error: err.message,
    });
}

app.use(notFound);
app.use(errorHandler);

const expressPort = CONFIG.EXPRESS_PORT || 3010;

app.listen(expressPort, () => {
    console.log(`Started successfully server at port ${expressPort}`);

});