import express from 'express';


const viewController = express.Router();
import CONFIG from '../utils/config.mjs';

viewController.route('/').get(
    (req, res) => {
        var responseText = 'Hello World!';
        responseText += 'Requested at: ' + req.client + '';
        console.log("me vine al controler, te muestro la fecha del midleware wachin: "+JSON.stringify(responseText));
        
        // TODO: Show bot or client status

        res.render("index", { data: req.client ,spreadsheetId: CONFIG.GSHEET.SPREADSHEET_ID });

    }
);



export default viewController;