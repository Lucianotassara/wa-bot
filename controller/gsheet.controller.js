import express from 'express';
const CONFIG = require('../utils/config.json');

const gSheetController = express.Router();

gSheetController.get('/fetchPhones', async function(req, res){
  const { GoogleSpreadsheet } = require('google-spreadsheet');

  // Initialize the sheet - doc ID is the long id in the sheets URL
  const doc = new GoogleSpreadsheet(CONFIG.GSHEET.SPREADSHEET_ID);

  // Initialize Auth 
  await doc.useServiceAccountAuth({
    client_email: CONFIG.GSHEET.CLIENT_EMAIL,
    private_key: CONFIG.GSHEET.PRIVATE_KEY,
  });

  await doc.loadInfo(); // loads document properties and worksheets
  const sheet = doc.sheetsByIndex[0]; // or use doc.sheetsById[id] or doc.sheetsByTitle[title]
  const rows = await sheet.getRows();

  let to = []
  rows.forEach(function(row, index) {
    if (row.Enviar==="si"){
      let contact = {
        "name":row.Nombre || "",
        "nickname":row.Apodo || "",
        "phone":row.Celular || "",
        "role":row.Rol || "",
        "age":row.Grupo || "",
        "sex":row.Sexo || "",
        "send":row.Enviar || ""
      }
      console.log(contact);
      to.push(contact);
    }  
  });


  res.json(to);

})

export default gSheetController;