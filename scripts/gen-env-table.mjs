// Rewrites the GENERATED ENV TABLE section of hooks/safe-keys.ts: one literal `$.env.set("NAME", value)`
// call per name the vault can export. The engine requires a string literal there and refuses `$`
// passed across an import, so the table lives in the hooks module itself.
//   node scripts/gen-env-table.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { ENV_VOCABULARY } from "../lib/detect.js";

const names = Array.from(ENV_VOCABULARY);
const q = (s) => JSON.stringify(s);
const body = [
  "// BEGIN GENERATED ENV TABLE (scripts/gen-env-table.mjs, from lib/detect.js ENV_VOCABULARY; do not edit by hand)",
  "const ENV_NAMES: readonly string[] = " + JSON.stringify(names) + ";",
  "",
  "/** Sets `name` in the engine process (and every tool it starts after). False when the name is not in the table. */",
  "async function envSet($: Engine, name: string, value: string): Promise<boolean> {",
  "  switch (name) {",
  ...names.map((n) => "    case " + q(n) + ": await $.env.set(" + q(n) + ", value); return true;"),
  "    default: return false;",
  "  }",
  "}",
  "",
  "/** Reads `name` from the engine process. Undefined when unset or not in the table. */",
  "async function envGet($: Engine, name: string): Promise<string | undefined> {",
  "  switch (name) {",
  ...names.map((n) => "    case " + q(n) + ": return $.env.get(" + q(n) + ");"),
  "    default: return undefined;",
  "  }",
  "}",
  "",
  "/** The marker listing the names Safe Keys exported, so a reload re-imports only those. */",
  "async function markerGet($: Engine): Promise<string | undefined> { return $.env.get(\"SAFE_KEYS_EXPORTED\"); }",
  "async function markerSet($: Engine, value: string): Promise<void> { await $.env.set(\"SAFE_KEYS_EXPORTED\", value); }",
  "// END GENERATED ENV TABLE",
].join("\n");

const target = join(dirname(fileURLToPath(import.meta.url)), "..", "hooks", "safe-keys.ts");
const src = readFileSync(target, "utf8");
const re = /\/\/ BEGIN GENERATED ENV TABLE[\s\S]*?\/\/ END GENERATED ENV TABLE/;
if (!re.test(src)) throw new Error("markers not found in " + target);
writeFileSync(target, src.replace(re, body));
console.log("rewrote the env table in " + target + " with " + names.length + " names");
