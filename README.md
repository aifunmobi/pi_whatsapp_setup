# Pi WhatsApp Setup

Minimal, public-safe starter repo for connecting [Pi Agent](https://github.com/rusiaaman/pi) to WhatsApp using WhatsApp Web via Baileys.

This is for personal/local automation. It does not use Meta's official WhatsApp
Cloud API. It links a WhatsApp account using a QR code, receives messages
locally, invokes the `pi` CLI, and sends the reply back to WhatsApp.

## Important Safety Notes

- WhatsApp Web automation is unofficial and can be fragile. Use a dedicated
  assistant number when possible.
- Always set `WHATSAPP_ALLOWED_SENDERS`.
- Never commit `.env`, `session/`, logs, QR files, or secrets.
- Start in `self-chat` mode only if you understand that messages you send to
  yourself are treated as Pi input.

## Quick Start

Install Pi and make sure a model works:

```bash
pi --version
pi --offline --list-models
```

Install Node dependencies:

```bash
npm install
```

Configure:

```bash
cp .env.example .env
$EDITOR .env
```

At minimum, set:

```dotenv
WHATSAPP_ALLOWED_SENDERS=15551234567
WHATSAPP_MODE=self-chat
```

Pair WhatsApp:

```bash
npm run pair
open pairing/latest-qr.html
```

Scan the QR from WhatsApp `Linked devices`.

Start the gateway:

```bash
npm start
```

Open the health endpoint:

```bash
curl http://127.0.0.1:3091/health
```

Then send a WhatsApp message from the allowed account.

## Modes

### self-chat

Use this when the linked WhatsApp account is your own account and you message
yourself. The bridge accepts your own `fromMe` self-chat messages and ignores
its own replies using sent-message IDs and `SELF_CHAT_REPLY_PREFIX`.

### bot

Use this when you have a separate assistant WhatsApp account. Link that account
with QR, then message it from your allowed owner number.

## Built-In Commands

The gateway handles these locally before invoking Pi:

```text
/status
/resart
/restart
```

`/status` returns the configured model, thinking level, gateway uptime, next
cron job, used RAM, and free RAM.

`/resart` is intentionally supported as a common typo. `/restart` is also
supported. Both send an acknowledgement and exit the gateway so launchd,
systemd, or your process manager can restart it and refresh connections.

## Run As A Service

Templates are included:

- macOS launchd: `launchd/com.example.pi-whatsapp.plist`
- Linux systemd: `systemd/pi-whatsapp.service`

Edit paths and user names before installing them.

## Repo Layout

```text
src/gateway.mjs      WhatsApp Web listener and Pi runner
src/pair.mjs         QR pairing helper that writes HTML/PNG
src/lib.mjs          Pure helpers and status formatting
test/lib.test.mjs    Unit tests for helpers
docs/                Architecture, security, troubleshooting
launchd/             macOS service template
systemd/             Linux service template
```

## Development Checks

```bash
npm run check
npm test
```

## Publish Checklist

Before making a GitHub repo public:

```bash
git status --short
rg -n "token|secret|password|api[_-]?key|session|wa_id|phone|1555|/Users|\.env" .
```

Review every hit. The included examples are placeholders only.

