# WhatsApp Setup for Pi Agent

A minimal, public-safe WhatsApp Web bridge for running [Pi Agent](https://github.com/earendil-works/pi) from WhatsApp.

This repo shows how to connect Pi Agent to WhatsApp using [Baileys](https://github.com/WhiskeySockets/Baileys), a local Node.js gateway, a QR-linked WhatsApp Web session, and the `pi` CLI. It is intended for personal automation, local agent experiments, and self-hosted AI assistant workflows.

Keywords: Pi Agent, Pi package, WhatsApp, WhatsApp Web, Baileys, local AI agent, self-hosted assistant, chat bridge, personal automation, agent gateway.

## What This Does

The gateway:

- links a WhatsApp account through WhatsApp Web QR pairing
- receives WhatsApp text messages locally
- allowlists the sender before running Pi
- invokes the `pi` CLI with a defensive prompt wrapper
- sends Pi's response back to WhatsApp
- exposes a local health endpoint
- supports `/status`, `/restart`, and `/resart`
- includes launchd and systemd templates for auto-restart after reboot

This does not use Meta's official WhatsApp Cloud API. For production business messaging, use the official Cloud API instead.

## Safety Notes

- WhatsApp Web automation is unofficial and can be fragile.
- Use a dedicated assistant number when possible.
- Always set `WHATSAPP_ALLOWED_SENDERS`.
- Never commit `.env`, `session/`, `pairing/`, logs, QR files, or secrets.
- Treat WhatsApp messages as untrusted input.
- Start in `self-chat` mode only if you understand that messages you send to yourself are treated as Pi input.

The included prompt wrapper tells Pi that WhatsApp text is untrusted and that it must not obey phishing, spoofing, prompt-injection, credential theft, exfiltration, or secret-revealing requests.

## Requirements

- Node.js 20+
- npm
- Pi Agent installed and available as `pi`
- A WhatsApp account that can link a new device

Check Pi first:

```bash
pi --version
pi --offline --list-models
```

## Install As A Pi Package

From GitHub:

```bash
pi install https://github.com/aifunmobi/pi_whatsapp_setup
```

After the npm package is published:

```bash
pi install npm:pi-whatsapp-setup
```

This loads the included `whatsapp-setup` skill into Pi. The gateway itself is still configured and run locally from this repo or from the npm package files.

## Quick Start

Install dependencies:

```bash
npm install
```

Create local config:

```bash
cp .env.example .env
$EDITOR .env
```

At minimum, set:

```dotenv
WHATSAPP_ALLOWED_SENDERS=15551234567
WHATSAPP_MODE=self-chat
```

Use country code only, with no `+`, spaces, or dashes.

Pair WhatsApp:

```bash
npm run pair
open pairing/latest-qr.html
```

Scan the QR code from WhatsApp:

```text
WhatsApp -> Linked devices -> Link a device
```

Start the gateway:

```bash
npm start
```

Check health:

```bash
curl http://127.0.0.1:3091/health
```

Expected:

```json
{"ok":true,"status":"connected"}
```

Then send a WhatsApp message from the allowed account.

## Configuration

Copy `.env.example` to `.env` and edit these values:

```dotenv
WHATSAPP_ALLOWED_SENDERS=15551234567
WHATSAPP_MODE=self-chat
SELF_CHAT_REPLY_PREFIX=Pi Agent

SESSION_DIR=./session
HEALTH_HOST=127.0.0.1
HEALTH_PORT=3091

PI_BIN=pi
PI_WORKDIR=.
PI_MODEL=ollama/qwen3.6-35b-a3b-q8:latest
PI_THINKING=high
PI_TIMEOUT_MS=900000
```

Optional:

```dotenv
PI_APPEND_SYSTEM_PROMPT=/path/to/APPEND_SYSTEM.md
```

Use that if you keep a local Pi safety, memory, or operating-policy file.

## Modes

### self-chat

Use this when the linked WhatsApp account is your own account and you message yourself.

The bridge accepts your own `fromMe` self-chat messages and ignores its own replies using sent-message IDs and `SELF_CHAT_REPLY_PREFIX`.

### bot

Use this when you have a separate assistant WhatsApp account.

Link the assistant account with QR pairing, then message it from your allowed owner number. In bot mode, `fromMe` messages are ignored.

## Built-In Commands

The gateway handles these locally before invoking Pi:

```text
/status
/restart
/resart
```

`/status` returns:

- configured model
- thinking level
- gateway uptime
- next cron job
- RAM used
- RAM free

`/resart` is intentionally supported as a common typo. `/restart` and `/resart` both send an acknowledgement and exit the gateway so launchd, systemd, or your process manager can restart it and refresh the WhatsApp connection.

## Run As A Service

Templates are included:

- macOS launchd: `launchd/com.example.pi-whatsapp.plist`
- Linux systemd: `systemd/pi-whatsapp.service`

Edit paths, usernames, and environment details before installing them.

For macOS launchd, the typical flow is:

```bash
cp launchd/com.example.pi-whatsapp.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.example.pi-whatsapp.plist
launchctl kickstart -k gui/$(id -u)/com.example.pi-whatsapp
```

For Linux systemd user services:

```bash
mkdir -p ~/.config/systemd/user
cp systemd/pi-whatsapp.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now pi-whatsapp.service
```

## Repo Layout

```text
src/gateway.mjs      WhatsApp Web listener and Pi runner
src/pair.mjs         QR pairing helper that writes HTML/PNG
src/lib.mjs          Pure helpers and status formatting
test/lib.test.mjs    Unit tests for helpers
skills/              Pi package skill loaded by pi install
docs/                Architecture, security, troubleshooting
launchd/             macOS service template
systemd/             Linux service template
```

## Development Checks

```bash
npm run check
npm test
npm audit --omit=dev
```

## Troubleshooting

If QR pairing succeeds but messages are ignored:

- confirm `WHATSAPP_MODE`
- confirm `WHATSAPP_ALLOWED_SENDERS`
- check `curl http://127.0.0.1:3091/health`
- check whether the linked account is your own account or a separate bot account

If WhatsApp logs out the linked device:

```bash
rm -rf session
npm run pair
open pairing/latest-qr.html
```

Then restart the gateway.

More notes:

- [Architecture](docs/architecture.md)
- [Security](docs/security.md)
- [Troubleshooting](docs/troubleshooting.md)

## Suggested GitHub Description And Topics

Repository description:

```text
WhatsApp setup for Pi Agent: a local WhatsApp Web/Baileys bridge for running Pi from WhatsApp.
```

Suggested GitHub topics:

```text
pi-agent
pi-package
whatsapp
whatsapp-web
baileys
ai-agent
local-ai
self-hosted
chatbot
automation
agent-gateway
nodejs
```

GitHub topics are set in the repository's About panel after the repo is created.

## Publish Checklist

Before making a GitHub repo public:

```bash
git status --short
rg -n "token|secret|password|api[_-]?key|session|wa_id|phone|1555|/Users|\.env" .
npm run check
npm test
npm audit --omit=dev
npm pack --dry-run
```

Review every hit. The included examples are placeholders only.

To publish to npm:

```bash
npm login
npm publish --access public
```

The package is prepared for pi.dev discovery with the `pi-package` keyword and a `pi.skills` manifest in `package.json`.

## License

MIT
