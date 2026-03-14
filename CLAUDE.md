# CLAUDE.md — AI Assistant Guide for wa-bot

This file documents the codebase structure, development conventions, and workflows for AI assistants working on this project.

---

## Project Overview

**whatsapp-bot** is a Node.js application that:
- Automates WhatsApp messaging via [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js) (Puppeteer-based)
- Reads recipient lists from Google Sheets
- Sends bulk messages with personalized placeholders
- Persists message/contact data in MongoDB
- Exposes a web dashboard and REST API via Express

**Tech stack**: Node.js ESM (`.mjs`), Express, MongoDB/Mongoose, whatsapp-web.js, Puppeteer, Google Sheets API, EJS templates.

---

## Repository Structure

```
wa-bot/
├── index.mjs                    # App entry point — Express server + WhatsApp client setup
├── package.json                 # Dependencies and npm scripts
├── ecosystem.config.js          # PM2 process manager configuration
├── nodemon.json                 # Nodemon dev-watch configuration
├── controller/
│   ├── index.mjs                # Re-exports all controllers
│   ├── wabot.controller.mjs     # Core bot logic: bulk send, contacts, status
│   ├── gsheet.controller.mjs    # Google Sheets API: fetch recipient list
│   ├── client.controller.mjs    # Bot lifecycle: restart, stop, status
│   ├── view.controller.mjs      # Dashboard route (renders index.ejs)
│   └── reporter.controller.mjs  # Reporting stub (not yet implemented)
├── models/
│   ├── index.mjs                # Re-exports all models
│   ├── message.model.mjs        # Mongoose schema for sent/received messages
│   └── contact.model.mjs        # Mongoose schema for contacts
├── utils/
│   ├── config.sample.json       # Template for config.mjs (gitignored)
│   └── session.sample.json      # Template for session.json (gitignored)
├── views/
│   ├── index.ejs                # Dashboard UI
│   ├── head.ejs / header.ejs    # EJS partials
│   ├── css/main.css             # Custom styles
│   └── scss/                    # SCSS source (compiled manually)
└── .github/workflows/
    └── main_wa-bot.yml          # Azure App Service CI/CD (triggers on main)
```

---

## Gitignored / Secret Files

These files must be created locally and are **never committed**:

| File | Template | Purpose |
|------|----------|---------|
| `utils/config.mjs` | `utils/config.sample.json` | App config: MongoDB URI, spreadsheet ID, auth credentials |
| `utils/session.json` | `utils/session.sample.json` | WhatsApp session persistence |
| `utils/client_secret.json` | — | Google Service Account credentials (JSON key) |
| `.wwebjs_auth/` | — | WhatsApp authentication state (managed by whatsapp-web.js) |
| `.wwebjs_cache/` | — | Puppeteer browser cache |

---

## Key Conventions

### Module System
- All source files use **ESM** (`.mjs` extension, `import`/`export` syntax).
- No CommonJS `require()` — use `import` exclusively.
- The `esm` and `esm-wallaby` packages provide ESM compatibility shims.

### File Naming
- Source files: `kebab-case.mjs` (e.g., `wabot.controller.mjs`)
- Views: `kebab-case.ejs`
- Configuration: `camelCase.json` / `camelCase.mjs`

### Controllers
- Each controller module exports named async functions.
- Controllers are route handlers with signature `(req, res)`.
- Imported and registered in `index.mjs`.

### Error Handling
- Try/catch used in async controllers.
- Errors are logged to console and returned as HTTP 500 responses where applicable.

### Environment Variants
The app detects environment via `process.env.AMBIENTE` and adjusts Puppeteer launch flags:
- `ACC` / `DEV`: headless Chrome with `--no-sandbox`, `--disable-gpu`
- `PRD`: same flags, typically deployed to Azure App Service

---

## npm Scripts

| Script | Command | Use |
|--------|---------|-----|
| `npm start` | `node index.mjs` | Production startup |
| `npm run debug` | `nodemon index.mjs --inspect` | Dev with hot-reload + DevTools |
| `npm test` | `nodemon --inspect-brk --inspect=0.0.0.0:9229 index.mjs` | Debug with breakpoint on startup |

> **Note**: There are no automated tests. The `test` script is a debugger launcher, not a test runner.

