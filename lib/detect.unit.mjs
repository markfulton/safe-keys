// Plain-Node unit tests for lib/detect.js:  node lib/detect.unit.mjs
// Synthetic fixtures only: the shapes match real key formats, none of the values is a real credential.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Vault, findSensitive, redactText, forDisplay, mapStrings, rewriteContent, usageNote, nameFromLabel, looksRandom, looksBase64Secret, HIDDEN, ENV_VOCABULARY } from "./detect.js";

let passed = 0;
function check(name, fn) {
  try {
    fn();
    passed++;
  } catch (err) {
    console.error("FAIL " + name + "\n  " + (err?.message ?? err));
    process.exitCode = 1;
  }
}
const names = (text, opts) => findSensitive(text, opts).map((h) => h.name);
const caught = (text, opts) => findSensitive(text, opts).length > 0;

const UUID = randomUUID();
const OR = "sk-or-v1-" + (["012345678", "9abcdef"].join("")).repeat(4);
const OR2 = "sk-or-v1-" + (["fedcba987", "6543210"].join("")).repeat(4);
// Fixtures are assembled from short pieces so no source line holds a key-shaped run (GitHub push protection reads blobs).
const GH = "ghp_" + (["A1b2C3d4E", "5f6G7h8I9", "j0"].join("")) + (["K1l2M3n4O", "5p6Q7r8S9", "t0"].join(""));
const ANT = (["sk-ant-ap", "i03-"].join("")) + (["Zz9Yy8Xx7", "Ww6Vv5Uu4", "Tt3Ss2Rr1", "Qq0Pp"].join(""));
const RANDOM32 = (["q7Zp2mK9x", "V4bN8wL3r", "T6yH1cJ5d", "F0gS2"].join(""));

// --- The 2026-10-08 failure, in shape -------------------------------------------------------------
check("bare uuid after 'key is' in prose is caught (the Bright Data miss)", () => {
  assert.deepEqual(names(`yes run the verification call once the new key is ${UUID} please set it yourself`), ["SAFE_KEY"]);
});
check("a vendor named earlier in the message names the key", () => {
  assert.deepEqual(names(`I got an alert from Bright Data. The new key is ${UUID}, set it`), ["BRIGHTDATA_API_KEY"]);
});
check("prefixed env assignment in a pasted terminal line", () => {
  assert.deepEqual(names(`PS> supabase secrets set BRIGHTDATA_API_KEY=${UUID} --project-ref sipqqdrmuubixmwmzxcg`), ["BRIGHTDATA_API_KEY"]);
});
check("the project ref beside it is left alone", () => {
  const hits = findSensitive(`supabase secrets set BRIGHTDATA_API_KEY=${UUID} --project-ref sipqqdrmuubixmwmzxcg`);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].value, UUID);
});

// --- UUIDs that are ids, not keys ------------------------------------------------------------------
check("a uuid with no credential word nearby is an id", () => {
  assert.equal(caught(`open session ${UUID} and look at the third turn`), false);
});
check("a uuid in tool output under knownOnly is an id", () => {
  assert.equal(caught(`key is ${UUID}`, { knownOnly: true }), false);
});
check("a credential word far before the token does not count", () => {
  assert.equal(caught(`the api key was rotated yesterday and the long story is that the new deployment ran on ${UUID}`), false);
});

