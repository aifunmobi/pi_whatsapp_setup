#!/usr/bin/env node
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { execFile, spawn } from "node:child_process";
import {
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeWASocket,
  useMultiFileAuthState,
} from "@whiskeysockets/baileys";
import pino from "pino";
import {
  isAllowedSender,
  isRestartCommand,
  isStatusCommand,
  loadEnvFile,
  makePrompt,
  makeStatusText,
  normalizeWhatsAppId,
  parseAllowedSenders,
  splitMessage,
} from "./lib.mjs";

loadEnvFile(path.resolve(".env"));

const config = {
  allowedSenders: parseAllowedSenders(process.env.WHATSAPP_ALLOWED_SENDERS || ""),
  mode: process.env.WHATSAPP_MODE || "self-chat",
  sessionDir: process.env.SESSION_DIR || "./session",
  healthHost: process.env.HEALTH_HOST || "127.0.0.1",
  healthPort: Number.parseInt(process.env.HEALTH_PORT || "3091", 10),
  piBin: process.env.PI_BIN || "pi",
  piWorkdir: process.env.PI_WORKDIR || ".",
  piModel: process.env.PI_MODEL || "ollama/qwen3.6-35b-a3b-q8:latest",
  piThinking: process.env.PI_THINKING || "high",
  piTimeoutMs: Number.parseInt(process.env.PI_TIMEOUT_MS || "900000", 10),
  appendSystemPrompt: process.env.PI_APPEND_SYSTEM_PROMPT || "",
  replyPrefix: process.env.SELF_CHAT_REPLY_PREFIX || "Pi Agent",
};

if (!["bot", "self-chat"].includes(config.mode)) {
  throw new Error("WHATSAPP_MODE must be bot or self-chat");
}
if (!config.allowedSenders.size) {
  throw new Error("WHATSAPP_ALLOWED_SENDERS is required");
}

const startedAt = new Date();
const logger = pino({ level: process.env.WHATSAPP_DEBUG ? "debug" : "warn" });
const recentlySentIds = new Set();
let sock = null;
let status = "starting";
let processed = 0;
let lastMessageAt = null;
let stopping = false;

function log(level, message, fields = {}) {
  const suffix = Object.keys(fields).length ? ` ${JSON.stringify(fields)}` : "";
  process.stderr.write(`${new Date().toISOString()} ${level} ${message}${suffix}\n`);
}

function getMessageContent(msg) {
  const content = msg?.message || {};
  if (content.ephemeralMessage?.message) return content.ephemeralMessage.message;
  if (content.viewOnceMessage?.message) return content.viewOnceMessage.message;
  if (content.viewOnceMessageV2?.message) return content.viewOnceMessageV2.message;
  return content;
}

function getText(msg) {
  const content = getMessageContent(msg);
  return String(content.conversation || content.extendedTextMessage?.text || "").trim();
}

function isSelfChat(chatId) {
  const myNumber = normalizeWhatsAppId(sock?.user?.id || "");
  const myLid = normalizeWhatsAppId(sock?.user?.lid || "");
  const chat = normalizeWhatsAppId(chatId);
  return Boolean(chat && (chat === myNumber || chat === myLid));
}

function shouldAccept(msg) {
  const chatId = msg.key.remoteJid || "";
  const senderId = msg.key.participant || chatId;
  const fromMe = Boolean(msg.key.fromMe);
  const isGroup = chatId.endsWith("@g.us");
  if (isGroup) return false;

  if (config.mode === "bot") {
    return !fromMe && isAllowedSender(senderId, config.allowedSenders);
  }

  if (!fromMe || !isSelfChat(chatId)) return false;
  if (recentlySentIds.has(msg.key.id)) return false;
  const text = getText(msg);
  if (config.replyPrefix && text.startsWith(config.replyPrefix)) return false;
  return true;
}

function execFileText(file, args) {
  return new Promise((resolve) => {
    execFile(file, args, { timeout: 5000, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) resolve(stderr || error.message);
      else resolve(stdout);
    });
  });
}

