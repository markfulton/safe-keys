// Safe Keys: detection and the in-memory vault.
//
// A plain ES module with no Node and no DOM, so the same code runs inside the
// Claude Code hook environment (hooks/safe-keys.ts imports it) and under Node
// (scripts/scrub.mjs imports it, lib/detect.unit.mjs tests it).
//
// A stored value is shown everywhere as an environment-variable style name:
// `$OPENROUTER_API_KEY`, `$BRIGHTDATA_API_KEY`, `$SAFE_KEY_1`. The name says what
// the value is, it reads as an ordinary shell variable to every permission
// classifier, and if a substitution ever misses it expands to nothing in a shell
// and stays a harmless literal elsewhere: the design fails closed.

/** The display-only marker for a value that looks secret but is not in the vault. */
export const HIDDEN = "[hidden]";

/** Names the engine's `$.env.set` can take, literal by literal (hooks/env-table.js). */
export const GENERIC_SLOTS = { KEY: 8, TOKEN: 4, PASSWORD: 4, SECRET: 4 };

// ---------------------------------------------------------------------------
// Rule 1: known key shapes, most specific first. Each one names itself.

export const KNOWN = [
  { re: /\bsk-ant-[A-Za-z0-9_-]{20,}/g, name: "ANTHROPIC_API_KEY" },
  { re: /\bsk-or-v1-[A-Za-z0-9]{20,}/g, name: "OPENROUTER_API_KEY" },
  { re: /\bsk-(?:proj-|svcacct-|admin-)?[A-Za-z0-9_-]{20,}/g, name: "OPENAI_API_KEY" },
  { re: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}/g, name: "GITHUB_TOKEN" },
  { re: /\bgithub_pat_[A-Za-z0-9_]{30,}/g, name: "GITHUB_TOKEN" },
  { re: /\bglpat-[A-Za-z0-9_-]{20,}/g, name: "GITLAB_TOKEN" },
  { re: /\bAKIA[A-Z0-9]{16}\b/g, name: "AWS_ACCESS_KEY_ID" },
  { re: /\bAIza[A-Za-z0-9_-]{30,}/g, name: "GOOGLE_API_KEY" },
  { re: /\bya29\.[A-Za-z0-9_-]{30,}/g, name: "GOOGLE_OAUTH_TOKEN" },
  { re: /\bxox[abprse]-[A-Za-z0-9-]{10,}/g, name: "SLACK_TOKEN" },
  { re: /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}/g, name: "STRIPE_SECRET_KEY" },
  { re: /\bpk_(?:live|test)_[A-Za-z0-9]{16,}/g, name: "STRIPE_PUBLISHABLE_KEY" },
  { re: /\bwhsec_[A-Za-z0-9]{20,}/g, name: "STRIPE_WEBHOOK_SECRET" },
  { re: /\bre_[A-Za-z0-9_-]{20,}/g, name: "RESEND_API_KEY" },
  { re: /\bsbp_[A-Za-z0-9]{30,}/g, name: "SUPABASE_ACCESS_TOKEN" },
  { re: /\bsb_secret_[A-Za-z0-9_-]{20,}/g, name: "SUPABASE_SECRET_KEY" },
  { re: /\bsb_publishable_[A-Za-z0-9_-]{20,}/g, name: "SUPABASE_PUBLISHABLE_KEY" },
  { re: /\bapify_api_[A-Za-z0-9]{20,}/g, name: "APIFY_TOKEN" },
  { re: /\bhf_[A-Za-z0-9]{30,}/g, name: "HF_TOKEN" },
  { re: /\bnpm_[A-Za-z0-9]{30,}/g, name: "NPM_TOKEN" },
  { re: /\bdop_v1_[a-f0-9]{60,}/g, name: "DIGITALOCEAN_TOKEN" },
  { re: /\blin_api_[A-Za-z0-9]{30,}/g, name: "LINEAR_API_KEY" },
  { re: /\bntn_[A-Za-z0-9]{40,}/g, name: "NOTION_TOKEN" },
  { re: /\bgsk_[A-Za-z0-9]{40,}/g, name: "GROQ_API_KEY" },
  { re: /\bpplx-[A-Za-z0-9]{40,}/g, name: "PERPLEXITY_API_KEY" },
  { re: /\br8_[A-Za-z0-9]{30,}/g, name: "REPLICATE_API_TOKEN" },
  { re: /\bfo1_[A-Za-z0-9_-]{30,}/g, name: "FLY_API_TOKEN" },
  { re: /\bFlyV1 fm2_[A-Za-z0-9_+/=,-]{30,}/g, name: "FLY_API_TOKEN" },
  { re: /\bSG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}/g, name: "SENDGRID_API_KEY" },
  { re: /\bkey-[0-9a-f]{32}\b/g, name: "MAILGUN_API_KEY" },
  { re: /\bSK[0-9a-f]{32}\b/g, name: "TWILIO_API_KEY" },
  { re: /\b\d{8,10}:AA[A-Za-z0-9_-]{33,}/g, name: "TELEGRAM_BOT_TOKEN" },
  { re: /\bdp\.(?:st|pt|sa)\.[A-Za-z0-9_-]{30,}/g, name: "DOPPLER_TOKEN" },
  { re: /\bpypi-AgEIcHlwaS5vcmc[A-Za-z0-9_-]{20,}/g, name: "PYPI_TOKEN" },
  { re: /\bvcp_[A-Za-z0-9]{20,}/g, name: "VERCEL_TOKEN" },
  // A JWT whose payload also starts with `{"` (base64 `eyJ`): Supabase legacy keys, most bearer JWTs.
  { re: /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{10,}/g, name: "JWT" },
  { re: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, name: "PRIVATE_KEY" },
  // A connection string that carries a password.
  { re: /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|rediss|amqp):\/\/[^\s:/@"']+:[^\s/@"']{4,}@[^\s"'<>]+/g, name: "DATABASE_URL" },
];

