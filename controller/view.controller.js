import express from 'express';
let pm2 = require('pm2');

const viewController = express.Router();
const CONFIG = require('../utils/config.json');

viewController.route('/bot').get(
    (req, res) => {
        var responseText = 'Hello World!';
        responseText += 'Requested at: ' + req.client + '';
        console.log("me vine al controler, te muestro la fecha del midleware wachin: "+JSON.stringify(responseText));
        
        // TODO: Show bot or client status

        res.render("index", { data: req.client ,spreadsheetId: CONFIG.GSHEET_SPREADSHEET_ID });
        // pm2.connect(function (err) {
        //     if (err) {
        //         console.error(err);
        //         process.exit(2);
        //     }
        //     pm2.list((err, list) => {
        //         console.log(err, list);
        //         const proc = list.filter(ps => ps.name === CONFIG.PM2_PROC_NAME)
        //         res.render("index", { data: proc, spreadsheetId: CONFIG.GSHEET_SPREADSHEET_ID });
        //         pm2.disconnect();
        //     })
        // });
    }
);



export default viewController;