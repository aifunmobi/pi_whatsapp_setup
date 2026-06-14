# Troubleshooting

## QR Scans But Gateway Does Not Receive Messages

Check mode:

- `WHATSAPP_MODE=self-chat` if you linked your own account and message yourself.
- `WHATSAPP_MODE=bot` if you linked a separate assistant account.

In bot mode, the bridge ignores `fromMe` messages. That is correct for a
dedicated bot number but wrong for self-chat.

## Messages Are Ignored

Check the allowed sender format. WhatsApp Web may expose a country-code form
without `+`, spaces, or dashes. Add only the exact owner IDs you intend to
allow.

## Health

```bash
curl http://127.0.0.1:3091/health
```

Expected:

```json
{"ok":true,"status":"connected"}
```

## Re-Pair

If WhatsApp says the linked device is logged out:

```bash
rm -rf session
npm run pair
open pairing/latest-qr.html
```

Then restart the gateway.

