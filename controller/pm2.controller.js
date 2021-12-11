import express from 'express';
let pm2 = require('pm2');
const pm2Controller = express.Router();
const CONFIG = require('../utils/config.json');


pm2Controller.route('/restartBot').get(
    (req, res) => {
        var responseText = 'Starting the client';
        if(req.client){
            req.client.destroy();
            req.client.initialize();
        } else {
            req.client.initialize();

        }
 
        res.json({status: "restarted"});

        // TODO: Show if client was successfully started

    }
);

pm2Controller.route('/stopBot').get(
    (req, res) => {
        var responseText = 'Destroying the client';
        req.client.destroy();

        res.json({status: "destroyed"});


        // TODO: Show if client was successfully destroyed
    }
);

pm2Controller.route('/botStatus').get(
    (req, res) => {
        
        // Show bot or client status
        let response = { 
            session: req.client.options.session,
            info: req.client.info
        };

        res.json(response);

    }
);

export default pm2Controller;