async function runPi(event) {
  const args = [
    "--no-approve",
    "--no-builtin-tools",
    "--model",
    config.piModel,
    "--thinking",
    config.piThinking,
  ];
  if (config.appendSystemPrompt) args.push("--append-system-prompt", config.appendSystemPrompt);
  args.push("--session-id", `whatsapp-${normalizeWhatsAppId(event.senderId || event.chatId)}`);
  args.push("--name", "WhatsApp");
  args.push("-p", makePrompt({ mode: config.mode, event }));

  return new Promise((resolve, reject) => {
    const child = spawn(config.piBin, args, {
      cwd: config.piWorkdir,
      env: { ...process.env, PI_SKIP_VERSION_CHECK: "1", PI_TELEMETRY: "0" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 5000).unref();
      reject(new Error(`pi timed out after ${config.piTimeoutMs}ms`));
    }, config.piTimeoutMs);
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(stdout.trim() || "I do not have a response.");
      else reject(new Error(`pi exited ${code}: ${stderr.slice(-1000)}`));
    });
  });
}

async function sendText(chatId, text) {
  const body = config.mode === "self-chat" && config.replyPrefix
    ? `${config.replyPrefix}\n${text}`
    : text;
  for (const chunk of splitMessage(body)) {
    const sent = await sock.sendMessage(chatId, { text: chunk });
    if (sent?.key?.id) recentlySentIds.add(sent.key.id);
    while (recentlySentIds.size > 100) recentlySentIds.delete(recentlySentIds.values().next().value);
  }
}

async function statusText() {
  const crontabText = await execFileText("crontab", ["-l"]);
  return makeStatusText({
    model: config.piModel,
    thinking: config.piThinking,
    startedAt,
    crontabText,
  });
}

async function handleMessage(msg) {
  if (!shouldAccept(msg)) return;
  const body = getText(msg);
  if (!body) return;

  const event = {
    messageId: msg.key.id,
    chatId: msg.key.remoteJid,
    senderId: msg.key.participant || msg.key.remoteJid,
    body,
  };

  log("info", "processing WhatsApp message", { messageId: event.messageId });
  let reply;
  let restart = false;
  if (isStatusCommand(body)) {
    reply = await statusText();
  } else if (isRestartCommand(body)) {
    reply = "Restarting Pi WhatsApp gateway and refreshing the WhatsApp connection now.";
    restart = true;
  } else {
    reply = await runPi(event);
  }

  await sendText(event.chatId, reply);
  processed += 1;
  lastMessageAt = new Date().toISOString();
  if (restart) setTimeout(() => process.exit(0), 1000).unref();
}

function startHealthServer() {
  const server = http.createServer((req, res) => {
    if (req.url !== "/health") {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "not found" }));
      return;
    }
    const body = JSON.stringify({
      ok: true,
      status,
      mode: config.mode,
      processed,
      lastMessageAt,
      uptimeSeconds: Math.floor((Date.now() - startedAt.getTime()) / 1000),
    });
    res.writeHead(200, { "content-type": "application/json" });
    res.end(body);
  });
  server.listen(config.healthPort, config.healthHost, () => {
    log("info", "health endpoint listening", { host: config.healthHost, port: config.healthPort });
  });
}

async function startSocket() {
  fs.mkdirSync(config.sessionDir, { recursive: true });
  const { state, saveCreds } = await useMultiFileAuthState(config.sessionDir);
  const { version } = await fetchLatestBaileysVersion();
  sock = makeWASocket({
    version,
    auth: state,
    logger,
    printQRInTerminal: true,
    browser: ["Pi WhatsApp Setup", "Chrome", "120.0"],
    syncFullHistory: false,
    markOnlineOnConnect: false,
    getMessage: async () => ({ conversation: "" }),
  });

  sock.ev.on("creds.update", saveCreds);
  sock.ev.on("connection.update", (update) => {
    if (update.connection === "open") {
      status = "connected";
      log("info", "WhatsApp connected");
    }
    if (update.connection === "close") {
      const reason = update.lastDisconnect?.error?.output?.statusCode;
      status = "disconnected";
      if (reason === DisconnectReason.loggedOut || stopping) process.exit(reason === DisconnectReason.loggedOut ? 1 : 0);
      log("warn", "WhatsApp connection closed; reconnecting", { reason });
      setTimeout(startSocket, reason === 515 ? 1000 : 3000).unref();
    }
  });
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify" && type !== "append") return;
    for (const msg of messages) {
      try {
        await handleMessage(msg);
      } catch (error) {
        log("error", "message handling failed", { error: error.message });
      }
    }
  });
}

process.on("SIGTERM", () => {
  stopping = true;
  process.exit(0);
});
process.on("SIGINT", () => {
  stopping = true;
  process.exit(0);
});

startHealthServer();
await startSocket();

