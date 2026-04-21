import { createHmac } from "node:crypto";
import assert from "node:assert/strict";

import {
  sanitizeUserId,
  sanitizeFilename,
  validateEmail,
  validateActionType,
  sanitizeText,
} from "../lib/validators";
import { splitLongText } from "../lib/line/splitter";
import { pcmToWav, estimateWavDurationMs } from "../lib/audio/wav";
import { normalizeLanguageInput } from "../lib/language";
import { buildQuickReply, EDU_ACTIONS, COMMON_LANGUAGES } from "../lib/constants/quick-reply";
import { isTaigi } from "../lib/constants/commands";
import {
  audioMessage,
  enforceLineLimits,
  taigiCreditFlex,
  textMessage,
  truncateForLine,
} from "../lib/line/messages";
import { MAX_BUBBLE_COUNT, MAX_TOTAL_CHARS } from "../lib/line/limits";

let failures = 0;
function run(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve()
    .then(fn)
    .then(() => console.log(`  ✓ ${name}`))
    .catch((e) => {
      failures++;
      console.error(`  ✗ ${name}`);
      console.error(`    ${(e as Error).message}`);
    });
}

async function main() {
  console.log("validators");
  await run("sanitizeUserId accepts valid LINE id", () => {
    const id = "U" + "a".repeat(32);
    assert.equal(sanitizeUserId(id), id);
  });
  await run("sanitizeUserId rejects bad ids", () => {
    assert.throws(() => sanitizeUserId("Uabc"));
    assert.throws(() => sanitizeUserId("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"));
    assert.throws(() => sanitizeUserId(""));
  });
  await run("sanitizeFilename strips traversal + dangerous chars", () => {
    assert.equal(sanitizeFilename("../../etc/passwd"), "passwd");
    assert.equal(sanitizeFilename("a/b/c.wav"), "c.wav");
    assert.equal(sanitizeFilename("hello world.wav"), "hello world.wav");
    assert.throws(() => sanitizeFilename("///"));
  });
  await run("validateEmail accepts and rejects", () => {
    assert.equal(validateEmail("  TEST@Example.Com "), "test@example.com");
    assert.throws(() => validateEmail("no-at-sign"));
    assert.throws(() => validateEmail("a@b"));
  });
  await run("validateActionType falls back to other", () => {
    assert.equal(validateActionType("medchat"), "medchat");
    assert.equal(validateActionType("NotAThing"), "other");
  });
  await run("sanitizeText strips control chars and clamps length", () => {
    const raw = `hello\x00\x01\nworld`;
    const out = sanitizeText(raw);
    assert.ok(!out.includes("\x00"));
    assert.ok(out.includes("\n"));
    assert.ok(out.length <= 5000);
  });

  console.log("\nline/splitter");
  await run("short text returns one bubble with prefix", () => {
    const [only] = splitLongText("hello", "X:", 3);
    assert.equal(only, "X:hello");
  });
  await run("long text splits across bubbles under budget", () => {
    const chunks = splitLongText("a".repeat(4000), "X:", 3, 10000);
    assert.ok(chunks.length >= 2, `got ${chunks.length} chunks`);
    for (const c of chunks) assert.ok(c.length <= 1950);
  });
  await run("very long text adds truncation notice", () => {
    const chunks = splitLongText("a".repeat(20000), "X:", 3, 6000);
    const joined = chunks.join("");
    assert.ok(joined.includes("LINE 限制"), "expected truncation notice");
  });

  console.log("\naudio/wav");
  await run("pcmToWav produces valid RIFF header", () => {
    const pcm = Buffer.alloc(100);
    const wav = pcmToWav(pcm);
    assert.equal(wav.length, 144);
    assert.equal(wav.toString("ascii", 0, 4), "RIFF");
    assert.equal(wav.toString("ascii", 8, 12), "WAVE");
    assert.equal(wav.readUInt32LE(40), 100);
  });
  await run("estimateWavDurationMs rough math", () => {
    const pcm = Buffer.alloc(16000 * 2); // 1s mono 16-bit 16kHz
    const wav = pcmToWav(pcm, { sampleRate: 16000 });
    const dur = estimateWavDurationMs(wav, { sampleRate: 16000 });
    assert.ok(dur >= 990 && dur <= 1010, `dur=${dur}`);
  });

  console.log("\nlanguage");
  await run("normalizes common inputs", () => {
    assert.equal(normalizeLanguageInput("English"), "英文");
    assert.equal(normalizeLanguageInput("中文"), "中文(繁體)");
    assert.equal(normalizeLanguageInput("taigi"), "台語");
    assert.equal(normalizeLanguageInput("德文"), "德文");
  });
  await run("isTaigi catches all spellings", () => {
    assert.ok(isTaigi("台語"));
    assert.ok(isTaigi("臺語"));
    assert.ok(isTaigi("Taigi"));
    assert.ok(!isTaigi("中文"));
  });

  console.log("\nquick-reply");
  await run("buildQuickReply emits correct items shape", () => {
    const qr = buildQuickReply(EDU_ACTIONS);
    assert.equal(qr.items.length, 4);
    const first = qr.items[0];
    assert.equal(first.type, "action");
    assert.equal(first.action.type, "message");
    if (first.action.type === "message") {
      assert.equal(first.action.label, "✏️ 修改");
      assert.equal(first.action.text, "modify");
    }
  });
  await run("buildQuickReply clamps to 13 items", () => {
    const big = new Array(20).fill(["x", "y"] as const);
    const qr = buildQuickReply(big);
    assert.ok(qr.items.length <= 13);
  });

  console.log("\nline/messages");
  await run("truncateForLine trims at max-per-bubble", () => {
    const short = "hello";
    assert.equal(truncateForLine(short), short);
    const long = "a".repeat(3000);
    assert.ok(truncateForLine(long).length <= 2000);
  });
  await run("enforceLineLimits keeps main reply last and trims extras", () => {
    const extras = Array.from({ length: 6 }, (_, i) => textMessage(`extra-${i}`));
    const main = textMessage("MAIN");
    const kept = enforceLineLimits([...extras, main]);
    assert.ok(kept.length <= MAX_BUBBLE_COUNT);
    const last = kept[kept.length - 1];
    assert.equal(last.type, "text");
    if (last.type === "text") assert.ok(last.text.startsWith("MAIN"));
  });
  await run("audioMessage produces expected shape", () => {
    const m = audioMessage("https://example.com/a.wav", 1234);
    assert.equal(m.type, "audio");
    assert.equal(m.originalContentUrl, "https://example.com/a.wav");
    assert.equal(m.duration, 1234);
  });
  await run("taigiCreditFlex renders a bubble", () => {
    const flex = taigiCreditFlex();
    assert.equal(flex.type, "flex");
    assert.equal(flex.contents.type, "bubble");
  });

  console.log("\nline signature (HMAC-SHA256 base64)");
  await run("signature matches known vector", () => {
    const secret = "abc123";
    const body = `{"events":[]}`;
    const expected = createHmac("sha256", secret).update(body).digest("base64");
    assert.equal(expected.length, 44);
    const verify = createHmac("sha256", secret).update(body).digest("base64");
    assert.equal(verify, expected);
  });

  console.log("");
  if (failures === 0) {
    console.log("all smoke tests passed");
    process.exit(0);
  } else {
    console.error(`${failures} test(s) failed`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
