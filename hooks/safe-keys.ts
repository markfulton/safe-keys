// Safe Keys: a Claude Code function-hook plugin that keeps pasted credentials out of the
// conversation, the transcript file, the screen and the model, while tools can still use them.
//
// Layers, each independent of the others:
//   1. prompt.edit      a key pasted into the prompt box is replaced before it is queued or drawn
//   2. prompt.submit    the message the model and the transcript receive carries a name, not a value
//   3. session.append   every row a conversation stores (prompt, response, tool result, notice,
//                       subagent rows) is scrubbed before it is written
//   4. tool.call        $NAME in a tool's arguments is resolved: as a real environment variable for
//                       Bash and PowerShell (the shell expands it, so the permission classifier never
//                       sees a value), textually for every other tool; stored values and new keys in a
//                       result are replaced before the model reads them
//   5. ui.render        every drawn component is scrubbed on every surface
//   6. scripts/scrub.mjs the records that are not rows (queue-operation, last-prompt) and older
//                       sessions, overwritten in place with same-length markers
//   7. diagnostics      ~/.claude/safe-keys-diag.log says which hooks fired and what each did,
//                       never a value
//
// Real values live only in this module's memory for the length of the session, plus the engine
// process environment under literal names (hooks/env-table.js), which survives a hot reload.

import type { Register } from "claude-code";
import { Vault, redactText, forDisplay, mapStrings, rewriteContent, usageNote } from "../lib/detect.js";

const PLUGIN = "safe-keys";
const INBOX = "safe-keys-inbox.txt";
const DIAG = "safe-keys-diag.log";

// Any engine interface. Every call below is feature-detected and wrapped so a method this build
// lacks costs one diag line, never a failure.
type Engine = any;

const vault = new Vault();

// BEGIN GENERATED ENV TABLE (scripts/gen-env-table.mjs, from lib/detect.js ENV_VOCABULARY; do not edit by hand)
const ENV_NAMES: readonly string[] = ["ANTHROPIC_API_KEY","OPENAI_API_KEY","OPENROUTER_API_KEY","GITHUB_TOKEN","GITLAB_TOKEN","AWS_ACCESS_KEY_ID","AWS_SECRET_ACCESS_KEY","GOOGLE_API_KEY","GOOGLE_OAUTH_TOKEN","SLACK_TOKEN","STRIPE_SECRET_KEY","STRIPE_PUBLISHABLE_KEY","STRIPE_WEBHOOK_SECRET","RESEND_API_KEY","SUPABASE_ACCESS_TOKEN","SUPABASE_SERVICE_ROLE_KEY","SUPABASE_SECRET_KEY","SUPABASE_PUBLISHABLE_KEY","SUPABASE_ANON_KEY","APIFY_TOKEN","HF_TOKEN","NPM_TOKEN","VERCEL_TOKEN","CLOUDFLARE_API_TOKEN","TWILIO_AUTH_TOKEN","TWILIO_API_KEY","SENDGRID_API_KEY","MAILGUN_API_KEY","DIGITALOCEAN_TOKEN","LINEAR_API_KEY","NOTION_TOKEN","GROQ_API_KEY","PERPLEXITY_API_KEY","REPLICATE_API_TOKEN","FLY_API_TOKEN","TELEGRAM_BOT_TOKEN","DOPPLER_TOKEN","PYPI_TOKEN","BRIGHTDATA_API_KEY","KIE_API_KEY","ELEVENLABS_API_KEY","HIGGSFIELD_API_KEY","DEEPSEEK_API_KEY","MISTRAL_API_KEY","COHERE_API_KEY","GEMINI_API_KEY","DATABASE_URL","PRIVATE_KEY","JWT","SAFE_KEY_1","SAFE_KEY_2","SAFE_KEY_3","SAFE_KEY_4","SAFE_KEY_5","SAFE_KEY_6","SAFE_KEY_7","SAFE_KEY_8","SAFE_TOKEN_1","SAFE_TOKEN_2","SAFE_TOKEN_3","SAFE_TOKEN_4","SAFE_PASSWORD_1","SAFE_PASSWORD_2","SAFE_PASSWORD_3","SAFE_PASSWORD_4","SAFE_SECRET_1","SAFE_SECRET_2","SAFE_SECRET_3","SAFE_SECRET_4"];

