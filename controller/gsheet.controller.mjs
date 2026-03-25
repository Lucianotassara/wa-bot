import express from 'express';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import CONFIG from '../utils/config.mjs';

const gSheetController = express.Router();

gSheetController.get('/fetchPhones', async (req, res) => {
    const auth = new JWT({
        email: CONFIG.GSHEET.CLIENT_EMAIL,
        key: CONFIG.GSHEET.PRIVATE_KEY,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const doc = new GoogleSpreadsheet(CONFIG.GSHEET.SPREADSHEET_ID, auth);
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];
    const rows = await sheet.getRows();

    const recipients = rows
        .filter((row) => row.get('Enviar') === 'si')
        .map((row) => ({
            name: row.get('Nombre') || '',
            nickname: row.get('Apodo') || '',
            phone: row.get('Celular') || '',
            role: row.get('Rol') || '',
            age: row.get('Grupo') || '',
            sex: row.get('Sexo') || '',
            send: row.get('Enviar') || '',
        }));

    res.json(recipients);
});

export default gSheetController;
