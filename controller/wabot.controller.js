const CONFIG = require('../utils/config.json');
import { Message, Contact } from '../models'

import fetch from 'node-fetch';


// Load receivers from an API
export async function getReceivers(){
    try {
        const response = await fetch(CONFIG.GSHEET.EXPRESS_API, {
            headers: {'Authorization': CONFIG.WA.SECRET}
        });
        const json = await response.json();
        console.log(`Haciendo fetch a gsheet-extraction-microservice para obtener los remitentes`)
        console.log(`Datos de Google Sheets: ${JSON.stringify( json )}`);
        return json;

    } catch (error) {
        console.error(error);
    }
}

/**Enviar destinatarios */
export async function sendReceivers(client, msg){
    try {
        const chat = await msg.getChat();
        chat.sendStateTyping();
        // simulates typing in the chat
        let receivers = await getReceivers();
        var res = receivers.filter(val => {
            return val.phone
        })
        console.log(`Cantidad de destinatarios ${res.length}`)

        // Setting up a limit of CONFIG.WA.MSG_LIMIT receivers to avoid being blocked by whatsapp
        if(res.length <= CONFIG.WA.MSG_LIMIT ){
            const quotedMsg = await msg.getQuotedMessage();
            console.log('Showing quoted message',quotedMsg);
            let attachmentData;
            (quotedMsg && quotedMsg.hasMedia) ?  attachmentData = await quotedMsg.downloadMedia() : ''
            let originalMessage = msg.body.slice(CONFIG.CMD.SEND_MSG.length + 1);
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
                    ? m = client.sendMessage(number, attachmentData, 
                        (quotedMsg.type==='audio' || quotedMsg.type==='ptt') 
                            ? {sendAudioAsVoice: true, caption: message} 
                            : {caption: message}).then(m => {
                                Message.findOneAndUpdate({"id._serialized": m.id._serialized}, m, {upsert: true}, function (err, r) {
                                    if(err) console.log('error: ',err)
                                })
                            }) 
                    : m = client.sendMessage(number, message).then(m => {
                        Message.findOneAndUpdate({"id._serialized": m.id._serialized}, m, {upsert: true}, function (err, r) {
                            if(err) console.log('error: ',err)
                        })
                    }); 
                // console.log(`>>>>> ENVIADO: `,await m)
                counter++;                            
            }
            msg.reply(`Se enviaron mensajes a ${counter} destinatarios`);  
        } else {
            msg.reply(`*💔💔 HA OCURRIDO UN ERROR EN EL BOT 💔💔*\n - Demasiados destinatarios. No se puede enviar a mas de ${CONFIG.WA.MSG_LIMIT}, se cargaron ${res.length} destinatarios`);  
        }
        chat.clearState();

    } catch (error) {
        msg.reply(`*💔💔 HA OCURRIDO UN ERROR EN EL BOT 💔💔*\n ${error}`);
        console.log(error);
    }
}
    /** Foto */
    export async function sendImage(msg){
        
    }
    /** Audio */
    export async function sendAudio(msg){
        
    }

/** Estado */
export async function getStatus(msg){
    try {
        const chat = await msg.getChat();
        chat.sendStateTyping();
        // simulates typing in the chat
        let receivers = await getReceivers();
        var res = receivers.filter(val => {
            return val.phone
        })
        console.log(`Cantidad de destinatarios ${res.length}`)

        if(Object.keys(receivers).length > 0 ){
            var names = receivers.map(function (receiver) {
                return receiver.name; 
            });
            // Send a new message as a reply to the current one
            msg.reply('*🤖 BOT ACTIVO 🤖*\n ' + res.length + ' Destinatarios:\n' +'_'+ JSON.stringify(names)+'_');
            console.log(JSON.stringify(receivers));
            chat.clearState();
            return true;
        } else {
            msg.reply(`*🤖 BOT ACTIVO 🤖* - No hay destinatarios`);
            chat.clearState();
            return false;
        }
    } catch (error) {
        msg.reply(`*💔💔 HA OCURRIDO UN ERROR EN EL BOT 💔💔*\n ${error}`);
        console.log(error);
    }
}

/** Contactos */
export async function processContacts(client, msg){
    try {
        const chat = await msg.getChat();
        chat.sendStateTyping();
        let receivers = await getReceivers();
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
                    Contact.findOneAndUpdate({"id._serialized": contact.id._serialized}, contact, {upsert: true}, function (err, r) {
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
        msg.reply(`*💔💔 HA OCURRIDO UN ERROR EN EL BOT 💔💔*\n ${error}`);
        console.log(error);
    }
}
