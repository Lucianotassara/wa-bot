require('dotenv').config()
import * as fs from 'fs';
import { Client } from 'whatsapp-web.js';
import mongoose from 'mongoose';
import { Message } from './models'
import  { getStatus, sendReceivers, processContacts } from './controller';

const CONFIG = require('./utils/config.json');
const SESSION_FILE_PATH = './utils/session.json'; 

mongoose.connect(process.env.WA_BOT_MONGO_URI || 'mongodb://localhost/wa-bot', {useNewUrlParser: true});
mongoose.set('debug', true);

let sessionCfg;
if (fs.existsSync(SESSION_FILE_PATH)) {
    sessionCfg = require(SESSION_FILE_PATH);
}

let client; 

console.log(`Environment -----> ${process.env.ENV}`);

if(process.env.ENV === CONFIG.ENV_ACC){
    client = new Client({ puppeteer: { headless: true, executablePath: 'chromium-browser', args: ['--no-sandbox'] }, session: sessionCfg });
    
} 
if(process.env.ENV === CONFIG.ENV_DEV || process.env.ENV === CONFIG.ENV_PRD ){
    client = new Client({ puppeteer: { headless: true, args: ['--no-sandbox'] }, session: sessionCfg });

}

client.initialize();

client.on('qr', (qr) => {
    // NOTE: This event will not be fired if a session is specified.
    console.log('QR RECEIVED', qr);
});

client.on('authenticated', (session) => {
    console.log('AUTHENTICATED', session);
    sessionCfg=session;
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

client.on('message', async msg => {
    (msg.id.remote === 'status@broadcast') ? '' : console.log('<<<<< RECEIVED: ', msg);
    if(msg.from.endsWith(CONFIG.ALLOWED_SENDER_GROUP)){
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
        Message.findOneAndUpdate({"id._serialized": msg.id._serialized}, 
           { $set: { 'ack': ack}} , {upsert: false}, function (err, r) {
        if(err) console.log('error: ',err)
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


client.on('message_create', (msg) => {
    // Fired on all message creations, including your own
    // console.log('>>>>> SENT: ', msg);
});