/** Sets `name` in the engine process (and every tool it starts after). False when the name is not in the table. */
async function envSet($: Engine, name: string, value: string): Promise<boolean> {
  switch (name) {
    case "ANTHROPIC_API_KEY": await $.env.set("ANTHROPIC_API_KEY", value); return true;
    case "OPENAI_API_KEY": await $.env.set("OPENAI_API_KEY", value); return true;
    case "OPENROUTER_API_KEY": await $.env.set("OPENROUTER_API_KEY", value); return true;
    case "GITHUB_TOKEN": await $.env.set("GITHUB_TOKEN", value); return true;
    case "GITLAB_TOKEN": await $.env.set("GITLAB_TOKEN", value); return true;
    case "AWS_ACCESS_KEY_ID": await $.env.set("AWS_ACCESS_KEY_ID", value); return true;
    case "AWS_SECRET_ACCESS_KEY": await $.env.set("AWS_SECRET_ACCESS_KEY", value); return true;
    case "GOOGLE_API_KEY": await $.env.set("GOOGLE_API_KEY", value); return true;
    case "GOOGLE_OAUTH_TOKEN": await $.env.set("GOOGLE_OAUTH_TOKEN", value); return true;
    case "SLACK_TOKEN": await $.env.set("SLACK_TOKEN", value); return true;
    case "STRIPE_SECRET_KEY": await $.env.set("STRIPE_SECRET_KEY", value); return true;
    case "STRIPE_PUBLISHABLE_KEY": await $.env.set("STRIPE_PUBLISHABLE_KEY", value); return true;
    case "STRIPE_WEBHOOK_SECRET": await $.env.set("STRIPE_WEBHOOK_SECRET", value); return true;
    case "RESEND_API_KEY": await $.env.set("RESEND_API_KEY", value); return true;
    case "SUPABASE_ACCESS_TOKEN": await $.env.set("SUPABASE_ACCESS_TOKEN", value); return true;
    case "SUPABASE_SERVICE_ROLE_KEY": await $.env.set("SUPABASE_SERVICE_ROLE_KEY", value); return true;
    case "SUPABASE_SECRET_KEY": await $.env.set("SUPABASE_SECRET_KEY", value); return true;
    case "SUPABASE_PUBLISHABLE_KEY": await $.env.set("SUPABASE_PUBLISHABLE_KEY", value); return true;
    case "SUPABASE_ANON_KEY": await $.env.set("SUPABASE_ANON_KEY", value); return true;
    case "APIFY_TOKEN": await $.env.set("APIFY_TOKEN", value); return true;
    case "HF_TOKEN": await $.env.set("HF_TOKEN", value); return true;
    case "NPM_TOKEN": await $.env.set("NPM_TOKEN", value); return true;
    case "VERCEL_TOKEN": await $.env.set("VERCEL_TOKEN", value); return true;
    case "CLOUDFLARE_API_TOKEN": await $.env.set("CLOUDFLARE_API_TOKEN", value); return true;
    case "TWILIO_AUTH_TOKEN": await $.env.set("TWILIO_AUTH_TOKEN", value); return true;
    case "TWILIO_API_KEY": await $.env.set("TWILIO_API_KEY", value); return true;
    case "SENDGRID_API_KEY": await $.env.set("SENDGRID_API_KEY", value); return true;
    case "MAILGUN_API_KEY": await $.env.set("MAILGUN_API_KEY", value); return true;
    case "DIGITALOCEAN_TOKEN": await $.env.set("DIGITALOCEAN_TOKEN", value); return true;
    case "LINEAR_API_KEY": await $.env.set("LINEAR_API_KEY", value); return true;
    case "NOTION_TOKEN": await $.env.set("NOTION_TOKEN", value); return true;
    case "GROQ_API_KEY": await $.env.set("GROQ_API_KEY", value); return true;
    case "PERPLEXITY_API_KEY": await $.env.set("PERPLEXITY_API_KEY", value); return true;
    case "REPLICATE_API_TOKEN": await $.env.set("REPLICATE_API_TOKEN", value); return true;
    case "FLY_API_TOKEN": await $.env.set("FLY_API_TOKEN", value); return true;
    case "TELEGRAM_BOT_TOKEN": await $.env.set("TELEGRAM_BOT_TOKEN", value); return true;
    case "DOPPLER_TOKEN": await $.env.set("DOPPLER_TOKEN", value); return true;
    case "PYPI_TOKEN": await $.env.set("PYPI_TOKEN", value); return true;
    case "BRIGHTDATA_API_KEY": await $.env.set("BRIGHTDATA_API_KEY", value); return true;
    case "KIE_API_KEY": await $.env.set("KIE_API_KEY", value); return true;
    case "ELEVENLABS_API_KEY": await $.env.set("ELEVENLABS_API_KEY", value); return true;
    case "HIGGSFIELD_API_KEY": await $.env.set("HIGGSFIELD_API_KEY", value); return true;
    case "DEEPSEEK_API_KEY": await $.env.set("DEEPSEEK_API_KEY", value); return true;
    case "MISTRAL_API_KEY": await $.env.set("MISTRAL_API_KEY", value); return true;
    case "COHERE_API_KEY": await $.env.set("COHERE_API_KEY", value); return true;
    case "GEMINI_API_KEY": await $.env.set("GEMINI_API_KEY", value); return true;
    case "DATABASE_URL": await $.env.set("DATABASE_URL", value); return true;
    case "PRIVATE_KEY": await $.env.set("PRIVATE_KEY", value); return true;
    case "JWT": await $.env.set("JWT", value); return true;
    case "SAFE_KEY_1": await $.env.set("SAFE_KEY_1", value); return true;
    case "SAFE_KEY_2": await $.env.set("SAFE_KEY_2", value); return true;
    case "SAFE_KEY_3": await $.env.set("SAFE_KEY_3", value); return true;
    case "SAFE_KEY_4": await $.env.set("SAFE_KEY_4", value); return true;
    case "SAFE_KEY_5": await $.env.set("SAFE_KEY_5", value); return true;
    case "SAFE_KEY_6": await $.env.set("SAFE_KEY_6", value); return true;
    case "SAFE_KEY_7": await $.env.set("SAFE_KEY_7", value); return true;
    case "SAFE_KEY_8": await $.env.set("SAFE_KEY_8", value); return true;
    case "SAFE_TOKEN_1": await $.env.set("SAFE_TOKEN_1", value); return true;
    case "SAFE_TOKEN_2": await $.env.set("SAFE_TOKEN_2", value); return true;
    case "SAFE_TOKEN_3": await $.env.set("SAFE_TOKEN_3", value); return true;
    case "SAFE_TOKEN_4": await $.env.set("SAFE_TOKEN_4", value); return true;
    case "SAFE_PASSWORD_1": await $.env.set("SAFE_PASSWORD_1", value); return true;
    case "SAFE_PASSWORD_2": await $.env.set("SAFE_PASSWORD_2", value); return true;
    case "SAFE_PASSWORD_3": await $.env.set("SAFE_PASSWORD_3", value); return true;
    case "SAFE_PASSWORD_4": await $.env.set("SAFE_PASSWORD_4", value); return true;
    case "SAFE_SECRET_1": await $.env.set("SAFE_SECRET_1", value); return true;
    case "SAFE_SECRET_2": await $.env.set("SAFE_SECRET_2", value); return true;
    case "SAFE_SECRET_3": await $.env.set("SAFE_SECRET_3", value); return true;
    case "SAFE_SECRET_4": await $.env.set("SAFE_SECRET_4", value); return true;
    default: return false;
  }
}