// --- Known shapes -----------------------------------------------------------------------------------
check("known shapes name themselves", () => {
  assert.deepEqual(names(`a ${OR} b ${GH} c ${ANT}`), ["OPENROUTER_API_KEY", "GITHUB_TOKEN", "ANTHROPIC_API_KEY"]);
  assert.deepEqual(names("sk_live_" + (["a1B2c3D4e", "5F6g7H8i9", "J0"].join(""))), ["STRIPE_SECRET_KEY"]);
  assert.deepEqual(names(["AKIA", "IOSFODNN7EXAMPLE"].join("")), ["AWS_ACCESS_KEY_ID"]);
  assert.deepEqual(names("AIza" + (["SyA1b2C3d", "4E5f6G7h8", "I9j0K1l2M", "3n4O5p6"].join(""))), ["GOOGLE_API_KEY"]);
  assert.deepEqual(names(["ey", "", "JhbGciOiJ", "IUzI1NiJ9", ".", "ey", "", "JzdWIiOiI", "xMjM0NTY3", "ODkwIn0", "."].join("") + (["dozjgNryP", "4J3jVmNHl", "0w5N_XgL0", "n3I9PlFUP", "0THsR8U"].join(""))), ["JWT"]);
  assert.deepEqual(names("postgresql://app:" + (["s3cretPas", "sw0rd"].join("")) + "@db.example.com:5432/prod"), ["DATABASE_URL"]);
});
check("a PEM block is one hit", () => {
  const pem = ["-----", "BEGIN PRIV", "ATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7\nabc\n-----END PRIV", "ATE KEY-----"].join("");
  const hits = findSensitive("here " + pem + " end");
  assert.equal(hits.length, 1);
  assert.equal(hits[0].name, "PRIVATE_KEY");
  assert.equal(hits[0].value, pem);
});
check("known shapes still fire under knownOnly", () => {
  assert.deepEqual(names(`key ${OR}`, { knownOnly: true }), ["OPENROUTER_API_KEY"]);
});

// --- Labels -----------------------------------------------------------------------------------------
check("JSON and header labels", () => {
  assert.deepEqual(names(`{"api_key": "${["abcd1234e", "fgh5678"].join("")}"}`), ["SAFE_KEY"]);
  assert.deepEqual(names(`-H "x-api-key: ${["abcd1234e", "fgh5678ij", "kl"].join("")}"`), ["X_API_KEY"]);
  assert.deepEqual(names(`Authorization: Bearer ${["abcd1234e", "fgh5678ij", "kl"].join("")}`), ["SAFE_TOKEN"]);
  assert.deepEqual(names(`OPENAI_API_KEY=${["abcdefghi", "jklmnop12", "3"].join("")}`), ["OPENAI_API_KEY"]);
  assert.deepEqual(names(`password: ${["hunter2hu", "nter2"].join("")}`), ["SAFE_PASSWORD"]);
  assert.deepEqual(names(`--token ${["abcdef123", "456789xyz"].join("")}`), ["SAFE_TOKEN"]);
});
check("an empty assignment never takes the next line as its value (the 2026-10-29 .env.example miss)", () => {
  const example = [
    "RESEND_API_KEY=",
    "EMAIL_FROM=Mark <mark@example.com>",
    "# Falls back to RESEND_API_KEY. Set RESEND_AUDIENCE_SYNC=off to skip the",
    "# Contacts call.",
    "RESEND_AUDIENCE_API_KEY=",
    "RESEND_AUDIENCE_SYNC=",
    "META_ADS_ACCESS_TOKEN=",
    "  ",
    "--api-key",
    "next-line-is-not-a-flag-value",
    "Authorization: Bearer",
    "then run the nightly sync",
  ].join("\n");
  for (const opts of [{ knownOnly: true }, {}]) assert.deepEqual(findSensitive(example, opts).map((h) => h.value), [], JSON.stringify(opts));
  const v = new Vault();
  assert.equal(redactText(example, v, { knownOnly: true, source: "output" }).text, example, "a cat of the file comes back unchanged");
  assert.equal(v.size, 0, "nothing is stored, so no name shadows the real variable in a shell");
  assert.equal(findSensitive("RESEND_API_KEY=\nRESEND_AUDIENCE_API_KEY=" + UUID, { knownOnly: true })[0].value, UUID, "a value on its own line is still caught");
});
check("labels under knownOnly (a cat of .env in tool output)", () => {
  assert.deepEqual(names(`BRIGHTDATA_API_KEY=${UUID}\nBRIGHTDATA_ZONE=pouncedrops`, { knownOnly: true }), ["BRIGHTDATA_API_KEY"]);
});
check("nameFromLabel", () => {
  assert.equal(nameFromLabel("my-service.api_key"), "MY_SERVICE_API_KEY");
  assert.equal(nameFromLabel("bearer"), "SAFE_TOKEN");
  assert.equal(nameFromLabel("password"), "SAFE_PASSWORD");
  assert.equal(nameFromLabel("client_secret"), "SAFE_SECRET");
});

