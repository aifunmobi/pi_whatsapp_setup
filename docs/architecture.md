# Architecture

```text
WhatsApp app
  -> WhatsApp Web session
  -> Baileys socket in src/gateway.mjs
  -> local allowlist and command handling
  -> pi CLI subprocess
  -> WhatsApp reply
```

The bridge is intentionally small:

- Baileys owns the WhatsApp Web socket and auth state.
- `src/gateway.mjs` filters senders before invoking Pi.
- Pi is invoked with `spawn()`, not through shell interpolation.
- `/status`, `/resart`, and `/restart` are handled locally.
- A health server reports local process state on `HEALTH_HOST:HEALTH_PORT`.

## Why Not Cloud API

Meta's official WhatsApp Cloud API is the right choice for production business
messaging, but it requires a WhatsApp Business setup, access tokens, an app
secret, and a public HTTPS webhook.

This repo targets local personal-agent use where the user wants a WhatsApp Web
linked-device style setup.