/** Reads `name` from the engine process. Undefined when unset or not in the table. */
async function envGet($: Engine, name: string): Promise<string | undefined> {
  switch (name) {
    case "ANTHROPIC_API_KEY": return $.env.get("ANTHROPIC_API_KEY");
    case "OPENAI_API_KEY": return $.env.get("OPENAI_API_KEY");
    case "OPENROUTER_API_KEY": return $.env.get("OPENROUTER_API_KEY");
    case "GITHUB_TOKEN": return $.env.get("GITHUB_TOKEN");
    case "GITLAB_TOKEN": return $.env.get("GITLAB_TOKEN");
    case "AWS_ACCESS_KEY_ID": return $.env.get("AWS_ACCESS_KEY_ID");
    case "AWS_SECRET_ACCESS_KEY": return $.env.get("AWS_SECRET_ACCESS_KEY");
    case "GOOGLE_API_KEY": return $.env.get("GOOGLE_API_KEY");
    case "GOOGLE_OAUTH_TOKEN": return $.env.get("GOOGLE_OAUTH_TOKEN");
    case "SLACK_TOKEN": return $.env.get("SLACK_TOKEN");
    case "STRIPE_SECRET_KEY": return $.env.get("STRIPE_SECRET_KEY");
    case "STRIPE_PUBLISHABLE_KEY": return $.env.get("STRIPE_PUBLISHABLE_KEY");
    case "STRIPE_WEBHOOK_SECRET": return $.env.get("STRIPE_WEBHOOK_SECRET");
    case "RESEND_API_KEY": return $.env.get("RESEND_API_KEY");
    case "SUPABASE_ACCESS_TOKEN": return $.env.get("SUPABASE_ACCESS_TOKEN");
    case "SUPABASE_SERVICE_ROLE_KEY": return $.env.get("SUPABASE_SERVICE_ROLE_KEY");
    case "SUPABASE_SECRET_KEY": return $.env.get("SUPABASE_SECRET_KEY");
    case "SUPABASE_PUBLISHABLE_KEY": return $.env.get("SUPABASE_PUBLISHABLE_KEY");
    case "SUPABASE_ANON_KEY": return $.env.get("SUPABASE_ANON_KEY");
    case "APIFY_TOKEN": return $.env.get("APIFY_TOKEN");
    case "HF_TOKEN": return $.env.get("HF_TOKEN");
    case "NPM_TOKEN": return $.env.get("NPM_TOKEN");
    case "VERCEL_TOKEN": return $.env.get("VERCEL_TOKEN");
    case "CLOUDFLARE_API_TOKEN": return $.env.get("CLOUDFLARE_API_TOKEN");
    case "TWILIO_AUTH_TOKEN": return $.env.get("TWILIO_AUTH_TOKEN");
    case "TWILIO_API_KEY": return $.env.get("TWILIO_API_KEY");
    case "SENDGRID_API_KEY": return $.env.get("SENDGRID_API_KEY");
    case "MAILGUN_API_KEY": return $.env.get("MAILGUN_API_KEY");
    case "DIGITALOCEAN_TOKEN": return $.env.get("DIGITALOCEAN_TOKEN");
    case "LINEAR_API_KEY": return $.env.get("LINEAR_API_KEY");
    case "NOTION_TOKEN": return $.env.get("NOTION_TOKEN");
    case "GROQ_API_KEY": return $.env.get("GROQ_API_KEY");
    case "PERPLEXITY_API_KEY": return $.env.get("PERPLEXITY_API_KEY");
    case "REPLICATE_API_TOKEN": return $.env.get("REPLICATE_API_TOKEN");
    case "FLY_API_TOKEN": return $.env.get("FLY_API_TOKEN");
    case "TELEGRAM_BOT_TOKEN": return $.env.get("TELEGRAM_BOT_TOKEN");
    case "DOPPLER_TOKEN": return $.env.get("DOPPLER_TOKEN");
    case "PYPI_TOKEN": return $.env.get("PYPI_TOKEN");
    case "BRIGHTDATA_API_KEY": return $.env.get("BRIGHTDATA_API_KEY");
    case "KIE_API_KEY": return $.env.get("KIE_API_KEY");
    case "ELEVENLABS_API_KEY": return $.env.get("ELEVENLABS_API_KEY");
    case "HIGGSFIELD_API_KEY": return $.env.get("HIGGSFIELD_API_KEY");
    case "DEEPSEEK_API_KEY": return $.env.get("DEEPSEEK_API_KEY");
    case "MISTRAL_API_KEY": return $.env.get("MISTRAL_API_KEY");
    case "COHERE_API_KEY": return $.env.get("COHERE_API_KEY");
    case "GEMINI_API_KEY": return $.env.get("GEMINI_API_KEY");
    case "DATABASE_URL": return $.env.get("DATABASE_URL");
    case "PRIVATE_KEY": return $.env.get("PRIVATE_KEY");
    case "JWT": return $.env.get("JWT");
    case "SAFE_KEY_1": return $.env.get("SAFE_KEY_1");
    case "SAFE_KEY_2": return $.env.get("SAFE_KEY_2");
    case "SAFE_KEY_3": return $.env.get("SAFE_KEY_3");
    case "SAFE_KEY_4": return $.env.get("SAFE_KEY_4");
    case "SAFE_KEY_5": return $.env.get("SAFE_KEY_5");
    case "SAFE_KEY_6": return $.env.get("SAFE_KEY_6");
    case "SAFE_KEY_7": return $.env.get("SAFE_KEY_7");
    case "SAFE_KEY_8": return $.env.get("SAFE_KEY_8");
    case "SAFE_TOKEN_1": return $.env.get("SAFE_TOKEN_1");
    case "SAFE_TOKEN_2": return $.env.get("SAFE_TOKEN_2");
    case "SAFE_TOKEN_3": return $.env.get("SAFE_TOKEN_3");
    case "SAFE_TOKEN_4": return $.env.get("SAFE_TOKEN_4");
    case "SAFE_PASSWORD_1": return $.env.get("SAFE_PASSWORD_1");
    case "SAFE_PASSWORD_2": return $.env.get("SAFE_PASSWORD_2");
    case "SAFE_PASSWORD_3": return $.env.get("SAFE_PASSWORD_3");
    case "SAFE_PASSWORD_4": return $.env.get("SAFE_PASSWORD_4");
    case "SAFE_SECRET_1": return $.env.get("SAFE_SECRET_1");
    case "SAFE_SECRET_2": return $.env.get("SAFE_SECRET_2");
    case "SAFE_SECRET_3": return $.env.get("SAFE_SECRET_3");
    case "SAFE_SECRET_4": return $.env.get("SAFE_SECRET_4");
    default: return undefined;
  }
}