// --- Things that must be left alone ----------------------------------------------------------------
check("placeholders, redactions and example values are not values", () => {
  assert.equal(caught("token: $OPENROUTER_API_KEY"), false);
  assert.equal(caught("token: ${OPENROUTER_API_KEY}"), false);
  assert.equal(caught("API_KEY=<redacted>"), false);
  assert.equal(caught("API_KEY=your_key_here"), false);
  assert.equal(caught("API_KEY=[hidden]*****************"), false);
  assert.equal(caught("password: xxxxxxxxxxxx"), false);
});
check("dates, versions, env names, git shas and engine ids near a credential word", () => {
  assert.equal(caught("the key was rotated on 2026-10-08T11:48:08"), false);
  assert.equal(caught("the token in version v2.1.286-beta broke"), false);
  assert.equal(caught("set the key BRIGHTDATA_API_KEY in the dashboard"), false);
  assert.equal(caught(["the key landed in commit ", "09519e7a1", "b2c3d4e5f", "60718293a", "4b5c6d7e8", "f901", ""].join("")), false);
  assert.equal(caught(["the token call ", "toolu_01J", "AqQVLipnd", "ptz5tGDcJ", "1NZ", " failed"].join("")), false);
});
check("URLs are not credentials", () => {
  assert.equal(caught(["the key page is https://dash.example.com/keys/", "abcd1234e", "fgh5678ij", "kl9", ""].join("")), false);
  assert.equal(caught("token_url: https://example.com/oauth/token"), false);
});
check("engine-authored messages are untouched", () => {
  assert.equal(caught(`<system-reminder>the key is ${UUID}</system-reminder>`), false);
});
check("slugs and prose are not random", () => {
  assert.equal(looksRandom("agent-ops-club-landing-page-refresh"), false);
  assert.equal(looksRandom((["09519e7a1", "b2c3d4e5f", "60718293a", "4b5c6d7e8", "f901"].join(""))), false);
  assert.equal(looksRandom(RANDOM32), true);
});
check("a bare high-entropy token in a prompt is caught, in tool output it is not", () => {
  assert.deepEqual(names(`here ${RANDOM32} thanks`), ["SAFE_KEY"]);
  assert.equal(caught(`here ${RANDOM32} thanks`, { knownOnly: true }), false);
});

check("path segments, code literals and templates near a credential word are not values", () => {
  assert.equal(caught(String.raw`the key lives in C:\Users\x\bundled-skills\2.1.286\9fdaad0b080c82c8760768b595ae4932\plugin-authoring`), false);
  assert.equal(caught(["api key cache at /tmp/claude/", "9fdaad0b0", "80c82c876", "0768b595a", "e4932", "/types"].join("")), false);
  assert.equal(caught(String.raw`const ASSIGNED_SECRET = /\b(?:api[_-]?key|token)\b/gi;`), false);
  assert.equal(caught("function looksRandom(token: string): boolean"), false);
  assert.equal(caught("the plain env assignment: `API_KEY=\${uuid}`"), false);
  assert.equal(caught(String.raw`content: "OPENROUTER_API_KEY=$OPENROUTER_API_KEY\n"`), false);
  assert.equal(caught("const CONTEXT_TOKEN = /[A-Za-z0-9][A-Za-z0-9_-]{14,}/g;"), false);
  assert.equal(caught('return plain ? "WEBHOOK_SECRET" : "STRIPE_WEBHOOK_SECRET";', { knownOnly: true }), false, "an env name after a label is a name");
  assert.equal(caught(["password: ", "HUNTER2HU", "NTER2X"].join("")), true, "an all-caps value without underscores is still a value");
});

