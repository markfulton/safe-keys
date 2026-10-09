// Plain-Node unit tests for lib/detect.js:  node lib/detect.unit.mjs
// Synthetic fixtures only: the shapes match real key formats, none of the values is a real credential.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Vault, findSensitive, redactText, forDisplay, mapStrings, rewriteContent, usageNote, nameFromLabel, looksRandom, HIDDEN, ENV_VOCABULARY } from "./detect.js";

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
const OR = "sk-or-v1-" + "0123456789abcdef".repeat(4);
const OR2 = "sk-or-v1-" + "fedcba9876543210".repeat(4);
// Fixtures are assembled from short pieces so no source line holds a key-shaped run (GitHub push protection reads blobs).
const GH = "ghp_" + "A1b2C3d4E5f6G7h8I9j0" + "K1l2M3n4O5p6Q7r8S9t0";
const ANT = "sk-ant-api03-" + "Zz9Yy8Xx7Ww6Vv5Uu4Tt3Ss2Rr1Qq0Pp";
const RANDOM32 = "q7Zp2mK9xV4bN8wL3rT6yH1cJ5dF0gS2";

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
  assert.deepEqual(names("sk_live_" + "a1B2c3D4e5F6g7H8i9J0"), ["STRIPE_SECRET_KEY"]);
  assert.deepEqual(names("AKIA" + "IOSFODNN7EXAMPLE"), ["AWS_ACCESS_KEY_ID"]);
  assert.deepEqual(names("AIza" + "SyA1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6"), ["GOOGLE_API_KEY"]);
  assert.deepEqual(names("eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U"), ["JWT"]);
  assert.deepEqual(names("postgresql://app:s3cretPassw0rd@db.example.com:5432/prod"), ["DATABASE_URL"]);
});
check("a PEM block is one hit", () => {
  const pem = "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7\nabc\n-----END PRIVATE KEY-----";
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
  assert.deepEqual(names(`{"api_key": "abcd1234efgh5678"}`), ["SAFE_KEY"]);
  assert.deepEqual(names(`-H "x-api-key: abcd1234efgh5678ijkl"`), ["X_API_KEY"]);
  assert.deepEqual(names(`Authorization: Bearer abcd1234efgh5678ijkl`), ["SAFE_TOKEN"]);
  assert.deepEqual(names(`OPENAI_API_KEY=abcdefghijklmnop123`), ["OPENAI_API_KEY"]);
  assert.deepEqual(names(`password: hunter2hunter2`), ["SAFE_PASSWORD"]);
  assert.deepEqual(names(`--token abcdef123456789xyz`), ["SAFE_TOKEN"]);
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
  assert.equal(caught("the key landed in commit 09519e7a1b2c3d4e5f60718293a4b5c6d7e8f901"), false);
  assert.equal(caught("the token call toolu_01JAqQVLipndptz5tGDcJ1NZ failed"), false);
});
check("URLs are not credentials", () => {
  assert.equal(caught("the key page is https://dash.example.com/keys/abcd1234efgh5678ijkl9"), false);
  assert.equal(caught("token_url: https://example.com/oauth/token"), false);
});
check("engine-authored messages are untouched", () => {
  assert.equal(caught(`<system-reminder>the key is ${UUID}</system-reminder>`), false);
});
check("slugs and prose are not random", () => {
  assert.equal(looksRandom("agent-ops-club-landing-page-refresh"), false);
  assert.equal(looksRandom("09519e7a1b2c3d4e5f60718293a4b5c6d7e8f901"), false);
  assert.equal(looksRandom(RANDOM32), true);
});
check("a bare high-entropy token in a prompt is caught, in tool output it is not", () => {
  assert.deepEqual(names(`here ${RANDOM32} thanks`), ["SAFE_KEY"]);
  assert.equal(caught(`here ${RANDOM32} thanks`, { knownOnly: true }), false);
});