// ---------------------------------------------------------------------------
// Rule 2: a label that says "credential", then = or :, then the value.
// `BRIGHTDATA_API_KEY=...`, `x-api-key: ...`, `"token": "..."`, `--password ...`,
// `Authorization: Bearer ...`.

const LABEL_WORD =
  "(?:api[_ -]?key|apikey|access[_ -]?key|secret[_ -]?key|private[_ -]?key|service[_ -]?role[_ -]?key|" +
  "client[_ -]?secret|webhook[_ -]?secret|signing[_ -]?secret|secret|access[_ -]?token|refresh[_ -]?token|" +
  "auth[_ -]?token|bot[_ -]?token|api[_ -]?token|token|password|passwd|passphrase|pwd|credentials?)";

const ASSIGNED = new RegExp(
  "(?:^|[^A-Za-z0-9_$])[\"']?((?:[A-Za-z][A-Za-z0-9_.-]*[_.-])?" + LABEL_WORD + ")[\"']?\\s*(?::|=|=>)\\s*(?:bearer\\s+)?[\"']?([^\\s\"',;]{8,})",
  "gi",
);
const BEARER = /\bbearer\s+([A-Za-z0-9_.~+/=-]{16,})/gi;
const FLAG = /(?:^|\s)--?([a-z][a-z0-9-]*?(?:key|token|secret|password|pass))(?:=|\s+)["']?([^\s"']{8,})/gi;

// ---------------------------------------------------------------------------
// Rule 3: a credential word nearby, then a token. Catches "the new key is <uuid>",
// which no shape and no entropy test can see: a UUID tops out at 4.09 bits per
// character. Prompts only (never tool output, where ids are everywhere).

const CRED_WORD = /\b(?:api[ _-]?keys?|apikeys?|keys?|tokens?|secrets?|passwords?|passphrase|credentials?|bearer|auth)\b/i;
const CONTEXT_TOKEN = /[A-Za-z0-9][A-Za-z0-9_-]{14,}[A-Za-z0-9]/g;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UPPER_IDENT = /^[A-Z][A-Z0-9_]*$/;
const DATE_LIKE = /^\d{4}-\d{2}-\d{2}(?:[T_-][\d:.-]+)?$/;
const VERSION_LIKE = /^v?\d+(?:\.\d+){1,3}(?:-[A-Za-z0-9.]+)?$/;
const CONTEXT_WINDOW = 56;

// ---------------------------------------------------------------------------
// Rule 4: a bare high-entropy token (prompts only).

const CANDIDATE = /[A-Za-z0-9_-]{24,}/g;
const URL_SPAN = /https?:\/\/[^\s<>"')\]]+/g;

/** Identifiers Claude Code, the API and common services mint themselves. Random looking, never secret. */
const ENGINE_ID_PREFIXES = /^(?:toolu_|msg_|msgid_|req_|agent-|task_|wf_|local_|preview-|session_|hook-|call_|run_|thread_|batch_|cs_|pi_|ch_|cus_|sub_|evt_|in_|price_|prod_)/i;

/** Characters no credential carries: a regex literal, a type annotation, a template, an escape. */
const BAD_VALUE_CHARS = /[()[\]{}<>|\\`]/;

/** Values that are placeholders, examples or redactions, never a credential. */
const NOT_A_VALUE = /^(?:\$\{?[A-Za-z_][A-Za-z0-9_]*\}?|<[^>]*>|\[hidden\]\**|\[redacted\]|x{4,}|\*{4,}|\.{3,}|your[_-]?[a-z_-]*|change[_-]?me|example[_-]?[a-z_-]*|placeholder|redacted|none|null|undefined|true|false)$/i;

/** Messages the engine composes for the model (task notifications, reminders). Not user pastes. */
const ENGINE_MESSAGE = /^\s*<(?:task-notification|system-reminder|command-(?:name|message|args)|local-command-(?:stdout|stderr|caveat)|ci-monitor-event|ide_[a-z_]+)\b/;

/** Vendor words near a value give it its name: "bright data ... key is X" becomes $BRIGHTDATA_API_KEY. */
const VENDORS = [
  [/bright\s*data/i, "BRIGHTDATA"], [/openrouter/i, "OPENROUTER"], [/openai/i, "OPENAI"], [/anthropic|claude/i, "ANTHROPIC"],
  [/github/i, "GITHUB"], [/gitlab/i, "GITLAB"], [/supabase/i, "SUPABASE"], [/stripe/i, "STRIPE"], [/resend/i, "RESEND"],
  [/apify/i, "APIFY"], [/vercel/i, "VERCEL"], [/cloudflare/i, "CLOUDFLARE"], [/twilio/i, "TWILIO"], [/sendgrid/i, "SENDGRID"],
  [/mailgun/i, "MAILGUN"], [/\bkie\b/i, "KIE"], [/eleven\s*labs/i, "ELEVENLABS"], [/higgsfield/i, "HIGGSFIELD"], [/notion/i, "NOTION"],
  [/linear/i, "LINEAR"], [/slack/i, "SLACK"], [/gemini|google/i, "GOOGLE"], [/\baws\b|amazon/i, "AWS"], [/\bfly\.io|\bfly\b/i, "FLY"],
  [/netlify/i, "NETLIFY"], [/heroku/i, "HEROKU"], [/digital\s*ocean/i, "DIGITALOCEAN"], [/replicate/i, "REPLICATE"], [/groq/i, "GROQ"],
  [/perplexity/i, "PERPLEXITY"], [/mistral/i, "MISTRAL"], [/cohere/i, "COHERE"], [/hugging\s*face/i, "HF"], [/\bnpm\b/i, "NPM"],
  [/pypi/i, "PYPI"], [/telegram/i, "TELEGRAM"], [/discord/i, "DISCORD"], [/bunny/i, "BUNNY"], [/podia/i, "PODIA"], [/zapier/i, "ZAPIER"],
  [/make\.com/i, "MAKE"], [/deepseek/i, "DEEPSEEK"], [/zoom/i, "ZOOM"], [/meta\b|facebook/i, "META"], [/namecheap/i, "NAMECHEAP"],
  [/godaddy/i, "GODADDY"], [/porkbun/i, "PORKBUN"], [/doppler/i, "DOPPLER"], [/azure/i, "AZURE"], [/firebase/i, "FIREBASE"],
];

// ---------------------------------------------------------------------------

/**
 * In-memory map between names and the real values. Lives in the hook module's
 * own environment for the length of the session; never written to disk, to
 * `$.store` or to `$.state`.
 */
export class Vault {
  constructor() {
    /** @type {Map<string, string>} name (no $) to value */
    this.byName = new Map();
    /** @type {Map<string, string>} value to placeholder (with $) */
    this.byValue = new Map();
    /** @type {Map<string, string>} name to the environment-variable name a shell can read */
    this.envAlias = new Map();
    /** @type {Map<string, "prompt"|"inbox"|"output">} where each value came from */
    this.sources = new Map();
    this.slotsUsed = { KEY: 0, TOKEN: 0, PASSWORD: 0, SECRET: 0 };
  }

  /**
   * Whether `name` may be exported into tool environments. A value the user pasted or dropped in
   * the inbox is theirs to hand to tools. A value a tool merely printed (a test fixture, a stale
   * key in an old file) is only ever masked: exporting it under a real name such as GITHUB_TOKEN
   * would override the person's working credential for every process that follows.
   */
  isExported(name) {
    return this.sources.get(name) !== "output";
  }

  sourceOf(name) {
    return this.sources.get(name);
  }

  get size() {
    return this.byName.size;
  }

  /** Whether `name` is one hooks/env-table.js can set literally. */
  static isEnvName(name) {
    return ENV_VOCABULARY.has(name);
  }

  /**
   * Stores `value` under `base` (or `base_2`, `base_3` when the base holds another
   * value) and returns its placeholder, `$NAME`. A value already stored keeps its name.
   */
  stash(value, base, source = "prompt") {
    const existing = this.byValue.get(value);
    if (existing) {
      // A value the user later pastes themselves becomes theirs to export.
      const name = existing.slice(1);
      if (source !== "output" && this.sources.get(name) === "output") this.sources.set(name, source);
      return existing;
    }
    let name = cleanName(base) || "SAFE_KEY";
    if (/^SAFE_(?:KEY|TOKEN|PASSWORD|SECRET)$/.test(name)) name = this.nextSlot(name.slice(5)) ?? name;
    let candidate = name;
    for (let n = 2; this.byName.has(candidate); n++) candidate = name + "_" + n;
    this.byName.set(candidate, value);
    this.byValue.set(value, "$" + candidate);
    this.sources.set(candidate, source);
    this.envAlias.set(candidate, Vault.isEnvName(candidate) ? candidate : this.nextSlot("KEY") ?? candidate);
    return "$" + candidate;
  }

  /** The next free literal slot of a kind (`SAFE_KEY_3`), or undefined when the kind is full. */
  nextSlot(kind) {
    const max = GENERIC_SLOTS[kind];
    if (!max) return undefined;
    for (let i = this.slotsUsed[kind] + 1; i <= max; i++) {
      const name = "SAFE_" + kind + "_" + i;
      if (!this.byName.has(name) && !Array.from(this.envAlias.values()).includes(name)) {
        this.slotsUsed[kind] = i;
        return name;
      }
    }
    return undefined;
  }

  placeholderFor(value) {
    return this.byValue.get(value);
  }

  valueFor(name) {
    return this.byName.get(name.replace(/^\$\{?|\}$/g, ""));
  }

  /** The environment-variable name a shell resolves for `name` (itself, or a SAFE_KEY_n slot). */
  envNameFor(name) {
    return this.envAlias.get(name) ?? name;
  }

  /** Bare names, no `$`. */
  names() {
    return Array.from(this.byName.keys());
  }

  /** Names with `$`: what the model sees and writes. */
  placeholders() {
    return this.names().map((n) => "$" + n);
  }

  /** `[name, value]` pairs. */
  entries() {
    return Array.from(this.byName.entries());
  }

  /** Every stored value, longest first. */
  values() {
    return Array.from(this.byValue.keys()).sort((a, b) => b.length - a.length);
  }

  forget() {
    this.byName.clear();
    this.byValue.clear();
    this.envAlias.clear();
    this.sources.clear();
    this.slotsUsed = { KEY: 0, TOKEN: 0, PASSWORD: 0, SECRET: 0 };
  }

  /**
   * Puts real values back only where a placeholder stands as a VALUE: after `=` or `:` (an .env
   * line, a JSON or YAML field), after `Bearer`, after a `--flag`, or as the whole string. A
   * placeholder named in prose ("the key is shown as $NAME") is left alone, so documentation and
   * source code written by the model keep the name. For every tool that is not a shell.
   */
  restoreValues(text) {
    if (this.byName.size === 0 || typeof text !== "string" || text.indexOf("$") === -1) return text;
    const names = this.names().sort((a, b) => b.length - a.length);
    const alt = names.map(escapeRe).join("|");
    const whole = text.match(new RegExp("^\\s*\\$\\{?(" + alt + ")\\}?\\s*$"));
    if (whole) return this.byName.get(whole[1]);
    const re = new RegExp("([=:]\\s*[\"']?|[Bb]earer\\s+|--?[A-Za-z][\\w-]*(?:=|\\s+)[\"']?)(?:\\$\\{(" + alt + ")\\}|\\$(" + alt + ")(?![A-Za-z0-9_]))", "g");
    return text.replace(re, (all, lead, a, b) => lead + this.byName.get(a ?? b));
  }

  /**
   * Puts real values back where a placeholder appears, `$NAME` or `${NAME}`, whole
   * names only, longest name first so `$X_2` is never eaten by `$X`.
   */
  restore(text) {
    if (this.byName.size === 0 || typeof text !== "string" || text.indexOf("$") === -1) return text;
    let out = text;
    for (const name of this.names().sort((a, b) => b.length - a.length)) {
      const value = this.byName.get(name);
      const re = new RegExp("\\$\\{" + name + "\\}|\\$" + name + "(?![A-Za-z0-9_])", "g");
      if (re.test(out)) out = out.replace(re, () => value);
    }
    return out;
  }

  /**
   * Rewrites `$NAME` to the form a shell reads from its environment: `$ALIAS` for
   * Bash, `$env:ALIAS` for PowerShell. Placeholders inside single quotes, which no
   * shell expands, take the real value instead.
   */
  restoreForShell(text, shell) {
    if (this.byName.size === 0 || typeof text !== "string" || text.indexOf("$") === -1) return text;
    const names = this.names().sort((a, b) => b.length - a.length);
    const spans = singleQuotedSpans(text);
    let out = "";
    let last = 0;
    const re = new RegExp("\\$\\{(" + names.map(escapeRe).join("|") + ")\\}|\\$(" + names.map(escapeRe).join("|") + ")(?![A-Za-z0-9_])", "g");
    let m;
    while ((m = re.exec(text)) !== null) {
      const name = m[1] ?? m[2];
      const quoted = spans.some(([s, e]) => m.index >= s && m.index < e);
      let replacement;
      // Single quotes expand nothing, and a value that was never exported has no variable to expand.
      if (quoted || !this.isExported(name)) replacement = this.byName.get(name);
      else if (shell === "powershell") replacement = m[1] ? "${env:" + this.envNameFor(name) + "}" : "$env:" + this.envNameFor(name);
      else replacement = m[1] ? "${" + this.envNameFor(name) + "}" : "$" + this.envNameFor(name);
      out += text.slice(last, m.index) + replacement;
      last = m.index + m[0].length;
    }
    return out + text.slice(last);
  }

  /** Replaces any stored value that appears in `text` (a tool result, a drawn row) with its placeholder. */
  scrub(text) {
    if (this.byName.size === 0 || typeof text !== "string") return text;
    let out = text;
    for (const value of this.values()) {
      const placeholder = this.byValue.get(value);
      if (out.indexOf(value) !== -1) out = out.split(value).join(placeholder);
      // The JSON-escaped form (a PEM key's newlines, a quote inside a password).
      const escaped = JSON.stringify(value).slice(1, -1);
      if (escaped !== value && out.indexOf(escaped) !== -1) out = out.split(escaped).join(placeholder);
      // The URL-encoded form (a password inside a connection string pasted into a URL).
      const encoded = safeEncode(value);
      if (encoded !== value && out.indexOf(encoded) !== -1) out = out.split(encoded).join(placeholder);
    }
    return out;
  }
}

function safeEncode(value) {
  try {
    return encodeURIComponent(value);
  } catch {
    return value;
  }
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** `[start, end)` spans of single-quoted text in a shell command. Naive, no nesting. */
function singleQuotedSpans(text) {
  const spans = [];
  let open = -1;
  let inDouble = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "\\" && open === -1) {
      i++;
      continue;
    }
    if (ch === '"' && open === -1) inDouble = !inDouble;
    if (ch === "'" && !inDouble) {
      if (open === -1) open = i;
      else {
        spans.push([open, i + 1]);
        open = -1;
      }
    }
  }
  return spans;
}

// ---------------------------------------------------------------------------
// Names.

/** The literal environment names hooks/env-table.js knows how to set. Kept in step with that file. */
export const ENV_VOCABULARY = new Set([
  "ANTHROPIC_API_KEY", "OPENAI_API_KEY", "OPENROUTER_API_KEY", "GITHUB_TOKEN", "GITLAB_TOKEN",
  "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "GOOGLE_API_KEY", "GOOGLE_OAUTH_TOKEN", "SLACK_TOKEN",
  "STRIPE_SECRET_KEY", "STRIPE_PUBLISHABLE_KEY", "STRIPE_WEBHOOK_SECRET", "RESEND_API_KEY",
  "SUPABASE_ACCESS_TOKEN", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY", "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_ANON_KEY", "APIFY_TOKEN", "HF_TOKEN", "NPM_TOKEN", "VERCEL_TOKEN", "CLOUDFLARE_API_TOKEN",
  "TWILIO_AUTH_TOKEN", "TWILIO_API_KEY", "SENDGRID_API_KEY", "MAILGUN_API_KEY", "DIGITALOCEAN_TOKEN",
  "LINEAR_API_KEY", "NOTION_TOKEN", "GROQ_API_KEY", "PERPLEXITY_API_KEY", "REPLICATE_API_TOKEN",
  "FLY_API_TOKEN", "TELEGRAM_BOT_TOKEN", "DOPPLER_TOKEN", "PYPI_TOKEN", "BRIGHTDATA_API_KEY",
  "KIE_API_KEY", "ELEVENLABS_API_KEY", "HIGGSFIELD_API_KEY", "DEEPSEEK_API_KEY", "MISTRAL_API_KEY",
  "COHERE_API_KEY", "GEMINI_API_KEY", "DATABASE_URL", "PRIVATE_KEY", "JWT",
  ...Array.from({ length: GENERIC_SLOTS.KEY }, (_, i) => "SAFE_KEY_" + (i + 1)),
  ...Array.from({ length: GENERIC_SLOTS.TOKEN }, (_, i) => "SAFE_TOKEN_" + (i + 1)),
  ...Array.from({ length: GENERIC_SLOTS.PASSWORD }, (_, i) => "SAFE_PASSWORD_" + (i + 1)),
  ...Array.from({ length: GENERIC_SLOTS.SECRET }, (_, i) => "SAFE_SECRET_" + (i + 1)),
]);

function cleanName(base) {
  return String(base ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^(\d)/, "_$1")
    .slice(0, 48);
}

/** `BRIGHTDATA_API_KEY` from `BRIGHTDATA_API_KEY=`, `X_API_KEY` from `x-api-key:`, `SAFE_KEY` from a bare `key:`. */
export function nameFromLabel(label) {
  const name = cleanName(label);
  if (!name) return "SAFE_KEY";
  const bare = /^(?:API_KEY|APIKEY|KEY|ACCESS_KEY|SECRET_KEY|TOKEN|ACCESS_TOKEN|AUTH_TOKEN|API_TOKEN|SECRET|CLIENT_SECRET|PASSWORD|PASSWD|PASSPHRASE|PWD|CREDENTIALS?|BEARER)$/;
  if (bare.test(name)) return "SAFE_" + kindOf(name);
  return name;
}

function kindOf(word) {
  const w = word.toUpperCase();
  if (/PASS/.test(w)) return "PASSWORD";
  if (/TOKEN|BEARER/.test(w)) return "TOKEN";
  if (/SECRET/.test(w)) return "SECRET";
  return "KEY";
}

/** A vendor named within `window` characters before `pos`, as a name prefix. */
function vendorBefore(text, pos, window = 120) {
  const before = text.slice(Math.max(0, pos - window), pos);
  for (const [re, vendor] of VENDORS) if (re.test(before)) return vendor;
  return undefined;
}

function contextName(text, pos, credWord) {
  const vendor = vendorBefore(text, pos);
  const kind = kindOf(credWord);
  if (vendor) return vendor + "_" + (kind === "KEY" ? "API_KEY" : kind);
  return "SAFE_" + kind;
}

// ---------------------------------------------------------------------------
// Detection.

/** True for text the engine wrote rather than the user: leave it untouched. */
export function isEngineMessage(text) {
  return ENGINE_MESSAGE.test(text);
}

/** Shannon entropy in bits per character. */
export function entropy(value) {
  const counts = new Map();
  for (const ch of value) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  let bits = 0;
  for (const n of counts.values()) {
    const p = n / value.length;
    bits -= p * Math.log2(p);
  }
  return bits;
}

/**
 * Whether a bare token with no known prefix looks like a credential rather than a
 * slug, a git SHA or a word. Tuned to leave article slugs and commit hashes alone.
 */
export function looksRandom(token) {
  if (ENGINE_ID_PREFIXES.test(token)) return false;
  if (NOT_A_VALUE.test(token)) return false;
  const hasLetter = /[A-Za-z]/.test(token);
  const hasDigit = /\d/.test(token);
  const hexOnly = /^[0-9a-f]+$/i.test(token);
  const separators = (token.match(/[-_]/g) ?? []).length;
  const bits = entropy(token);
  if (hexOnly) {
    // A 40 character lowercase hex token is a git commit hash, not a secret.
    if (token.length === 40 && token === token.toLowerCase()) return false;
    return token.length >= 32 && bits > 3.3;
  }
  if (!hasLetter || !hasDigit) return false;
  if (separators >= 2) return bits >= 4.6;
  return bits >= 4.0;
}

/** Whether a token near a credential word is plausibly the credential itself. */
function plausibleContextValue(token) {
  if (UUID.test(token)) return true;
  if (ENGINE_ID_PREFIXES.test(token) || NOT_A_VALUE.test(token)) return false;
  if (DATE_LIKE.test(token) || VERSION_LIKE.test(token)) return false;
  if (UPPER_IDENT.test(token) && (token.match(/\d/g) ?? []).length < 6) return false; // an env var NAME
  if (!/[A-Za-z]/.test(token) || !/\d/.test(token)) return false;
  if (/^[0-9a-f]{40}$/.test(token)) return false; // git SHA
  return true;
}

function spans(text, re) {
  const out = [];
  re.lastIndex = 0;
  let m;
  while ((m = re.exec(text)) !== null) out.push([m.index, m.index + m[0].length]);
  return out;
}

function inside(pos, ranges) {
  for (const [s, e] of ranges) if (pos >= s && pos < e) return true;
  return false;
}

/**
 * Every sensitive value in `text`, non-overlapping, in document order.
 * `knownOnly` keeps to rules 1 and 2 (shapes and labels): for tool output and
 * assistant text, where random-looking ids are everywhere.
 * @returns {Array<{start:number,end:number,value:string,name:string,rule:string}>}
 */
export function findSensitive(text, options = {}) {
  const hits = [];
  if (typeof text !== "string" || text.length < 8 || isEngineMessage(text)) return hits;
  const knownOnly = options.knownOnly === true;
  const pathAdjacent = (start, end) => /[\\/]/.test(text[start - 1] ?? "") || /[\\/]/.test(text[end] ?? "");
  const push = (start, end, name, rule) => {
    if (end - start < 8) return;
    const value = text.slice(start, end);
    if (NOT_A_VALUE.test(value)) return;
    if (rule !== "shape" && (BAD_VALUE_CHARS.test(value) || pathAdjacent(start, end))) return;
    for (const h of hits) if (start < h.end && end > h.start) return; // overlap: first wins
    hits.push({ start, end, value, name, rule });
  };

  for (const { re, name } of KNOWN) for (const [s, e] of spans(text, re)) push(s, e, name, "shape");

  let m;
  ASSIGNED.lastIndex = 0;
  while ((m = ASSIGNED.exec(text)) !== null) {
    const value = m[2];
    if (/^https?:\/\//i.test(value) && !/:\/\/[^/@\s]+:[^/@\s]+@/.test(value)) continue; // a URL, not a credential
    const start = m.index + m[0].length - value.length;
    push(start, start + value.length, nameFromLabel(m[1]), "label");
  }
  BEARER.lastIndex = 0;
  while ((m = BEARER.exec(text)) !== null) {
    const start = m.index + m[0].length - m[1].length;
    push(start, start + m[1].length, "SAFE_TOKEN", "bearer");
  }
  FLAG.lastIndex = 0;
  while ((m = FLAG.exec(text)) !== null) {
    const start = m.index + m[0].length - m[2].length;
    push(start, start + m[2].length, nameFromLabel(m[1]), "flag");
  }

  if (knownOnly) return hits.sort((a, b) => a.start - b.start);

  const urls = spans(text, URL_SPAN);

  CONTEXT_TOKEN.lastIndex = 0;
  while ((m = CONTEXT_TOKEN.exec(text)) !== null) {
    if (inside(m.index, urls)) continue;
    const token = m[0];
    if (!plausibleContextValue(token)) continue;
    const before = text.slice(Math.max(0, m.index - CONTEXT_WINDOW), m.index);
    const cred = before.match(CRED_WORD);
    if (!cred) continue;
    // The word must be the last credential word in the window, so the token follows it.
    const lastCred = [...before.matchAll(new RegExp(CRED_WORD.source, "gi"))].pop();
    push(m.index, m.index + token.length, contextName(text, m.index, lastCred?.[0] ?? cred[0]), "context");
  }

  CANDIDATE.lastIndex = 0;
  while ((m = CANDIDATE.exec(text)) !== null) {
    if (inside(m.index, urls)) continue;
    if (looksRandom(m[0])) push(m.index, m.index + m[0].length, vendorBefore(text, m.index) ? vendorBefore(text, m.index) + "_API_KEY" : "SAFE_KEY", "entropy");
  }

  return hits.sort((a, b) => a.start - b.start);
}

/** Rewrites `text` with every hit replaced by its placeholder from `vault`. */
export function redactText(text, vault, options = {}) {
  const hits = findSensitive(text, options);
  if (hits.length === 0) return { text, hits };
  let out = "";
  let last = 0;
  const source = options.source ?? "prompt";
  for (const h of hits) {
    out += text.slice(last, h.start) + vault.stash(h.value, h.name, source);
    last = h.end;
  }
  out += text.slice(last);
  return { text: out, hits };
}

/** Display only: stored values become their names; anything else that looks secret becomes [hidden]. */
export function forDisplay(text, vault, options = {}) {
  if (typeof text !== "string") return text;
  const scrubbed = vault.scrub(text);
  const hits = findSensitive(scrubbed, options);
  if (hits.length === 0) return scrubbed;
  let out = "";
  let last = 0;
  for (const h of hits) {
    out += scrubbed.slice(last, h.start) + HIDDEN;
    last = h.end;
  }
  return out + scrubbed.slice(last);
}

/** Applies `fn` to every string inside a JSON-like value, preserving structure. Returns the same object when nothing changed. */
export function mapStrings(value, fn) {
  if (typeof value === "string") return fn(value);
  if (Array.isArray(value)) {
    let changed = false;
    const next = value.map((item) => {
      const mapped = mapStrings(item, fn);
      if (mapped !== item) changed = true;
      return mapped;
    });
    return changed ? next : value;
  }
  if (value && typeof value === "object") {
    let changed = false;
    const next = {};
    for (const [k, v] of Object.entries(value)) {
      const mapped = mapStrings(v, fn);
      if (mapped !== v) changed = true;
      next[k] = mapped;
    }
    return changed ? next : value;
  }
  return value;
}

/**
 * Rewrites the blocks of one stored row (session.append's `message.content`): text blocks through
 * `cleanText`, a tool_result's string or text-block content through `cleanResult`. Returns the same
 * array when nothing changed; every block it does not author is kept by identity.
 */
export function rewriteContent(content, cleanText, cleanResult) {
  if (!Array.isArray(content)) return content;
  let changed = false;
  const out = content.map((block) => {
    if (!block || typeof block !== "object") return block;
    if (block.type === "text" && typeof block.text === "string") {
      const t = cleanText(block.text);
      if (t === block.text) return block;
      changed = true;
      return { ...block, text: t };
    }
    if (block.type === "tool_result") {
      if (typeof block.content === "string") {
        const t = cleanResult(block.content);
        if (t === block.content) return block;
        changed = true;
        return { ...block, content: t };
      }
      if (Array.isArray(block.content)) {
        let inner = false;
        const mapped = block.content.map((b) => {
          if (b && b.type === "text" && typeof b.text === "string") {
            const t = cleanResult(b.text);
            if (t !== b.text) {
              inner = true;
              return { ...b, text: t };
            }
          }
          return b;
        });
        if (!inner) return block;
        changed = true;
        return { ...block, content: mapped };
      }
    }
    return block;
  });
  return changed ? out : content;
}

/** The standing note the model reads: what a placeholder is and which are live. */
export function usageNote(placeholders) {
  const live = placeholders.length > 0 ? "Stored and usable now: " + placeholders.join(", ") + "." : "No key is stored yet.";
  return (
    "Safe Keys is active in this session. A credential the user pastes is stored outside the conversation and shown as an " +
    "environment-variable name such as $OPENROUTER_API_KEY or $SAFE_KEY_1. " + live + " " +
    "Use the name exactly as written wherever the value is needed. In a Bash or PowerShell command it is a real environment " +
    "variable (write it unquoted or in double quotes, never single quotes); in any other tool argument or file content the real " +
    "value is substituted at the moment the tool runs. Never ask the user to paste the value again, never guess it, never print it. " +
    "If a request using the name fails to authenticate, the key itself is wrong or expired; say so."
  );
}