// --- The 2026-10-29 failure: base64 secrets came apart at + / = ------------------------------------
// Svix-style (Resend) webhook secret: whsec_ plus 32 base64 characters with a `+` in the middle.
const WHSEC_PLUS = ["whsec_", "Ab3dEf9hI", "j2kLmN", "+", "Qr5tUv8xY", "z1aBcDe"].join("");
const WHSEC_SLASH_PAD = ["whsec_", "Mf4Kq9r8G", "/Yq2Tw7jU", "+PD8ILPZ", "Io2La=="].join("");
const WHSEC_STRIPE = ["whsec_", "a1B2c3D4e", "5F6g7H8i9", "J0k1L2m3N", "4o5"].join("");
const B64_ALL = ["Zm9vYmFy", "+Qk1", "/xY2pL", "m8nO3qR", "4sT6uV", "=="].join("");
const B64_SLASH = ["Kx7Qm2Vp9", "Zr4", "/", "Tb6Nw1Ly8", "Hd3Fj5Gs0", "Ac"].join("");
const B64_PAD = ["Q2xhdWRl", "U2FmZUtl", "eXMxMjM0", "NTY3OA="].join("");
const fragments = (value) => value.split(/[+/=]+/).filter((p) => p.length >= 4);

check("a Resend whsec_ secret with a + is stored whole and named by the vendor (the 2026-10-29 miss)", () => {
  const v = new Vault();
  const r = redactText("here is the Resend webhook signing secret " + WHSEC_PLUS + " please set it", v);
  assert.equal(r.text, "here is the Resend webhook signing secret $RESEND_WEBHOOK_SECRET please set it");
  assert.equal(r.hits.length, 1);
  assert.equal(v.valueFor("RESEND_WEBHOOK_SECRET"), WHSEC_PLUS, "the full value is stored, not the tail after +");
  assert.doesNotMatch(r.text, /whsec_/);
  for (const piece of fragments(WHSEC_PLUS.slice(6))) assert.ok(!r.text.includes(piece), "no piece left: " + piece);
});
check("whsec_ with /, + and = padding is one value, also under knownOnly", () => {
  for (const opts of [{}, { knownOnly: true }]) {
    const hits = findSensitive("signing: " + WHSEC_SLASH_PAD + " done", opts);
    assert.equal(hits.length, 1);
    assert.equal(hits[0].value, WHSEC_SLASH_PAD);
    assert.equal(hits[0].name, "WEBHOOK_SECRET");
  }
});
check("a Stripe whsec_ (letters and digits) keeps its name", () => {
  assert.deepEqual(names("the endpoint secret " + WHSEC_STRIPE), ["STRIPE_WEBHOOK_SECRET"]);
  assert.equal(findSensitive(WHSEC_STRIPE)[0].value, WHSEC_STRIPE);
});
check("bare base64 secrets with +, / and = are one value each", () => {
  for (const value of [B64_ALL, B64_SLASH, B64_PAD]) {
    const v = new Vault();
    const r = redactText("the new key is " + value + " thanks", v);
    assert.equal(r.text, "the new key is $SAFE_KEY_1 thanks", value.length + " chars");
    assert.equal(v.valueFor("SAFE_KEY_1"), value);
    for (const piece of fragments(value)) assert.ok(!r.text.includes(piece), "no piece left: " + piece);
  }
  assert.deepEqual(names("pasting " + B64_ALL), ["SAFE_KEY"], "no credential word needed when + and padding are there");
  assert.deepEqual(names("my resend key " + B64_ALL), ["RESEND_API_KEY"]);
});
check("a base64 value after a label keeps its + / =", () => {
  assert.equal(findSensitive("SIGNING_SECRET=" + B64_ALL, { knownOnly: true })[0].value, B64_ALL);
  assert.equal(findSensitive("Authorization: Bearer " + B64_ALL)[0].value, B64_ALL);
});
check("paths and name lists joined by / or + are not base64 secrets", () => {
  for (const s of ["src/components/Header2/index", "apps/web/src/app/Page1Layout", "Desktop/Agent2Ops/README", "images/2026/Hero1Banner/v2", "origin/main2/Branch/x", "Claude+Codex+Cursor2+Antigravity", "TCP/IP/UDP/HTTP2/QUIC3/Stuff"]) {
    assert.equal(looksBase64Secret(s), false, s);
    assert.equal(caught("the key file is in " + s + " now"), false, s);
  }
  assert.equal(caught("the stripe key page is dashboard.stripe.com/" + B64_SLASH.replace("/", "")), false, "a link without its scheme");
});

