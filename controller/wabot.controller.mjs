import CONFIG from '../utils/config.mjs';
import { Message, Contact } from '../models/index.mjs';

// Load receivers from the local /fetchPhones endpoint
export async function getReceivers() {
    const response = await fetch(CONFIG.GSHEET.EXPRESS_API, {
        headers: { Authorization: `Basic ${Buffer.from(`admin:${CONFIG.API.LOGIN_PSSWD}`).toString('base64')}` },
    });
    const json = await response.json();
    console.log(`Receivers from Google Sheets: ${json.length}`);
    return json;
}

/**
 * Core bulk-send logic. Decoupled from WhatsApp message context so it
 * can be called both from WhatsApp commands and the REST API.
 *
 * @param {Client} client   - whatsapp-web.js client
 * @param {string} template - message body (supports %APODO% and %NOMBRE%)
 * @param {object} [media]  - optional { data, mimetype, filename } attachment
 * @returns {{ sent: number, errors: string[] }}
 */
export async function sendBulkMessages(client, template, media = null) {
    const receivers = await getReceivers();
    const valid = receivers.filter((r) => r.phone);

    if (valid.length > CONFIG.WA.MSG_LIMIT) {
        throw new Error(
            `Too many recipients: ${valid.length} exceeds limit of ${CONFIG.WA.MSG_LIMIT}`
        );
    }

    let sent = 0;
    const errors = [];

    for (const receiver of valid) {
        try {
            const number = receiver.phone.includes('@c.us')
                ? receiver.phone
                : `${receiver.phone}@c.us`;

            let text = template
                .replace('%APODO%', receiver.nickname || '')
                .replace('%NOMBRE%', receiver.name || '');

            let m;
            if (media) {
                m = await client.sendMessage(number, media, {
                    caption: text,
                });
            } else {
                m = await client.sendMessage(number, text);
            }

            await Message.findOneAndUpdate(
                { 'id._serialized': m.id._serialized },
                m,
                { upsert: true }
            );
            sent++;
        } catch (err) {
            console.error(`Error sending to ${receiver.phone}:`, err.message);
            errors.push(`${receiver.phone}: ${err.message}`);
        }
    }

    return { sent, errors };
}

/** WhatsApp command: !send <message> */
export async function sendReceivers(client, msg) {
    try {
        const chat = await msg.getChat();
        chat.sendStateTyping();

        const template = msg.body.slice(CONFIG.CMD.SEND_MSG.length + 1);

        let media = null;
        const quotedMsg = await msg.getQuotedMessage().catch(() => null);
        if (quotedMsg?.hasMedia) {
            media = await quotedMsg.downloadMedia();
        }

        const { sent, errors } = await sendBulkMessages(client, template, media);

        msg.reply(`Mensajes enviados: ${sent}${errors.length ? `\nErrores: ${errors.join(', ')}` : ''}`);
        chat.clearState();
    } catch (error) {
        console.error(error);
        msg.reply(`*ERROR EN EL BOT*\n ${error.message}`);
    }
}

/** WhatsApp command: !status */
export async function getStatus(msg) {
    try {
        const chat = await msg.getChat();
        chat.sendStateTyping();
        const receivers = await getReceivers();
        const valid = receivers.filter((r) => r.phone);

        if (valid.length > 0) {
            const names = valid.map((r) => r.name);
            msg.reply(`*🤖 BOT ACTIVO 🤖*\n${valid.length} destinatarios:\n_${names.join(', ')}_`);
        } else {
            msg.reply('*🤖 BOT ACTIVO 🤖* - No hay destinatarios');
        }
        chat.clearState();
    } catch (error) {
        console.error(error);
        msg.reply(`*ERROR EN EL BOT*\n ${error.message}`);
    }
}

/** WhatsApp command: !contacts */
export async function processContacts(client, msg) {
    try {
        const chat = await msg.getChat();
        chat.sendStateTyping();
        const receivers = await getReceivers();
        let counter = 0;

        for (const receiver of receivers) {
            if (!receiver.phone) continue;
            const number = receiver.phone.includes('@c.us')
                ? receiver.phone
                : `${receiver.phone}@c.us`;
            try {
                const contact = await client.getContactById(number);
                if (contact) {
                    await Contact.findOneAndUpdate(
                        { 'id._serialized': contact.id._serialized },
                        contact,
                        { upsert: true }
                    );
                    counter++;
                }
            } catch (err) {
                console.error(`Contact error for ${number}:`, err.message);
                msg.reply(`Contacto no encontrado: ${number}`);
            }
        }

        msg.reply(`Contactos procesados: ${counter}`);
        chat.clearState();
    } catch (error) {
        console.error(error);
        msg.reply(`*ERROR EN EL BOT*\n ${error.message}`);
    }
}

export async function sendImage(msg) {
    // TODO: implement
}

export async function sendAudio(msg) {
    // TODO: implement
}
