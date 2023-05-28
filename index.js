import express from 'express';
import bodyParser from 'body-parser';
import morgan from 'morgan';
import cors from 'cors';
import helmet from 'helmet';
import * as fs from 'fs';
import mongoose from 'mongoose';
import { Client, LocalAuth  } from 'whatsapp-web.js';
import { Message } from './models'

import {
    getStatus,
    sendReceivers,
    processContacts,
    gSheetController,
    clientController,
    viewController
} from './controller';

const qrcode = require('qrcode-terminal');
const basicAuth = require('express-basic-auth')


const CONFIG = require('./utils/config.json');
const SESSION_FILE_PATH = './utils/session.json';
const app = express();
let forwardMode = false;

mongoose.connect(CONFIG.WA.MONGO_URI || 'mongodb://localhost/wa-bot', { useNewUrlParser: true });
mongoose.set('debug', true);


let sessionCfg;
if (fs.existsSync(SESSION_FILE_PATH)) {
    sessionCfg = require(SESSION_FILE_PATH);
}

let client;

console.log(`Environment -----> ${process.env.ENV}`);

if (process.env.ENV === CONFIG.ENV.ACC) {
    client = new Client({ 
        puppeteer: { 
            headless: CONFIG.ENV.HEADLESS, 
            executablePath: 'chromium-browser', 
            args: ['--no-sandbox'] 
        },
        authStrategy: new LocalAuth({ clientId: CONFIG.WA.CLIENT_ID })
    });

}
if (process.env.ENV === CONFIG.ENV.DEV || process.env.ENV === CONFIG.ENV.PRD) {
    client = new Client({
        puppeteer: { 
            headless: CONFIG.ENV.HEADLESS, 
            args: ['--no-sandbox'] 
        }, 
        authStrategy: new LocalAuth({ clientId: CONFIG.WA.CLIENT_ID }) 
    });
}

client.initialize();


client.on('qr', (qr) => {
    // NOTE: This event will not be fired if a session is specified.
    qrcode.generate(qr, { small: true });
    console.log('QR RECEIVED', qr);
    qrcode.generate(qr, {small: true});
});

client.on('authenticated', () => {
    console.log('AUTHENTICATED');
});

client.on('auth_failure', msg => {
    // Fired if session restore was unsuccessfull
    console.error('AUTHENTICATION FAILURE', msg);
});

client.on('ready', () => {
    console.log('READY');
    client.sendMessage(CONFIG.WA.ADMIN_GROUP, '🤖🤖🤖🤖🤖🤖🤖🤖\n       BOT PREPARADO    \n🤖🤖🤖🤖🤖🤖🤖🤖');

});

client.on('message_create', (msg) => {
    // console.log('<<<<< RECEIVED_1: ', msg);
    if (msg.fromMe) {
        if (msg.to.endsWith(CONFIG.WA.SENDER_GROUP)) {
            if(msg.body.startsWith('!')){
                if (msg.body.startsWith(CONFIG.CMD.SEND_MSG)) {
                    sendReceivers(client, msg);

                } else if (msg.body === CONFIG.CMD.GET_STATUS) {
                    getStatus(msg);

                } else if (msg.body === CONFIG.CMD.UPDATE_CONTACTS) {
                    processContacts(client, msg);

                }else if (msg.body === CONFIG.CMD.FORWARD_MODE) {
                    forwardMode = !forwardMode;
                    client.sendMessage(CONFIG.WA.ADMIN_GROUP, `🤖🤖 Forward mode status: ${forwardMode}` );
                    
                }
            } else {
                let comands = CONFIG;
                comands.filter(function(key){
                    return key.type.endsWith()
                })
                msg.reply(`*🤓🤓🤓 No se reconoce el comando 🤓🤓🤓*\n Posibles comandos: \n `);
            }
        }
    }
});

client.on('message', async msg => {
    (msg.id.remote === 'status@broadcast') ? '' : console.log('<<<<< RECEIVED: ', msg);
    if (msg.from.endsWith(CONFIG.WA.SENDER_GROUP)) {
        if (msg.body.startsWith(CONFIG.CMD.SEND_MSG)) {
            sendReceivers(client, msg);

        } else if (msg.body === CONFIG.CMD.GET_STATUS) {
            getStatus(msg);
            
        } else if (msg.body === CONFIG.CMD.UPDATE_CONTACTS) {
            processContacts(client, msg);
            
        } else if (msg.body === CONFIG.CMD.FORWARD_MODE) {
            forwardMode = !forwardMode;
            client.sendMessage(CONFIG.WA.ADMIN_GROUP, `🤖🤖 Forward mode status: ${forwardMode}` );
            
        }
    } else if(forwardMode){
        client.sendMessage(CONFIG.WA.ADMIN_GROUP, 'Forwarded message from: *'+ msg.data.notifyName + '*\nMessage body: \n'+msg.body);
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

client.on('message', msg => {
    if (msg.body == '!ping') {
        msg.reply('pong');
    }
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

app.use('/', clientMiddleware);
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
    users: { 'admin': CONFIG.API.LOGIN_PSSWD },
    challenge: true,
    // realm: 'foo',
}))


// API
app.use(gSheetController, clientController, viewController);


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

const expressPort = CONFIG.API.PORT || 3010;

app.listen(expressPort, () => {
    console.log(`Started successfully server at port ${expressPort}`);

});