// --- The 2026-10-29 fal.ai failure: a colon-joined key came apart -------------------------------------
// fal.ai keys are `<key id uuid>:<key secret, 32 hex>`; the colon split them into two names, or left the id raw.
const FAL = UUID + ":" + ["9f86d081", "884c7d65", "9a2feaa0", "c55ad015"].join("");
const PAIR = ["Ab3dEf9h", "Ij2k"].join("") + ":" + RANDOM32;

check("a fal.ai key is one value, in every way it gets pasted", () => {
  for (const t of [`here is my fal key ${FAL} thanks`, `FAL_KEY=${FAL}`, `${FAL}`, `use this ${FAL} for the video`, `Authorization: Key ${FAL}`]) {
    const v = new Vault();
    const r = redactText(t, v);
    assert.equal(r.hits.length, 1, t.length + " chars: one hit");
    assert.equal(v.valueFor("FAL_KEY"), FAL, "the full id:secret is stored");
    assert.ok(!r.text.includes(UUID) && !r.text.includes(FAL.slice(37)), "neither half is left in the text");
    assert.match(r.text, /\$FAL_KEY(?![A-Za-z0-9_:])/);
  }
  assert.deepEqual(names(`cat .env printed FAL_KEY=${FAL}`, { knownOnly: true }), ["FAL_KEY"], "also in tool output");
});
check("any id:secret pair with no space is one value", () => {
  const v = new Vault();
  const r = redactText("the new token is " + PAIR + " for the api", v);
  assert.equal(r.text, "the new token is $SAFE_TOKEN_1 for the api");
  assert.equal(v.valueFor("SAFE_TOKEN_1"), PAIR);
  assert.deepEqual(names("pasting " + PAIR), ["SAFE_KEY"]);
});
check("colon-joined things that are not credentials are left alone", () => {
  for (const s of [
    "the key server is api.internal.example:8443 now",
    "the token sync ran at 2026-10-29T10:30:00 and again at 11:45",
    "key point: remember the nightly sync",
    "the token call toolu_" + ["01JAqQVLi", "pndptz5tG"].join("") + ":failedWithTimeoutError",
    "git checkout feature-branch-2026:origin-main-backup-01",
    "C:" + String.raw`\Users\murve\key-store\file`,
  ]) assert.equal(caught(s), false, s);
});

