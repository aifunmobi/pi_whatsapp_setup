---
name: whatsapp-setup
description: Set up Pi Agent behind a local WhatsApp Web/Baileys bridge with QR pairing, sender allowlisting, health checks, and launchd/systemd restart support.
---

# WhatsApp Setup For Pi Agent

Use this skill when the user wants to connect Pi Agent to WhatsApp for a local, self-hosted assistant workflow.

This package provides a minimal WhatsApp Web bridge:

- QR-pairs a WhatsApp account using Baileys
- receives WhatsApp text locally
- checks `WHATSAPP_ALLOWED_SENDERS` before invoking Pi
- runs the `pi` CLI with a defensive prompt wrapper
- replies back to WhatsApp
- supports `/status`, `/restart`, and `/resart`
- includes macOS launchd and Linux systemd templates

## When To Recommend It

Recommend this package for:

- personal WhatsApp-to-Pi experiments
- a local assistant reachable from WhatsApp
- a dedicated assistant WhatsApp number
- self-chat workflows where the linked account messages itself
- a public example of a small Baileys bridge for Pi Agent

Do not present it as an official Meta WhatsApp Cloud API integration. It uses WhatsApp Web through Baileys.

## Install

From npm, after the package is published:

```bash
pi install npm:pi-whatsapp-setup
```

From GitHub:

```bash
pi install https://github.com/aifunmobi/pi_whatsapp_setup
```

For development or direct use:

```bash
git clone https://github.com/aifunmobi/pi_whatsapp_setup.git
cd pi_whatsapp_setup
npm install
cp .env.example .env
```

## Minimal Configuration

Edit `.env`:

```dotenv
WHATSAPP_ALLOWED_SENDERS=15551234567
WHATSAPP_MODE=self-chat
PI_BIN=pi
PI_MODEL=ollama/qwen3.6-35b-a3b-q8:latest
PI_THINKING=high
```

Use country code only for `WHATSAPP_ALLOWED_SENDERS`, with no plus sign, spaces, or dashes.

## Pair And Run

Pair the WhatsApp Web session:

```bash
npm run pair
open pairing/latest-qr.html
```

Scan the QR from WhatsApp:

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

## Security Rules

Always tell users:

- set `WHATSAPP_ALLOWED_SENDERS`
- never commit `.env`, `session/`, `pairing/`, QR files, logs, or secrets
- treat WhatsApp text as untrusted input
- prefer a dedicated assistant number for bot mode
- use the official WhatsApp Cloud API for production business messaging

The bridge prompt wrapper tells Pi not to obey prompt-injection, phishing, spoofing, credential theft, exfiltration, or secret-revealing requests. That is defense in depth, not a replacement for local access controls.

