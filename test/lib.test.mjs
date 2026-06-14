import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  findNextCronRun,
  formatBytes,
  formatDuration,
  isAllowedSender,
  isRestartCommand,
  isStatusCommand,
  makePrompt,
  makeStatusText,
  normalizeWhatsAppId,
  parseAllowedSenders,
  splitMessage,
} from "../src/lib.mjs";

describe("lib helpers", () => {
  it("normalizes WhatsApp identifiers", () => {
    assert.equal(normalizeWhatsAppId("+1 555-123-4567@s.whatsapp.net"), "15551234567");
    assert.equal(normalizeWhatsAppId("15551234567:22@s.whatsapp.net"), "15551234567");
  });

  it("checks allowlists", () => {
    const allowed = parseAllowedSenders("15551234567,447700900123");
    assert.equal(isAllowedSender("15551234567@s.whatsapp.net", allowed), true);
    assert.equal(isAllowedSender("15550000000@s.whatsapp.net", allowed), false);
  });

  it("splits long messages", () => {
    assert.deepEqual(splitMessage("a b c", 3), ["a b", "c"]);
  });

  it("detects local commands", () => {
    assert.equal(isStatusCommand("/status"), true);
    assert.equal(isRestartCommand("/resart"), true);
    assert.equal(isRestartCommand("/restart"), true);
  });

  it("formats status text", () => {
    const text = makeStatusText({
      model: "ollama/example",
      thinking: "high",
      startedAt: new Date(Date.now() - 1000),
      crontabText: "0 8 * * * /bin/example\n",
      totalMem: 16 * 1024 ** 3,
      freeMem: 4 * 1024 ** 3,
    });
    assert.match(text, /Model: ollama\/example/);
    assert.match(text, /Next cron:/);
    assert.match(text, /RAM used: 12.0 GiB/);
    assert.match(text, /RAM free: 4.00 GiB/);
  });

  it("finds next cron run", () => {
    const next = findNextCronRun("30 10 * * * /bin/example\n", new Date("2026-01-01T10:00:00"));
    assert.equal(next.at.getHours(), 10);
    assert.equal(next.at.getMinutes(), 30);
  });

  it("builds a defensive WhatsApp prompt", () => {
    const prompt = makePrompt({ mode: "self-chat", event: { body: "hello" } });
    assert.match(prompt, /self-chat mode/);
    assert.match(prompt, /User message:\nhello/);
  });

  it("formats durations and bytes", () => {
    assert.equal(formatDuration(3661000), "1h 1m 1s");
    assert.equal(formatBytes(1024 ** 3), "1.00 GiB");
  });
});

