#!/usr/bin/env node
// Safe Keys: the on-disk pass over transcript files.
//
// The hooks keep credentials out of every row the conversation stores. Two records are not rows and
// bypass them: the message queue's `queue-operation` entry (the prompt as it was queued) and the
// `last-prompt` entry. Older sessions, a prompt that reached disk before the plugin existed, and a
// hook that failed can leave a value elsewhere too. This script finds every credential in a
// transcript and overwrites it IN PLACE with a marker of exactly the same byte length ("[hidden]"
// padded with *). Same-length overwrites keep the JSON valid and are safe while the engine is still
// appending lines, so the plugin runs this right after a prompt, not only at session end.
//
// Modes:
//   node scrub.mjs                          SessionEnd hook: reads {transcript_path} JSON on stdin
//   node scrub.mjs --file <path>            one transcript, in place
//   node scrub.mjs --all [--dry-run]        every *.jsonl under ~/.claude/projects (history cleanup)
//   --values-stdin                          also overwrite the exact values in {"values":[...]} on stdin
//   --prompts-only                          detect only in prompt-like records (the live pass; the hook mode default)
//   --stats                                 histogram of rule:name:recordType and value shapes, never a value
//   --dry-run                               count only
//   --quiet                                 print only changed=N
//   --report                                per record-type counts
//
// Detection is lib/detect.js, the same code the hooks run. Prompt-like records (queue-operation,
// last-prompt, a user's typed message) get the full detector; every other record gets the known
// shapes and labels only, so ids in tool output are never touched.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { findSensitive, HIDDEN } from "../lib/detect.js";

const MARKER = HIDDEN;
/** Set by --prompts-only (the plugin's live pass): detection runs on prompt-like records alone; given values are overwritten everywhere. */
let promptsOnly = false;

/** Decoded strings of a parsed record, each with a mode, walked recursively. */
function* strings(value, full) {
  if (typeof value === "string") {
    yield [value, full];
    return;
  }
  if (Array.isArray(value)) {
    for (const v of value) yield* strings(v, full);
    return;
  }
  if (value && typeof value === "object") for (const v of Object.values(value)) yield* strings(v, full);
}

/** Whether a record's text is prompt-like (the full detector) or machine output (known shapes only). */
function isPromptLike(record) {
  if (record.type === "queue-operation" || record.type === "last-prompt") return true;
  if (record.type === "user" && !record.toolUseResult) {
    const c = record.message?.content;
    if (typeof c === "string") return true;
    if (Array.isArray(c)) return c.every((b) => b && b.type === "text");
  }
  return false;
}

/** Collected under --stats: rule, name, record type and the shape of each value, never the value. */
export const stats = { byRule: {}, samples: [] };
function note(h, type) {
  const k = h.rule + ":" + h.name + ":" + type;
  stats.byRule[k] = (stats.byRule[k] ?? 0) + 1;
  if (stats.samples.length < 60 && !stats.samples.some((s) => s.k === k)) stats.samples.push({ k, shape: h.value.slice(0, 4) + "…(" + h.value.length + ")", ctx: h.ctx });
}

/** The exact values to overwrite in one raw line: detection over decoded strings, plus any given values. */
function valuesInLine(line, extraValues, type = "?") {
  const found = new Set(extraValues);
  let record;
  try {
    record = JSON.parse(line);
  } catch {
    record = undefined;
  }
  if (record && typeof record === "object") {
    const full = isPromptLike(record);
    if (promptsOnly && !full) return Array.from(found).filter((v) => v.length >= MARKER.length).sort((a, b) => b.length - a.length);
    for (const [text, isFull] of strings(record, full)) {
      if (text.length < 8) continue;
      for (const h of findSensitive(text, { knownOnly: !isFull })) {
        found.add(h.value);
        if (process.argv.includes("--stats")) note({ ...h, ctx: text.slice(Math.max(0, h.start - 30), h.start).replace(/s+/g, " ") }, type + (isFull ? ":full" : ":known"));
      }
    }
  } else {
    for (const h of findSensitive(line, { knownOnly: false })) {
      found.add(h.value);
      if (process.argv.includes("--stats")) note({ ...h, ctx: "" }, "unparsed");
    }
  }
  return Array.from(found).filter((v) => v.length >= MARKER.length).sort((a, b) => b.length - a.length);
}

/** Byte spans in the latin1 line where `value` appears raw, JSON-escaped or URL-encoded. */
function spansOf(line, value) {
  const forms = new Set([value, JSON.stringify(value).slice(1, -1)]);
  try {
    forms.add(encodeURIComponent(value));
  } catch {
    // not encodable
  }
  const out = [];
  for (const form of forms) {
    const needle = Buffer.from(form, "utf8").toString("latin1");
    if (needle.length < MARKER.length) continue;
    let i = line.indexOf(needle);
    while (i !== -1) {
      out.push([i, i + needle.length]);
      i = line.indexOf(needle, i + needle.length);
    }
  }
  return out;
}

/** A span may not start right after a backslash nor end on one, so the overwrite never breaks a JSON escape. */
function safeSpan(text, start, end) {
  if (start > 0 && text[start - 1] === "\\") start += 1;
  if (text[end - 1] === "\\") end -= 1;
  return end - start >= MARKER.length ? [start, end] : null;
}

