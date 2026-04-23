import CONFIG from './config.mjs';

/**
 * Fetch the recipient list from the local /fetchPhones endpoint,
 * which in turn reads from Google Sheets.
 *
 * @returns {Promise<Array<{ name, nickname, phone, role, age, sex, send }>>}
 */
export async function getReceivers() {
    const credentials = Buffer.from(`admin:${CONFIG.API.LOGIN_PSSWD}`).toString('base64');
    const response = await fetch(CONFIG.GSHEET.EXPRESS_API, {
        headers: { Authorization: `Basic ${credentials}` },
    });
    if (!response.ok) {
        throw new Error(`Failed to fetch receivers: ${response.status} ${response.statusText}`);
    }
    return response.json();
}
