# wa-bot

WhatsApp bot built on [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js) that reads recipient lists from Google Sheets, sends personalised bulk messages, and exposes a REST API and web dashboard.

---

## Features

- Bulk WhatsApp messaging driven by a Google Sheets recipient list
- Personalised messages via `%APODO%` and `%NOMBRE%` placeholders
- Media forwarding (forward a quoted image/audio to all recipients)
- MongoDB persistence for every sent message and contact
- REST API (Basic Auth) for remote control and sending
- Web dashboard (EJS)
- PM2-ready with a clean `ecosystem.config.js`

---

## Tech stack

| Layer | Technology |
|---|---|
| Runtime | Node.js ≥ 24 (ESM `.mjs`) |
| WhatsApp | whatsapp-web.js + Puppeteer |
| Database | MongoDB / Mongoose 8 |
| Sheets | Google Sheets API v4 (google-spreadsheet) |
| HTTP | Express 5 |
| Auth | express-basic-auth |
| Process manager | PM2 |

---

## Repository structure

```
wa-bot/
├── index.mjs                        # Entry point — Express + WhatsApp client
├── package.json
├── ecosystem.config.js              # PM2 config
├── controller/
│   ├── index.mjs                    # Re-exports all controllers
│   ├── wabot.controller.mjs         # Core bot logic (bulk send, contacts, status)
│   ├── gsheet.controller.mjs        # GET  /fetchPhones  (Google Sheets)
│   ├── client.controller.mjs        # GET  /restartBot | /stopBot | /botStatus
│   ├── message.controller.mjs       # POST /sendMessage | /sendBulk  (REST API)
│   ├── view.controller.mjs          # GET  /  (dashboard)
│   └── reporter.controller.mjs      # Stub — MongoDB aggregation helpers
├── models/
│   ├── index.mjs
│   ├── message.model.mjs
│   └── contact.model.mjs
├── utils/
│   ├── config.sample.json           # Template → copy to config.mjs
│   └── session.sample.json          # Template → copy to session.json
└── views/
    ├── index.ejs
    ├── head.ejs / header.ejs
    └── css/main.css
```

---

## Setup

### 1 — Prerequisites

- Node.js ≥ 24
- MongoDB instance (local or Atlas)
- Google Cloud project with the **Google Sheets API** enabled and a **Service Account** key

### 2 — Clone and install

```bash
git clone https://github.com/Lucianotassara/wa-bot.git
cd wa-bot
npm install
```

### 3 — Configuration

```bash
cp utils/config.sample.json utils/config.mjs
```

Edit `utils/config.mjs` and fill in every field:

```jsonc
{
  "WA": {
    "MONGO_URI": "mongodb://localhost/wa-bot",
    "CLIENT_ID": "wa-bot",
    "ADMIN_GROUP": "XXXXXXXXXX@g.us",   // group JID that receives startup messages
    "SENDER_GROUP": "XXXXXXXXXX@g.us",  // group JID allowed to issue commands
    "MSG_LIMIT": 10                     // hard cap on bulk sends
  },
  "GSHEET": {
    "SPREADSHEET_ID": "<your-spreadsheet-id>",
    "CLIENT_EMAIL": "<service-account-email>",
    "PRIVATE_KEY": "<-----BEGIN RSA PRIVATE KEY----->",
    "EXPRESS_API": "http://localhost:3010/fetchPhones"
  },
  "API": {
    "PORT": 3010,
    "LOGIN_PSSWD": "changeme"
  },
  "CMD": {
    "SEND_MSG": "!send",
    "GET_STATUS": "!status",
    "UPDATE_CONTACTS": "!contacts"
  }
}
```

Place your Google Service Account JSON key at `utils/client_secret.json` (gitignored).

### 4 — First run (QR authentication)

```bash
npm run debug
```

Scan the QR code printed in the terminal with WhatsApp → **Linked Devices → Link a device**.
The session is persisted in `.wwebjs_auth/` so subsequent starts skip the QR step.

---

## Running

