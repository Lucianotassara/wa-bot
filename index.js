require('dotenv').config()
const fs = require('fs');
const fetch = require('node-fetch');
const { Client, MessageAck } = require('whatsapp-web.js');

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

// const client = new Client({ puppeteer: { headless: true, args: ['--no-sandbox'] }, session: sessionCfg });
let client; 
console.log(`AMBIENTE -----> ${process.env.ENV}`);
    if(process.env.ENV === 'raspi'){
        client = new Client({ puppeteer: { headless: true, executablePath: 'chromium-browser', args: ['--no-sandbox'] }, session: sessionCfg });
        
    } 
    if(process.env.ENV==='desa' || process.env.ENV==='prod' ){
        client = new Client({ puppeteer: { headless: true, args: ['--no-sandbox'] }, session: sessionCfg });

    }


// You can use an existing session and avoid scanning a QR code by adding a "session" object to the client options.
// This object must include WABrowserId, WASecretBundle, WAToken1 and WAToken2.

client.initialize();

/************************************************************************** */
var mongoose = require('mongoose');
mongoose.connect(process.env.WA_BOT_MONGO_URI || 'mongodb://localhost/wa-bot', {useNewUrlParser: true});
mongoose.set('debug', true);

var Schema = mongoose.Schema;

let RemoteSchema = mongoose.Schema({
    server: {type: String},
    user: {type: String},
    _serialized: {type: String}
  });
  
let IdSchema = mongoose.Schema({
    fromMe: {type: Boolean},
    remote: {
        type: RemoteSchema,
        required: true
    },
    id: {type: String},
    _serialized: {type: String}
    });

let MessageSchema = new Schema({
    mediaKey: {type: String},
    id: {
        type: IdSchema,
        required: true
    },
    ack: {type: Number},
    hasMedia: {type: Boolean},
    body: {type: String},
    type: {type: String},
    timestamp: {type: Number},
    from: {type: String},
    to: {type: String},
    author: {type: String},
    isForwarded: {type: Boolean},
    isStatus: {type: Boolean},
    isStarred: {type: Boolean},
    broadcast: {type: String},
    fromMe: {type: Boolean},
    hasQuotedMsg: {type: Boolean},
    location: {type: String},
    vCards: [],
    mentionedIds: [],
    links: {type: String},
    created: {
        type: Date,
        default: Date.now
    }
});

let ContactIdSchema = mongoose.Schema({
    server: {type: String},
    user: {type: String},
    _serialized: {type: String}
    
});

let ContactSchema = mongoose.Schema({
    id: {
        type: ContactIdSchema,
        required: true
    },
    number: {type: String},
    isBusiness: {type: Boolean},
    isEnterprise: {type: Boolean},
    labels: [],
    name: {type: String},
    pushname: {type: String},
    sectionHeader: {type: String},
    shortName: {type: String},
    statusMute: {type: Boolean},
    type: {type: String},
    verifiedLevel: {type: String},
    verifiedName: {type: String},
    isMe: {type: Boolean},
    isUser: {type: Boolean},
    isGroup: {type: Boolean},
    isWAContact: {type: Boolean},
    isMyContact: {type: Boolean},
    isBlocked: {type: Boolean}
      
});


    

const MessageModel = mongoose.model("Message", MessageSchema);
const ContactModel = mongoose.model("Contact", ContactSchema);
/*************************************************************************** */



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
    // (msg.id.remote === 'status@broadcast') ? '' : console.log('<<<<< RECIBIDO: ', msg);
    if(msg.from.endsWith(ALLOWED_SENDER_GROUP)){    // Only allowing comands from one group.
        if (msg.body.startsWith('!enviar-destinatarios')) {
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
                        let m
                        (quotedMsg && quotedMsg.hasMedia) 
                            ? m = client.sendMessage(number, attachmentData, (quotedMsg.type==='audio') 
                                ? {sendAudioAsVoice: true, caption: message} 
                                : {caption: message}).then(m => {
                                    MessageModel.findOneAndUpdate({"id._serialized": m.id._serialized}, m, {upsert: true}, function (err, r) {
                                        if(err) console.log('error: ',err)
                                    })
                                }) 
                            : m = client.sendMessage(number, message).then(m => {
                                MessageModel.findOneAndUpdate({"id._serialized": m.id._serialized}, m, {upsert: true}, function (err, r) {
                                    if(err) console.log('error: ',err)
                                })
                            }); 
                        // console.log(`>>>>> ENVIADO: `,await m)
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
        } else if (msg.body === '!contactos') {
            try {
                const chat = await msg.getChat();
                chat.sendStateTyping();
                receivers = await getReceivers();
                var res = receivers.filter(val => {
                    return val.phone
                })
                console.log(`Cantidad de destinatarios ${res.length}`)
                let counter = 0;
                for (const receiver of receivers) {
                    console.log('showing this receiver.. '+receiver.nickname);
                    let number = receiver.phone;
                    number = number.includes('@c.us') ? number : `${number}@c.us`;
                    let contact 
                    try {
                        contact = await client.getContactById(number);
                        if (contact !== undefined ) {
                            msg.reply(`*Nombre: ${contact.name}*\n`+
                            `   Numero: ${contact.number}\n` +
                            `   Pushname: ${contact.pushname}\n` +
                            `   ShortName: ${contact.shortname}`);
                            console.log(`Showing contact: `,contact);
                                
                            //save contact on mongodb:
                            ContactModel.findOneAndUpdate({"id._serialized": contact.id._serialized}, contact, {upsert: true}, function (err, r) {
                                if(err) console.log('error: ',err)
                            });          
                        }else{
                            // msg.reply(`*Contacto no agendado...${number}*`)
                        }
                    } catch (error) {
                        console.log(error)
                        msg.reply(`*Contacto no agendado...${number}*`)
                    }
                    counter++;                           
                }
                // msg.reply(`Se consultaron ${counter} destinatarios`);  
              
                chat.clearState();
            } catch (error) {
                msg.reply(`*HA OCURRIDO UN ERROR EN EL BOT* ${error}`);
                console.log(error);
            }
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
        MessageModel.findOneAndUpdate({"id._serialized": msg.id._serialized}, 
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
    if (msg.fromMe) {        
        // TODO: MongoDB, save the message here
        // console.log(message);
        

        

    }
});