// --- Vault ------------------------------------------------------------------------------------------
check("vault names, numbering, restore and scrub", () => {
  const v = new Vault();
  let r = redactText("here is my key " + OR + " thanks", v);
  assert.equal(r.text, "here is my key $OPENROUTER_API_KEY thanks");
  r = redactText("second one " + OR2, v);
  assert.equal(r.text, "second one $OPENROUTER_API_KEY_2");
  r = redactText("and github " + GH, v);
  assert.equal(r.text, "and github $GITHUB_TOKEN");
  assert.equal(v.restore("auth $OPENROUTER_API_KEY"), "auth " + OR);
  assert.equal(v.restore("auth ${OPENROUTER_API_KEY}"), "auth " + OR);
  assert.equal(v.restore("auth $OPENROUTER_API_KEY_2"), "auth " + OR2);
  assert.equal(v.restore("$OPENROUTER_API_KEYS"), "$OPENROUTER_API_KEYS");
  assert.equal(v.scrub("leaked " + OR + " and " + GH), "leaked $OPENROUTER_API_KEY and $GITHUB_TOKEN");
  assert.equal(redactText("again " + OR, v).text, "again $OPENROUTER_API_KEY");
  assert.equal(v.size, 3);
});
check("generic finds take numbered literal slots", () => {
  const v = new Vault();
  assert.equal(redactText(`key is ${UUID}`, v).text, "key is $SAFE_KEY_1");
  assert.equal(redactText(["password: ", "hunter2hu", "nter2", ""].join(""), v).text, "password: $SAFE_PASSWORD_1");
  assert.equal(redactText(`token ${randomUUID()}`, v).text, "token $SAFE_TOKEN_1");
  assert.equal(v.envNameFor("SAFE_KEY_1"), "SAFE_KEY_1");
  for (const n of v.names()) assert.ok(ENV_VOCABULARY.has(v.envNameFor(n)), n + " has a literal env name");
});
check("a label name outside the vocabulary gets a literal env alias", () => {
  const v = new Vault();
  redactText(["MYSERVICE_TOKEN=", "abcdefghi", "jklmnop12", "3", ""].join(""), v);
  assert.equal(v.names()[0], "MYSERVICE_TOKEN");
  assert.equal(v.envNameFor("MYSERVICE_TOKEN"), "SAFE_KEY_1");
  assert.equal(v.restoreForShell("echo $MYSERVICE_TOKEN", "bash"), "echo $SAFE_KEY_1");
});
check("shell forms: bash keeps the variable, single quotes get the value, powershell gets $env:", () => {
  const v = new Vault();
  redactText("key " + OR, v);
  assert.equal(v.restoreForShell('curl -H "Authorization: Bearer $OPENROUTER_API_KEY"', "bash"), 'curl -H "Authorization: Bearer $OPENROUTER_API_KEY"');
  assert.equal(v.restoreForShell("echo ${OPENROUTER_API_KEY}", "bash"), "echo ${OPENROUTER_API_KEY}");
  assert.equal(v.restoreForShell("printf '%s' '$OPENROUTER_API_KEY'", "bash"), "printf '%s' '" + OR + "'");
  assert.equal(v.restoreForShell('$h = @{ Authorization = "Bearer $OPENROUTER_API_KEY" }', "powershell"), '$h = @{ Authorization = "Bearer $env:OPENROUTER_API_KEY" }');
  assert.equal(v.restoreForShell("no placeholder here", "bash"), "no placeholder here");
});
check("a value a tool printed is masked but never exported; a pasted one is", () => {
  const v = new Vault();
  const GL = "glpat-" + (["Ab12Cd34E", "f56Gh78Ij", "90Kl"].join(""));
  redactText("cat .env printed GITLAB_TOKEN=" + GL, v, { knownOnly: true, source: "output" });
  assert.equal(v.isExported("GITLAB_TOKEN"), false, "output-sourced values are not exported");
  assert.equal(v.restoreForShell('curl -H "Authorization: Bearer $GITLAB_TOKEN"', "bash"), 'curl -H "Authorization: Bearer ' + GL + '"', "a shell gets the value textually when nothing was exported");
  redactText("here is my gitlab token " + GL, v);
  assert.equal(v.isExported("GITLAB_TOKEN"), true, "the same value pasted by the user becomes exportable");
  assert.equal(v.restoreForShell('curl -H "Authorization: Bearer $GITLAB_TOKEN"', "bash"), 'curl -H "Authorization: Bearer $GITLAB_TOKEN"');
});

check("restoreValues: value positions only, prose keeps the name", () => {
  const v = new Vault();
  const ST = "sk_live_" + (["a1B2c3D4e", "5F6g7H8i9", "J0"].join(""));
  redactText("stripe " + ST, v);
  assert.equal(v.restoreValues("STRIPE_SECRET_KEY=$STRIPE_SECRET_KEY\n"), "STRIPE_SECRET_KEY=" + ST + "\n", ".env line");
  assert.equal(v.restoreValues('{ "key": "$STRIPE_SECRET_KEY" }'), '{ "key": "' + ST + '" }', "JSON field");
  assert.equal(v.restoreValues("secret: ${STRIPE_SECRET_KEY}"), "secret: " + ST, "YAML field, braces form");
  assert.equal(v.restoreValues("Authorization: Bearer $STRIPE_SECRET_KEY"), "Authorization: Bearer " + ST, "bearer");
  assert.equal(v.restoreValues("--api-key $STRIPE_SECRET_KEY"), "--api-key " + ST, "flag");
  assert.equal(v.restoreValues("$STRIPE_SECRET_KEY"), ST, "the whole argument");
  assert.equal(v.restoreValues("The chat shows the key as $STRIPE_SECRET_KEY and the model uses that name."), "The chat shows the key as $STRIPE_SECRET_KEY and the model uses that name.", "prose is untouched");
  assert.equal(v.restoreValues(["such as $STRIPE_SECRET_KEY or ", "abcd1234e", "fgh5678", ""].join("")), ["such as $STRIPE_SECRET_KEY or ", "abcd1234e", "fgh5678", ""].join(""), "a list in prose is untouched");
  assert.equal(v.restoreValues("$STRIPE_SECRET_KEYS=1"), "$STRIPE_SECRET_KEYS=1", "a longer identifier is left alone");
});