function marker(length) {
  return MARKER + "*".repeat(length - MARKER.length);
}

/** Overwrites every credential in `file` in place. Returns `{ changed, byType }`. */
export function scrubFile(file, { dryRun = false, values = [] } = {}) {
  const buf = fs.readFileSync(file);
  const text = buf.toString("latin1"); // one char per byte: indexes are byte offsets
  const byType = {};
  const writes = [];
  let offset = 0;
  for (const line of text.split("\n")) {
    const lineStart = offset;
    offset += line.length + 1;
    if (line.length < 16) continue;
    // Decode this line's bytes as UTF-8 for detection; offsets map back through spansOf on the latin1 text.
    const decoded = Buffer.from(line, "latin1").toString("utf8");
    let type = "unparsed";
    try {
      type = JSON.parse(decoded).type ?? "untyped";
    } catch {
      // keep "unparsed"
    }
    const found = valuesInLine(decoded, values, type);
    if (found.length === 0) continue;
    const taken = [];
    for (const value of found) {
      for (const [s, e] of spansOf(line, value)) {
        if (taken.some(([ts, te]) => s < te && e > ts)) continue;
        if (line.slice(s, s + MARKER.length) === MARKER) continue; // already done
        const span = safeSpan(line, s, e);
        if (!span) continue;
        taken.push(span);
        writes.push([lineStart + span[0], lineStart + span[1]]);
        byType[type] = (byType[type] ?? 0) + 1;
      }
    }
  }
  if (writes.length === 0 || dryRun) return { changed: writes.length, byType };
  const fd = fs.openSync(file, "r+");
  try {
    for (const [s, e] of writes) {
      const bytes = Buffer.from(marker(e - s), "latin1");
      fs.writeSync(fd, bytes, 0, bytes.length, s);
    }
  } finally {
    fs.closeSync(fd);
  }
  return { changed: writes.length, byType };
}

function walk(dir, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith(".jsonl")) out.push(full);
  }
  return out;
}

function readStdin() {
  return new Promise((resolve) => {
    let input = "";
    if (process.stdin.isTTY) return resolve("");
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (input += chunk));
    process.stdin.on("end", () => resolve(input));
    process.stdin.on("error", () => resolve(input));
  });
}

async function main() {
  const args = process.argv.slice(2);
  const quiet = args.includes("--quiet");
  const dryRun = args.includes("--dry-run");
  const report = args.includes("--report");
  const wantStats = args.includes("--stats");
  promptsOnly = args.includes("--prompts-only") || (fileIdx === -1 && !args.includes("--all")); // the SessionEnd hook mode is prompts-only too
  process.on("exit", () => {
    if (!wantStats) return;
    const rows = Object.entries(stats.byRule).sort((a, b) => b[1] - a[1]);
    console.log("--- stats: rule:name:recordType count ---");
    for (const [k, n] of rows) console.log(String(n).padStart(6), k);
    console.log("--- samples (shape, context before) ---");
    for (const s of stats.samples) console.log(s.k.padEnd(60), s.shape.padEnd(16), JSON.stringify(s.ctx));
  });
  const fileIdx = args.indexOf("--file");
  let values = [];
  let stdin = "";
  if (args.includes("--values-stdin") || (fileIdx === -1 && !args.includes("--all"))) stdin = await readStdin();
  if (args.includes("--values-stdin")) {
    try {
      const parsed = JSON.parse(stdin);
      if (Array.isArray(parsed?.values)) values = parsed.values.filter((v) => typeof v === "string" && v.length >= MARKER.length);
    } catch {
      values = [];
    }
  }

  const show = (label, r) => {
    if (quiet) return;
    console.log(label + " changed=" + r.changed + (dryRun ? " (dry run)" : "") + (report && r.changed ? " " + JSON.stringify(r.byType) : ""));
  };

  if (fileIdx !== -1) {
    const file = args[fileIdx + 1];
    if (!file || !fs.existsSync(file)) {
      console.log("changed=0 (no such file)");
      return;
    }
    const r = scrubFile(file, { dryRun, values });
    if (quiet) console.log("changed=" + r.changed);
    else show(path.basename(file), r);
    return;
  }

  if (args.includes("--all")) {
    const root = path.join(os.homedir(), ".claude", "projects");
    const files = walk(root, []);
    let total = 0;
    let touched = 0;
    const totals = {};
    for (const f of files) {
      const r = scrubFile(f, { dryRun, values });
      if (r.changed > 0) {
        touched++;
        total += r.changed;
        for (const [k, n] of Object.entries(r.byType)) totals[k] = (totals[k] ?? 0) + n;
        if (!quiet) console.log((dryRun ? "would change " : "changed ") + r.changed + "  " + path.relative(root, f));
      }
    }
    console.log("files=" + files.length + " touched=" + touched + " changed=" + total + (dryRun ? " (dry run)" : "") + (report ? " " + JSON.stringify(totals) : ""));
    return;
  }

  // SessionEnd hook: JSON on stdin.
  let transcript;
  try {
    transcript = JSON.parse(stdin).transcript_path;
  } catch {
    return;
  }
  if (!transcript || !fs.existsSync(transcript)) return;
  try {
    scrubFile(transcript, { dryRun: false, values });
  } catch {
    // never fail the session's end over this
  }
}

main().then(
  () => process.exit(0),
  () => process.exit(0),
);
