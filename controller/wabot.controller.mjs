import { randomUUID } from 'crypto';
import CONFIG from '../utils/config.mjs';
import { Contact, Job } from '../models/index.mjs';
import { getReceivers } from '../utils/get-receivers.mjs';
import { processBulkJob } from '../utils/jobs.mjs';

export { getReceivers };

/** WhatsApp command: !send <message> */
export async function sendReceivers(client, msg) {
    try {
        const chat = await msg.getChat();
        chat.sendStateTyping();

        const template = msg.body.slice(CONFIG.CMD.SEND_MSG.length + 1);

        let mediaInput = null;
        const quotedMsg = await msg.getQuotedMessage().catch(() => null);
        if (quotedMsg?.hasMedia) {
            const downloaded = await quotedMsg.downloadMedia();
            mediaInput = {
                data:     downloaded.data,
                mimetype: downloaded.mimetype,
                filename: downloaded.filename || 'media',
            };
        }

        const jobId = randomUUID();
        await Job.create({ jobId, status: 'queued', type: 'bulk', total: 0 });
        const { sent, errors } = await processBulkJob(client, jobId, template, mediaInput);

        msg.reply(
            `Mensajes enviados: ${sent}` +
            (errors.length ? `\nErrores: ${errors.join(', ')}` : '')
        );
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