| Command | Description |
|---|---|
| `npm start` | Production (`node index.mjs`) |
| `npm run debug` | Dev with hot-reload (nodemon) |
| `pm2 start ecosystem.config.js` | PM2 managed process |

---

## REST API

All endpoints require **HTTP Basic Auth** (`admin` / value of `API.LOGIN_PSSWD`).

### Bot lifecycle

| Method | Path | Description |
|---|---|---|
| `GET` | `/botStatus` | Session info and client state |
| `GET` | `/restartBot` | Destroy and re-initialise client |
| `GET` | `/stopBot` | Disconnect client |

### Google Sheets

| Method | Path | Description |
|---|---|---|
| `GET` | `/fetchPhones` | Recipient list (rows where `Enviar = "si"`) |

### Messaging

| Method | Path | Body | Description |
|---|---|---|---|
| `POST` | `/sendMessage` | `{ "to": "5491112345678", "message": "Hola!" }` | Single message to one number |
| `POST` | `/sendBulk` | `{ "message": "Hola %APODO%!" }` | Bulk send to all Sheets recipients |

**Placeholders** supported in `message`:

| Placeholder | Google Sheets column |
|---|---|
| `%NOMBRE%` | `Nombre` |
| `%APODO%` | `Apodo` |

**Single message example**

```bash
curl -u admin:changeme \
     -X POST http://localhost:3010/sendMessage \
     -H "Content-Type: application/json" \
     -d '{"to":"5491112345678","message":"Hola!"}'
```

**Bulk send example**

```bash
curl -u admin:changeme \
     -X POST http://localhost:3010/sendBulk \
     -H "Content-Type: application/json" \
     -d '{"message":"Hola %APODO%, esto es un mensaje masivo."}'
```

---

## WhatsApp commands

Commands are issued by sending a message from the configured **SENDER_GROUP** (or from the bot number itself).

| Command | Description |
|---|---|
| `!send <message>` | Bulk-send `<message>` to all Sheet recipients. Quote a media message to forward it as an attachment. |
| `!status` | Reply with the number of active recipients and their names. |
| `!contacts` | Sync all Sheet recipients to the MongoDB `contacts` collection. |

---

## Google Sheets format

The spreadsheet must have the following columns in the **first sheet**:

| Column | Description | Required for sending |
|---|---|---|
| `Nombre` | Full name | Yes |
| `Apodo` | Nickname (`%APODO%` placeholder) | Yes |
| `Celular` | Phone number (international format, digits only) | Yes |
| `Rol` | Role / label | No |
| `Grupo` | Age group | No |
| `Sexo` | Gender | No |
| `Enviar` | Set to `si` to include in bulk send | Yes |

---

## MongoDB models

### Message

Stores every sent/received message: body, type, from/to, ACK status, media info, timestamps, mentions, and vCards.

ACK values: `ACK_ERROR=-1`, `ACK_PENDING=0`, `ACK_SERVER=1`, `ACK_DEVICE=2`, `ACK_READ=3`, `ACK_PLAYED=4`.

### Contact

Stores contact metadata: phone number, display name, business/enterprise flags, block status, and type (user / group / contact).

---

## Deployment — Azure App Service

The GitHub Actions workflow (`.github/workflows/main_wa-bot.yml`) triggers on push to `main`:

1. `npm install`
2. `npm run build --if-present`
3. Deploy to the `wa-bot` Azure Web App

Secret required in the repository settings:

| Secret | Description |
|---|---|
| `AZUREAPPSERVICE_PUBLISHPROFILE_*` | Azure publish profile |

---

## Known limitations

- `WA.MSG_LIMIT` (default `10`) caps bulk sends to avoid WhatsApp rate-limiting. Raise it carefully.
- If the WhatsApp session expires, delete `.wwebjs_auth/` and re-scan the QR on the next start.
- `reporter.controller.mjs` is a stub — a MongoDB aggregation pipeline is documented inside but not wired to any route yet.
- `sendImage()` and `sendAudio()` in `wabot.controller.mjs` are unimplemented stubs.