check("scrub catches the JSON-escaped and URL-encoded forms", () => {
  const v = new Vault();
  const pem = ["-----", "BEGIN PRIV", "ATE KEY-----\nabc/def+ghi==\n-----END PRIV", "ATE KEY-----"].join("");
  v.stash(pem, "PRIVATE_KEY");
  v.stash("p@ss w0rd!!", "SAFE_PASSWORD");
  assert.equal(v.scrub(JSON.stringify({ k: pem })), '{"k":"$PRIVATE_KEY"}');
  assert.equal(v.scrub("https://u:" + encodeURIComponent("p@ss w0rd!!") + "@h/"), ["https://u:", "$SAFE_PASSWORD_1", "@h/"].join(""));
});
check("mapStrings keeps structure and identity", () => {
  const v = new Vault();
  redactText("key " + OR, v);
  const obj = { a: ["x", OR], b: { c: GH, d: 5 } };
  assert.deepEqual(mapStrings(obj, (s) => v.scrub(s)), { a: ["x", "$OPENROUTER_API_KEY"], b: { c: GH, d: 5 } });
  assert.equal(mapStrings(obj, (s) => s), obj);
});
check("forDisplay: stored values become names, unknown secrets become hidden", () => {
  const v = new Vault();
  redactText("key " + OR, v);
  assert.equal(forDisplay("mine " + OR + [" theirs AKIA", "ABCDEFGHIJKLMNOP"].join(""), v), "mine $OPENROUTER_API_KEY theirs " + HIDDEN);
});
check("usage note lists live names and never the old word", () => {
  assert.match(usageNote([]), /No key is stored yet/);
  assert.match(usageNote(["$OPENROUTER_API_KEY"]), /Stored and usable now: \$OPENROUTER_API_KEY\./);
  assert.doesNotMatch(usageNote(["$X"]), /SECRET_\d/);
});
check("forget empties the vault", () => {
  const v = new Vault();
  redactText("key " + OR, v);
  v.forget();
  assert.equal(v.size, 0);
  assert.equal(v.scrub(OR), OR);
});

// --- Stored rows (what session.append hands the plugin) ---------------------------------------
check("rewriteContent: a prompt row, a tool_result string and tool_result blocks; pinned blocks kept by identity", () => {
  const v = new Vault();
  const full = (s) => redactText(v.scrub(s), v).text;
  const known = (s) => redactText(v.scrub(s), v, { knownOnly: true }).text;
  const thinking = { type: "thinking", thinking: "..." };
  const toolUse = { type: "tool_use", id: "toolu_01", name: "Bash", input: { command: "cat .env" } };
  const row = [thinking, { type: "text", text: "my github token is " + GH }, toolUse];
  const out = rewriteContent(row, full, known);
  assert.notEqual(out, row);
  assert.equal(out[0], thinking, "thinking block kept by identity");
  assert.equal(out[2], toolUse, "tool_use block kept by identity");
  assert.equal(out[1].text, "my github token is $GITHUB_TOKEN");
  const tr = [{ type: "tool_result", tool_use_id: "toolu_01", content: "OPENROUTER_API_KEY=" + OR + "\nX=1" }];
  assert.equal(rewriteContent(tr, full, known)[0].content, "OPENROUTER_API_KEY=$OPENROUTER_API_KEY\nX=1");
  const trb = [{ type: "tool_result", tool_use_id: "toolu_02", content: [{ type: "text", text: "key " + OR }, { type: "image", source: {} }] }];
  const outb = rewriteContent(trb, full, known);
  assert.equal(outb[0].content[0].text, "key $OPENROUTER_API_KEY");
  assert.equal(outb[0].content[1], trb[0].content[1], "media block kept by identity");
  const clean = [{ type: "text", text: "nothing here" }];
  assert.equal(rewriteContent(clean, full, known), clean, "unchanged rows return the same array");
  assert.equal(rewriteContent("not an array", full, known), "not an array");
});

console.log(process.exitCode ? "detect.unit.mjs: FAILURES above, " + passed + " passed" : "detect.unit.mjs: all " + passed + " checks passed");