/** The marker listing the names Safe Keys exported, so a reload re-imports only those. */
async function markerGet($: Engine): Promise<string | undefined> { return $.env.get("SAFE_KEYS_EXPORTED"); }
async function markerSet($: Engine, value: string): Promise<void> { await $.env.set("SAFE_KEYS_EXPORTED", value); }
// END GENERATED ENV TABLE

let home: string | undefined;
let transcriptPath: string | undefined;
let sessionCwd: string | undefined;
let sessionId: string | undefined;
let pluginRoot: string | undefined;
let envWorks: boolean | undefined;
let scrubbing = false;
let nodeMissing = false;
const once = new Set<string>();

// ---------------------------------------------------------------------------------------------
// Diagnostics: a rolling log, never a value.

const diagLines: string[] = [];
let diagFlushing = false;

function diag($: Engine, line: string): void {
  diagLines.push(new Date().toISOString() + " " + line);
  if (diagLines.length > 400) diagLines.splice(0, diagLines.length - 400);
  try {
    $.ui.log(PLUGIN + ": " + line, { to: "debug" });
  } catch {
    // no debug sink on this build
  }
  void flushDiag($);
}

function diagOnce($: Engine, key: string, line: string): void {
  if (once.has(key)) return;
  once.add(key);
  diag($, line);
}

