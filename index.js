require('dotenv').config()
const fs = require('fs');
const fetch = require('node-fetch');
const { Client } = require('whatsapp-web.js');


const CONFIG = require('./config.json');

const ALLOWED_SENDER_GROUP = CONFIG.ALLOWED_SENDER_GROUP;
const SESSION_FILE_PATH = './session.json';
const MAX_ALLOWED_MSG = 200;

let sessionCfg;
if (fs.existsSync(SESSION_FILE_PATH)) {
    sessionCfg = require(SESSION_FILE_PATH);
}

let receivers = {}

// Load receivers from an API
async function getReceivers(){
    try {
        const response = await fetch(CONFIG.GSHEET_EXPRESS_API, {
            headers: {'Authorization': CONFIG.WA_BOT_SECRET}
        });
        const json = await response.json();
        console.log(`Haciendo fetch a gsheet-extraction-microservice para obtener los remitentes`)
        console.log(`Datos de Google Sheets: ${JSON.stringify( json )}`);
        return json;

    } catch (error) {
        console.error(error);
    }
}

const client = new Client({ puppeteer: { headless: true, args: ['--no-sandbox'] }, session: sessionCfg });
// You can use an existing session and avoid scanning a QR code by adding a "session" object to the client options.
// This object must include WABrowserId, WASecretBundle, WAToken1 and WAToken2.

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

});

client.on('message', async msg => {
    console.log('MESSAGE RECEIVED', msg);
    // Only allowing comands from one group.
    if(msg.from.endsWith(ALLOWED_SENDER_GROUP)){
        console.log('Enviado desde grupo BOT');
        if (msg.body === '!cargar-destinatarios') {
            try {
                const chat = await msg.getChat();
                chat.sendStateTyping();
                receivers = await getReceivers();
                var res = receivers.filter(val => {
                    return val.phone
                })
                console.log(`Cantidad de destinatarios ${res.length}`)
                msg.reply(`Se cargaron ${res.length} destinatarios`);
                chat.clearState();
                
            } catch (error) {
                msg.reply(`*HA OCURRIDO UN ERROR EN EL BOT*`);
            }
        } else if (msg.body === '!borrar-destinatarios') {
            const chat = await msg.getChat();
            chat.sendStateTyping();
            // simulates typing in the chat
            receivers = {};
            msg.reply(`Se han eliminado los destinatarios cargados.`);
            chat.clearState();
            
        } else if (msg.body.startsWith('!enviar-destinatarios')) {
            try {
                const chat = await msg.getChat();
                chat.sendStateTyping();
                // simulates typing in the chat
                receivers = await getReceivers();
                var res = receivers.filter(val => {
                    return val.phone
                })
                console.log(`Cantidad de destinatarios ${res.length}`)

                // Setting up a limit of MAX_ALLOWED_MSG receivers to avoid being blocked by whatsapp
                if(res.length <= MAX_ALLOWED_MSG ){
                    const quotedMsg = await msg.getQuotedMessage();
                    console.log('Showing quoted message',quotedMsg);
                    let attachmentData;
                    (quotedMsg && quotedMsg.hasMedia) ?  attachmentData = await quotedMsg.downloadMedia() : ''
                    originalMessage = msg.body.slice(22);
                    let counter = 0;
                    for (const receiver of receivers) {
                        console.log('showing this receiver.. '+receiver.nickname);
                        let number = receiver.phone;
                        let message = originalMessage.replace('%APODO%',receiver.nickname);
                        message = message.replace('%NOMBRE%', receiver.name);
                        number = number.includes('@c.us') ? number : `${number}@c.us`;
                        let chat = await msg.getChat();
                        chat.sendSeen();
                        console.log(`Sending message to ${receiver.name}`);
                        (quotedMsg && quotedMsg.hasMedia) 
                            ? client.sendMessage(number, attachmentData, (quotedMsg.type==='audio') 
                                ? {sendAudioAsVoice: true, caption: message} 
                                : {caption: message} 
                            )
                            : client.sendMessage(number, message); 
                        counter++;                            
                    }
                    msg.reply(`Se enviaron mensajes a ${counter} destinatarios`);  
                } else {
                    msg.reply(`*HA OCURRIDO UN ERROR EN EL BOT* - Demasiados destinatarios. No se puede enviar a mas de ${MAX_ALLOWED_MSG}, se cargaron ${res.length} destinatarios`);  
                }
                chat.clearState();

            } catch (error) {
                msg.reply(`*HA OCURRIDO UN ERROR EN EL BOT* ${error}`);
                console.log(error);
            }
            
        } else if (msg.body === '!estado') {
            try {
                const chat = await msg.getChat();
                chat.sendStateTyping();
                // simulates typing in the chat
                receivers = await getReceivers();
                var res = receivers.filter(val => {
                    return val.phone
                })
                console.log(`Cantidad de destinatarios ${res.length}`)

                if(Object.keys(receivers).length > 0 ){
                    var names = receivers.map(function (receiver) {
                        return receiver.name; 
                    });
            
                    // Send a new message as a reply to the current one
                    msg.reply('*BOT ACTIVO* - ' + res.length + ' Destinatarios:\n' +'_'+ JSON.stringify(names)+'_');
                    console.log(JSON.stringify(receivers));
                } else {
                    msg.reply(`*BOT ACTIVO* - No hay destinatarios`);
                }
                chat.clearState();
            } catch (error) {
                msg.reply(`*HA OCURRIDO UN ERROR EN EL BOT* ${error}`);
                console.log(error);
            }
        }
    }
 
});

let acknowledges = []

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

    if(ack == -1) {
        let status = {"ack":"ERROR", " msg": msg.id}
        console.log(`Acnowledge -> ${JSON.stringify(status)}`)
        acknowledges.push(status);
    }
    if(ack == 0) {
        let status = {"ack":"PENDING", "msg": msg.id}
        console.log(`Acnowledge -> ${JSON.stringify(status)}`)
        acknowledges.push(status);
    }
    if(ack == 1) {
        let status = {"ack":"SERVER", "msg": msg.id}
        console.log(`Acnowledge -> ${JSON.stringify(status)}`)
        acknowledges.push(status);    }
    if(ack == 2) {
        let status = {"ack":"DEVICE", "msg": msg.id}
        console.log(`Acnowledge -> ${JSON.stringify(status)}`)
        acknowledges.push(status);    }
    if(ack == 3) {
        let status = {"ack":"READ", "msg": msg.id}
        console.log(`Acnowledge -> ${JSON.stringify(status)}`)
        acknowledges.push(status);    }
    if(ack == 4) {
        let status = {"ack":"PLAYED", "msg": msg.id}
        console.log(`Acnowledge -> ${JSON.stringify(status)}`)
        acknowledges.push(status);    }
});

client.on('change_battery', (batteryInfo) => {
    // Battery percentage for attached device has changed
    const { battery, plugged } = batteryInfo;
    console.log(`Battery: ${battery}% - Charging? ${plugged}`);
});

client.on('disconnected', (reason) => {
    console.log('Client was logged out', reason);
});