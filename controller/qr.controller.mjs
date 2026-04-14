import express from 'express';
import qrcode from 'qrcode';

const qrController = express.Router();

// In-memory QR state — updated by index.mjs event handlers
let latestQR = null;
let isAuthenticated = false;

export function setLatestQR(qr) {
    latestQR = qr;
    isAuthenticated = false;
}

export function setAuthenticated() {
    isAuthenticated = true;
    latestQR = null;
}

/**
 * GET /qr
 *
 * Returns:
 *   - 200 image/png      — QR image ready to scan
 *   - 200 application/json { status: 'authenticated' } — session already active
 *   - 503 application/json { status: 'waiting' }       — QR not yet generated
 */
qrController.get('/qr', async (req, res) => {
    if (isAuthenticated) {
        return res.status(200).json({
            status: 'authenticated',
            message: 'WhatsApp session is active. No QR needed.',
        });
    }

    if (!latestQR) {
        return res.status(503).json({
            status: 'waiting',
            message: 'QR not yet generated. Wait a few seconds and retry.',
        });
    }

    const png = await qrcode.toBuffer(latestQR);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-store');
    res.send(png);
});

export default qrController;