async function flushDiag($: Engine): Promise<void> {
  if (diagFlushing || !home || diagLines.length === 0) return;
  diagFlushing = true;
  try {
    const path = home + "/.claude/" + DIAG;
    const previous = (await fsRead($, path)) ?? "";
    const merged = previous.split("\n").filter(Boolean).concat(diagLines);
    diagLines.length = 0;
    await $.fs.write(path, merged.slice(-500).join("\n") + "\n");
  } catch {
    // best effort
  } finally {
    diagFlushing = false;
  }
}

async function fsRead($: Engine, path: string): Promise<string | undefined> {
  try {
    const r = await $.fs.read(path);
    return typeof r === "string" ? r : typeof r?.text === "string" ? r.text : undefined;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------------------------
// Session facts.

async function learnSession($: Engine): Promise<void> {
  if (!home) {
    try {
      home = (await $.env.get("USERPROFILE")) ?? (await $.env.get("HOME"));
    } catch {
      home = undefined;
    }
    if (home) home = home.replace(/\\/g, "/").replace(/\/$/, "");
  }
  if (!pluginRoot) {
    try {
      const root = $.plugin.root;
      if (typeof root === "string") pluginRoot = root.replace(/\\/g, "/").replace(/\/$/, "");
    } catch {
      pluginRoot = undefined;
    }
  }
  if (!sessionId) {
    try {
      sessionId = await $.session.id();
    } catch {
      sessionId = undefined;
    }
  }
  if (!sessionCwd) {
    try {
      sessionCwd = await $.session.cwd();
    } catch {
      sessionCwd = undefined;
    }
  }
}

/** The transcript file: what classic.SessionStart said, or the engine's own layout from cwd and id. */
function resolveTranscript(): string | undefined {
  if (transcriptPath) return transcriptPath;
  if (!home || !sessionCwd || !sessionId) return undefined;
  return home + "/.claude/projects/" + sessionCwd.replace(/[^A-Za-z0-9]/g, "-") + "/" + sessionId + ".jsonl";
}

// ---------------------------------------------------------------------------------------------
// Environment export: each stored value becomes a real variable, under a literal name, for every
// tool process the engine starts. A reload re-imports exactly the names this plugin exported.

const MARKER_VERSION = "v2:";

async function exportEnv($: Engine): Promise<void> {
  if (envWorks === false || vault.size === 0) return;
  const exported: string[] = [];
  for (const [name, value] of vault.entries()) {
    // Only what the user handed over. A value a tool printed is masked, never exported.
    if (!vault.isExported(name)) continue;
    const alias = vault.envNameFor(name);
    try {
      if (await envSet($, alias, value)) exported.push(alias);
      if (envWorks === undefined) {
        envWorks = true;
        diag($, "env: $.env.set works; stored names are real variables for Bash and PowerShell");
      }
    } catch (err) {
      envWorks = false;
      diag($, "env: $.env.set unavailable (" + String((err as Error)?.name) + "); tools get textual substitution only");
      return;
    }
  }
  try {
    await markerSet($, MARKER_VERSION + exported.join(","));
  } catch {
    // the marker is a convenience for reloads
  }
}

/** Unsets every name the marker lists and clears the marker: the forget command and a stale marker both end here. */
async function unexportAll($: Engine, marker: string | undefined): Promise<number> {
  const list = (marker ?? "").replace(/^v\d+:/, "");
  let n = 0;
  for (const name of list.split(",")) {
    if (!name || !ENV_NAMES.includes(name)) continue;
    try {
      await envSet($, name, undefined as unknown as string);
      n++;
    } catch {
      // best effort
    }
  }
  try {
    await markerSet($, MARKER_VERSION);
  } catch {
    // best effort
  }
  return n;
}

async function importEnv($: Engine): Promise<number> {
  let marker: string | undefined;
  try {
    marker = await markerGet($);
  } catch {
    return 0;
  }
  if (!marker) return 0;
  if (!marker.startsWith(MARKER_VERSION)) {
    // Written by an earlier build that exported tool-output values too. Clear it rather than trust it.
    const n = await unexportAll($, marker);
    diag($, "env: cleared " + n + " name(s) exported by an earlier build");
    return 0;
  }
  let n = 0;
  for (const name of marker.slice(MARKER_VERSION.length).split(",")) {
    if (!name || !ENV_NAMES.includes(name)) continue;
    try {
      const value = await envGet($, name);
      if (typeof value === "string" && value.length >= 8) {
        vault.stash(value, name);
        n++;
      }
    } catch {
      // skip
    }
  }
  return n;
}

// ---------------------------------------------------------------------------------------------
// Disk pass: scripts/scrub.mjs under node, same-length in-place; an in-process exact-value fallback.

async function runDiskScrub($: Engine, why: string): Promise<void> {
  if (scrubbing) return;
  scrubbing = true;
  try {
    await learnSession($);
    const path = resolveTranscript();
    if (!path) {
      diag($, "disk (" + why + "): transcript path unknown");
      return;
    }
    if (!nodeMissing && pluginRoot) {
      try {
        const r = await $.process.run(["node", pluginRoot + "/scripts/scrub.mjs", "--file", path, "--quiet", "--values-stdin", "--prompts-only"], {
          stdin: JSON.stringify({ values: vault.values() }),
          timeoutMs: 20000,
        });
        const out = String(r?.stdout ?? "").trim();
        diag($, "disk (" + why + "): " + (out || "no output") + " exit=" + String(r?.exitCode));
        if (r?.exitCode === 0) return;
      } catch (err) {
        const msg = String((err as Error)?.message ?? err);
        nodeMissing = /ENOENT|not found|cannot start|spawn/i.test(msg);
        diag($, "disk (" + why + "): scrub.mjs did not run (" + msg.slice(0, 80) + ")" + (nodeMissing ? "; node missing, in-process fallback from now on" : ""));
      }
    }
    if (vault.size === 0) return;
    const text = await fsRead($, path);
    if (text === undefined || vault.scrub(text) === text) return;
    const before = await statSize($, path);
    const clean = vault.scrub(text);
    const after = await statSize($, path);
    if (before !== undefined && before === after) {
      await $.fs.write(path, clean);
      diag($, "disk (" + why + "): a stored value was on disk; rewrote the file with names");
    } else {
      diag($, "disk (" + why + "): a stored value is on disk but the file is being written; will retry");
    }
  } catch (err) {
    diag($, "disk (" + why + "): failed (" + String((err as Error)?.message ?? err).slice(0, 80) + ")");
  } finally {
    scrubbing = false;
  }
}

async function statSize($: Engine, path: string): Promise<number | undefined> {
  try {
    const s = await $.fs.stat(path);
    return typeof s?.size === "number" ? s.size : undefined;
  } catch {
    return undefined;
  }
}

function scheduleDiskScrub($: Engine, why: string): void {
  void runDiskScrub($, why);
  for (const ms of [3000, 15000]) {
    try {
      $.clock.after(ms, () => void runDiskScrub($, why + " +" + ms / 1000 + "s"));
    } catch (err) {
      diagOnce($, "clock", "clock.after unavailable (" + String((err as Error)?.name) + "); no delayed disk pass");
      break;
    }
  }
}

// ---------------------------------------------------------------------------------------------
// The inbox: a file the user drops a key into instead of pasting it. Read and emptied on the next prompt.

async function drainInbox($: Engine): Promise<string[]> {
  if (!home) return [];
  const path = home + "/.claude/" + INBOX;
  const raw = await fsRead($, path);
  if (!raw || !raw.trim()) return [];
  const placeholders: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const value = line.trim();
    if (value.length < 8) continue;
    const { hits } = redactText(value, new Vault(), { knownOnly: true });
    const name = hits.length === 1 && hits[0].value === value ? hits[0].name : "SAFE_KEY";
    placeholders.push(vault.stash(value, name, "inbox"));
  }
  try {
    await $.fs.write(path, "");
  } catch {
    diag($, "inbox: could not empty the file");
  }
  return placeholders;
}

// ---------------------------------------------------------------------------------------------
// Shared text cleaners.

/** Stored values to names, then any new key of a known shape or label stored (as tool output, never exported) and replaced too. */
function cleanKnown(text: string): string {
  return redactText(vault.scrub(text), vault, { knownOnly: true, source: "output" }).text;
}

/** The same with the full detector: for text the user typed. */
function cleanFull(text: string): string {
  return redactText(vault.scrub(text), vault).text;
}

function announce($: Engine, fresh: string[], where: string): void {
  if (fresh.length === 0) return;
  diag($, where + ": stored " + fresh.length + " value(s) as " + fresh.join(", "));
  try {
    $.ui.log(PLUGIN + ": stored " + fresh.join(", ") + " (" + where + "). Use the name like a shell variable.");
  } catch {
    // cosmetic
  }
  try {
    $.ui.toast("Safe Keys stored " + fresh.join(", "), { timeoutMs: 6000 });
  } catch {
    // cosmetic
  }
}

function freshSince(countBefore: number): string[] {
  return vault.placeholders().slice(countBefore);
}

// ---------------------------------------------------------------------------------------------

export const register: Register = (on) => {
  on("classic.SessionStart", async ($, e: any, next) => {
    if (typeof e?.transcript_path === "string") transcriptPath = e.transcript_path.replace(/\\/g, "/");
    if (typeof e?.cwd === "string") sessionCwd = e.cwd;
    if (typeof e?.session_id === "string") sessionId = e.session_id;
    return next(e);
  });

  on("session.start", async ($, e, next) => {
    await learnSession($);
    const imported = await importEnv($);
    diag($, "session.start: home " + (home ? "ok" : "unknown") + ", plugin root " + (pluginRoot ? "ok" : "unknown") + ", transcript " + (resolveTranscript() ? "resolvable" : "unresolved") + (imported ? ", re-imported " + imported + " name(s) after a reload" : ""));
    try {
      await $.command.register({ name: "safe-keys", description: "Safe Keys: stored names, transcript scan, cleanup", argumentHint: "[status|scan|clean|forget]" });
      diag($, "command: /safe-keys registered");
    } catch (err) {
      // The folder's SKILL.md already owns /safe-keys as a skill command on some builds; take a second name.
      diag($, "command.register /safe-keys refused (" + String((err as Error)?.message ?? err).slice(0, 120) + "); trying /keys");
      try {
        await $.command.register({ name: "keys", description: "Safe Keys: stored names, transcript scan, cleanup", argumentHint: "[status|scan|clean|forget]" });
        diag($, "command: /keys registered");
      } catch (err2) {
        diag($, "command.register /keys refused (" + String((err2 as Error)?.message ?? err2).slice(0, 120) + ")");
      }
    }
    try {
      $.ui.log(PLUGIN + ": on. A pasted key is stored and shown as a name such as $OPENROUTER_API_KEY; the value never enters the transcript. /keys for status.");
    } catch {
      // cosmetic
    }
    return next(e);
  });

  // 1. Composer: a paste is replaced before the text is queued or drawn. Keystrokes are short and cheap.
  on("prompt.edit", async ($, e: any, next) => {
    diagOnce($, "prompt.edit", "prompt.edit fires on this surface");
    if (typeof e?.inputText !== "string" || e.inputText.length < 8) return next(e);
    const before = vault.size;
    const { text, hits } = redactText(e.inputText, vault);
    if (hits.length === 0) return next(e);
    const r = await next({ ...e, inputText: text });
    void exportEnv($);
    announce($, freshSince(before), "prompt.edit");
    return r;
  });

  // 2. The prompt: the message the model and the transcript receive.
  on("prompt.submit", async ($, e: any, next) => {
    await learnSession($);
    const before = vault.size;
    const inbox = await drainInbox($);
    const { text, hits } = redactText(e.text, vault);
    const stored = vault.size > 0;
    const context = stored ? [...(e.context ?? []), usageNote(vault.placeholders())] : e.context;

    // Pass the clean text down first, so the redaction holds even if a notice call below fails.
    const r = await next(hits.length > 0 || stored ? { ...e, text, ...(context ? { context } : {}) } : e);

    if (hits.length > 0 || inbox.length > 0) {
      void exportEnv($);
      scheduleDiskScrub($, "prompt.submit");
      try {
        $.ui.invalidate("ui.render");
      } catch {
        // the render hook catches the next draw
      }
      announce($, freshSince(before), inbox.length > 0 && hits.length === 0 ? "inbox" : "prompt");
    }
    return r;
  });

  // 3. Every stored row.
  on("session.append", async ($, e: any, next) => {
    const content = e?.message?.content;
    if (!Array.isArray(content)) return next(e);
    const full = e.door === "prompt";
    const before = vault.size;
    const rewritten = rewriteContent(content, full ? cleanFull : cleanKnown, cleanKnown);
    const changed = rewritten !== content;
    if (!changed) return next(e);
    diagOnce($, "append:" + String(e.door), "session.append rewrote a row at door " + String(e.door));
    const fresh = freshSince(before);
    if (fresh.length > 0) {
      void exportEnv($);
      announce($, fresh, "session.append " + String(e.door));
    }
    return next({ ...e, message: { ...e.message, content: rewritten } });
  }).catch(($, e: any, next) => {
    // The rewrite failed: still replace any stored value with the plainest possible pass.
    try {
      const content = mapStrings(e?.message?.content, (s: string) => vault.scrub(s));
      if (content !== e?.message?.content) return next({ ...e, message: { ...e.message, content } });
    } catch {
      // nothing more to try
    }
    return next(e);
  });

  // 4. Tools: names resolved on the way in, values and new keys replaced on the way out.
  on("tool.call", async ($, e: any, next) => {
    let call = e;
    if (vault.size > 0) {
      await exportEnv($);
      const tool = String(e?.tool);
      if ((tool === "Bash" || tool === "PowerShell") && typeof e.command === "string") {
        const shell = tool === "PowerShell" ? "powershell" : "bash";
        const command = envWorks ? vault.restoreForShell(e.command, shell) : vault.restore(e.command);
        if (command !== e.command) {
          call = { ...e, command };
          diag($, "tool.call " + tool + ": resolved stored name(s) " + (envWorks ? "as environment variables" : "textually"));
        }
      } else {
        // Value positions only (KEY=, "key":, Bearer, --flag, or the whole argument): a name
        // mentioned in prose or source code the model writes stays a name.
        const restored = mapStrings(e, (s: string) => vault.restoreValues(s));
        if (restored !== e) {
          call = restored;
          diag($, "tool.call " + tool + ": substituted stored value(s) into value positions of the arguments");
        }
      }
    }
    const r = await next(call);
    if (!r || r.deny !== undefined) return r;

    // Only a structured result is rewritten here. A string or primitive result is left as it is:
    // the engine validates a hook's own result against the tool's output schema, and the
    // session.append layer still scrubs the stored row before the model reads it.
    if (!r.result || typeof r.result !== "object") return r;
    const before = vault.size;
    let result: unknown;
    try {
      result = mapStrings(r.result, cleanKnown);
    } catch (err) {
      diag($, "tool.call " + String(e?.tool) + ": result rewrite failed (" + String((err as Error)?.message ?? err).slice(0, 80) + "); row scrub still applies");
      return r;
    }
    if (result === r.result) return r;

    const fresh = freshSince(before);
    if (fresh.length > 0) {
      void exportEnv($);
      announce($, fresh, "tool.call " + String(e?.tool) + " result");
    } else {
      diag($, "tool.call " + String(e?.tool) + ": a stored value in the result was replaced by its name");
    }
    // A note for the model, on its own calls only: the engine keeps no context on a plugin's own $.tool.call.
    const context = [...(r.context ?? [])];
    if (fresh.length > 0 && typeof e?.tool_use_id === "string") context.push("The tool output contained credential(s), now stored and usable as " + fresh.join(", ") + ". Use the name(s), never the value.");
    return { result, ...(context.length > 0 ? { context } : {}), ...(r.isError === true ? { isError: true } : {}) };
  });

  // 5. Screen.
  on("ui.render", async ($, e: any, next) => {
    const props = e?.props;
    if (!props || typeof props !== "object") return next(e);
    const component = String(e?.component);
    if ((component === "UserMessage" || component === "AssistantMessage") && typeof props.text === "string") {
      const text = forDisplay(props.text, vault, { knownOnly: component === "AssistantMessage" });
      if (text === props.text) return next(e);
      diagOnce($, "render:" + component + ":" + String(e?.surface), "ui.render masked " + component + " on " + String(e?.surface));
      return next({ ...e, props: { ...props, text } });
    }
    const scrubbed = mapStrings(props, (s: string) => forDisplay(s, vault, { knownOnly: true }));
    if (scrubbed === props) return next(e);
    diagOnce($, "render:" + component + ":" + String(e?.surface), "ui.render masked " + component + " on " + String(e?.surface));
    return next({ ...e, props: scrubbed });
  });

  on("turn.complete", async ($, e, next) => {
    if (vault.size > 0) scheduleDiskScrub($, "turn.complete");
    return next(e);
  });

  on("session.end", async ($, e, next) => {
    await runDiskScrub($, "session.end");
    await flushDiag($);
    return next(e);
  });

  // /safe-keys status | scan | clean | forget
  on("command.run", { command: ["safe-keys", "keys"] }, async ($, e: any) => {
    const arg = String(e?.args ?? "").trim().toLowerCase();
    await learnSession($);
    if (arg === "forget") {
      const n = vault.size;
      let marker: string | undefined;
      try {
        marker = await markerGet($);
      } catch {
        marker = undefined;
      }
      const cleared = await unexportAll($, marker);
      vault.forget();
      diag($, "command: forgot " + n + " stored value(s), unset " + cleared + " environment name(s)");
      return { text: "Safe Keys: forgot " + n + " stored value(s) and unset " + cleared + " environment name(s). Tools started from now on see none of them." };
    }
    if (arg === "scan" || arg === "clean") {
      if (!pluginRoot) return { text: "Safe Keys: plugin root unknown; run node <plugin>/scripts/scrub.mjs --all --dry-run yourself." };
      try {
        const argv = ["node", pluginRoot + "/scripts/scrub.mjs", "--all", "--report", "--quiet", "--values-stdin"];
        if (arg === "scan") argv.push("--dry-run");
        const r = await $.process.run(argv, { stdin: JSON.stringify({ values: vault.values() }), timeoutMs: 300000 });
        const out = String(r?.stdout ?? "").trim().split("\n").pop() ?? "";
        diag($, "command " + arg + ": " + out);
        return { text: "Safe Keys " + arg + ": " + out + (arg === "scan" ? "\nRun /safe-keys clean to overwrite them in place." : "") };
      } catch (err) {
        return { text: "Safe Keys: scan failed (" + String((err as Error)?.message ?? err).slice(0, 120) + ")" };
      }
    }
    const names = vault.placeholders();
    const lines = [
      "Safe Keys is on.",
      names.length ? "Stored this session: " + names.join(", ") : "Nothing stored this session.",
      "Environment export: " + (envWorks === undefined ? "not needed yet" : envWorks ? "on" : "unavailable (textual substitution)"),
      "Transcript: " + (resolveTranscript() ?? "unknown"),
      "Diag log: " + (home ? home + "/.claude/" + DIAG : "unknown"),
      "Inbox: drop a key in " + (home ? home + "/.claude/" + INBOX : "~/.claude/" + INBOX) + " to store it without pasting.",
      "Commands: /safe-keys scan (dry run over every transcript), /safe-keys clean (overwrite in place), /safe-keys forget.",
    ];
    return { text: lines.join("\n") };
  });
};