check("path segments, code literals and templates near a credential word are not values", () => {
  assert.equal(caught(String.raw`the key lives in C:\Users\x\bundled-skills\2.1.286\9fdaad0b080c82c8760768b595ae4932\plugin-authoring`), false);
  assert.equal(caught("api key cache at /tmp/claude/9fdaad0b080c82c8760768b595ae4932/types"), false);
  assert.equal(caught(String.raw`const ASSIGNED_SECRET = /\b(?:api[_-]?key|token)\b/gi;`), false);
  assert.equal(caught("function looksRandom(token: string): boolean"), false);
  assert.equal(caught("the plain env assignment: `API_KEY=\${uuid}`"), false);
  assert.equal(caught(String.raw`content: "OPENROUTER_API_KEY=$OPENROUTER_API_KEY\n"`), false);
  assert.equal(caught("const CONTEXT_TOKEN = /[A-Za-z0-9][A-Za-z0-9_-]{14,}/g;"), false);
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
  assert.equal(redactText("password: hunter2hunter2", v).text, "password: $SAFE_PASSWORD_1");
  assert.equal(redactText(`token ${randomUUID()}`, v).text, "token $SAFE_TOKEN_1");
  assert.equal(v.envNameFor("SAFE_KEY_1"), "SAFE_KEY_1");
  for (const n of v.names()) assert.ok(ENV_VOCABULARY.has(v.envNameFor(n)), n + " has a literal env name");
});
check("a label name outside the vocabulary gets a literal env alias", () => {
  const v = new Vault();
  redactText("MYSERVICE_TOKEN=abcdefghijklmnop123", v);
  assert.equal(v.names()[0], "MYSERVICE_TOKEN");
  assert.equal(v.envNameFor("MYSERVICE_TOKEN"), "SAFE_KEY_1");
  assert.equal(v.restoreForShell('curl -H "Authorization: Bearer $MYSERVICE_TOKEN"', "bash"), 'curl -H "Authorization: Bearer $SAFE_KEY_1"');
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
  const GL = "glpat-" + "Ab12Cd34Ef56Gh78Ij90Kl";
  redactText("cat .env printed GITLAB_TOKEN=" + GL, v, { knownOnly: true, source: "output" });
  assert.equal(v.isExported("GITLAB_TOKEN"), false, "output-sourced values are not exported");
  assert.equal(v.restoreForShell('curl -H "Authorization: Bearer $GITLAB_TOKEN"', "bash"), 'curl -H "Authorization: Bearer ' + GL + '"', "a shell gets the value textually when nothing was exported");
  redactText("here is my gitlab token " + GL, v);
  assert.equal(v.isExported("GITLAB_TOKEN"), true, "the same value pasted by the user becomes exportable");
  assert.equal(v.restoreForShell('curl -H "Authorization: Bearer $GITLAB_TOKEN"', "bash"), 'curl -H "Authorization: Bearer $GITLAB_TOKEN"');
});

check("restoreValues: value positions only, prose keeps the name", () => {
  const v = new Vault();
  const ST = "sk_live_" + "a1B2c3D4e5F6g7H8i9J0";
  redactText("stripe " + ST, v);
  assert.equal(v.restoreValues("STRIPE_SECRET_KEY=$STRIPE_SECRET_KEY\n"), "STRIPE_SECRET_KEY=" + ST + "\n", ".env line");
  assert.equal(v.restoreValues('{ "key": "$STRIPE_SECRET_KEY" }'), '{ "key": "' + ST + '" }', "JSON field");
  assert.equal(v.restoreValues("secret: ${STRIPE_SECRET_KEY}"), "secret: " + ST, "YAML field, braces form");
  assert.equal(v.restoreValues("Authorization: Bearer $STRIPE_SECRET_KEY"), "Authorization: Bearer " + ST, "bearer");
  assert.equal(v.restoreValues("--api-key $STRIPE_SECRET_KEY"), "--api-key " + ST, "flag");
  assert.equal(v.restoreValues("$STRIPE_SECRET_KEY"), ST, "the whole argument");
  assert.equal(v.restoreValues("The chat shows the key as $STRIPE_SECRET_KEY and the model uses that name."), "The chat shows the key as $STRIPE_SECRET_KEY and the model uses that name.", "prose is untouched");
  assert.equal(v.restoreValues("such as $STRIPE_SECRET_KEY or abcd1234efgh5678"), "such as $STRIPE_SECRET_KEY or abcd1234efgh5678", "a list in prose is untouched");
  assert.equal(v.restoreValues("$STRIPE_SECRET_KEYS=1"), "$STRIPE_SECRET_KEYS=1", "a longer identifier is left alone");
});

check("scrub catches the JSON-escaped and URL-encoded forms", () => {
  const v = new Vault();
  const pem = "-----BEGIN PRIVATE KEY-----\nabc/def+ghi==\n-----END PRIVATE KEY-----";
  v.stash(pem, "PRIVATE_KEY");
  v.stash("p@ss w0rd!!", "SAFE_PASSWORD");
  assert.equal(v.scrub(JSON.stringify({ k: pem })), '{"k":"$PRIVATE_KEY"}');
  assert.equal(v.scrub("https://u:" + encodeURIComponent("p@ss w0rd!!") + "@h/"), "https://u:$SAFE_PASSWORD_1@h/");
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
  assert.equal(forDisplay("mine " + OR + " theirs AKIA" + "ABCDEFGHIJKLMNOP", v), "mine $OPENROUTER_API_KEY theirs " + HIDDEN);
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