---

## WhatsApp Bot Architecture

### Client Initialization (`index.mjs`)
1. Express server starts on port `3010` (or `process.env.PORT`).
2. MongoDB connects via URI from `config.mjs`.
3. WhatsApp `Client` is created with `LocalAuth` (stores session in `.wwebjs_auth/`).
4. QR code printed to terminal on first run for authentication.

### Command System
Incoming WhatsApp messages trigger commands via prefix `!`:

| Command | Handler | Description |
|---------|---------|-------------|
| `!send` | `sendReceivers()` | Bulk-send message to all sheet recipients |
| `!forward` | `sendReceivers()` | Forward a quoted media message to all recipients |
| `!status` | `getStatus()` | Reply with recipient count |
| `!contacts` | `processContacts()` | Sync all contacts to MongoDB |

### Bulk Messaging (`wabot.controller.mjs`)
- Recipients are fetched from Google Sheets (rows where `Enviar === "si"`).
- Messages support two placeholders: `%APODO%` (nickname) and `%NOMBRE%` (full name).
- A hard cap of **10 messages** (`MESSAGE_LIMIT`) is enforced to avoid WhatsApp blocks.
- Sent messages are saved to MongoDB with full metadata.

### Google Sheets Integration (`gsheet.controller.mjs`)
- Uses a Google Service Account (`client_secret.json`) to access the spreadsheet.
- Sheet columns mapped: `Nombre`, `Apodo`, `Celular`, `Rol`, `Grupo`, `Sexo`, `Enviar`.
- Only rows with `Enviar === "si"` are returned as recipients.

---

## REST API Endpoints

All API routes require **HTTP Basic Auth** (credentials in `config.mjs`).

| Method | Path | Controller | Description |
|--------|------|-----------|-------------|
| GET | `/` | `view.controller` | Dashboard (web UI) |
| GET | `/fetchPhones` | `gsheet.controller` | Returns recipient list from sheet |
| GET | `/restartBot` | `client.controller` | Restart WhatsApp client |
| GET | `/stopBot` | `client.controller` | Stop/disconnect client |
| GET | `/botStatus` | `client.controller` | Returns session/client state |

---

## MongoDB Models

### `Message`
Stores every sent/received message with: body, type, from/to, ACK status, media info, timestamps, forwarding flags, mentions, vCards, links.

### `Contact`
Stores contact metadata: phone, name, display name, business/enterprise flags, labels, block status, type (user/group/contact).

---

## Deployment

### CI/CD (Azure App Service)
- Pipeline: `.github/workflows/main_wa-bot.yml`
- Trigger: push to `main` branch
- Steps: `npm install` → `npm run build` (if present) → `npm test` (if present) → deploy artifact to Azure `wa-bot` app

### PM2 (Production Process Manager)
- Config: `ecosystem.config.js`
- App name: `wa-bot`
- Mode: fork (single process)
- Memory limit: 1 GB
- Auto-restart: disabled
- Start: `pm2 start ecosystem.config.js`

---

## Development Setup

1. Clone the repo.
2. Copy `utils/config.sample.json` → `utils/config.mjs` and fill in values.
3. Copy `utils/session.sample.json` → `utils/session.json`.
4. Add `utils/client_secret.json` (Google Service Account key).
5. Run `npm install`.
6. Run `npm run debug` — scan the QR code in the terminal to authenticate WhatsApp.

---

## Known Issues / Technical Debt

- **No automated tests** — the `test` script is a debugger launcher only.
- **`reporter.controller.mjs`** is a stub with no implementation.
- **`sendImage()` / `sendAudio()`** in `wabot.controller.mjs` are unimplemented stubs.
- **`node-fecth`** in `package.json` is a typo (should be `node-fetch`) and is the `0.0.1-security` placeholder package.
- **`MESSAGE_LIMIT = 10`** hardcoded — should be configurable.
- **`google-spreadsheet@^3.1.15`** is outdated (current major is v4+); API usage may drift.
- **`mongoose@^5.x`** is outdated (current is v8+).
- **`request`** package is deprecated — consider replacing with `node-fetch` or `axios`.
- **SCSS** files are present but no build step is configured for them.
- PM2 `ecosystem.config.js` hardcodes a NVM path that may not match the deployment environment.
