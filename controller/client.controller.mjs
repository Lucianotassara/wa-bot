import express from 'express';
const clientController = express.Router();

clientController.route('/restartBot').get((req, res) => {
    var responseText = 'Starting the client';
    if (req.client) {
        req.client.destroy();
        req.client.initialize();
    } else {
        req.client.initialize();
    }
    res.json({ status: "restarted" });
    // TODO: Show if client was successfully started
});

clientController.route('/stopBot').get((req, res) => {
    var responseText = 'Destroying the client';
    req.client.destroy();
    res.json({ status: "destroyed" });
    // TODO: Show if client was successfully destroyed
});

clientController.route('/botStatus').get((req, res) => {
    // Show bot or client status
    let response = {
        session: req.client.options.session,
        info: req.client.info
    };
    res.json(response);
});

export default clientController;
