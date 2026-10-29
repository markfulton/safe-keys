# Changelog

## 1.1.3 (2026-10-29)

- A fal.ai key (`<key id>:<key secret>`) is stored whole as `$FAL_KEY`. It was cut at the colon into two names, and pasted bare or as `FAL_KEY=` the key id half stayed in the transcript. The shape is known, so it is caught in tool output too.
- Any `<id>:<secret>` pair with no space in something you typed is one value when the secret half looks random. Hosts and ports, times, `key point:` prose, engine ids and Windows paths are left alone.
- Tests: 42 unit checks, 7 engine tests.

## 1.1.2 (2026-10-29)

- A base64 secret is stored whole. A Resend webhook signing secret (`whsec_` plus base64) with a `+` in it was cut at the `+`: only the tail was stored and the head stayed in the transcript. `whsec_` now takes the full base64 alphabet and its padding, and a bare base64 run in something you typed is kept as one value, `+`, `/` and trailing `=` included. File paths and `this+that` lists stay untouched.
- A `whsec_` secret is named after the vendor named before it (`$RESEND_WEBHOOK_SECRET`), `$STRIPE_WEBHOOK_SECRET` when it is letters and digits only, and `STRIPE_WEBHOOK_SECRET` otherwise, so a Resend secret no longer takes over the Stripe variable.
- An environment-variable name in a value position (`cond ? "WEBHOOK_SECRET" : "STRIPE_WEBHOOK_SECRET"` in code a tool printed) is no longer stored as a credential.
- An empty assignment (`RESEND_API_KEY=` in a `.env.example`) no longer takes the next line as its value. The label, bearer and flag rules stop at the end of the line, so a `cat` or `sed` of an example file comes back unchanged and no bogus name shadows the real variable in a shell.
- Tests: 39 unit checks, 6 engine tests.

## 1.1.1 (2026-10-16)

- `PRIVACY.md`: what the mod reads, stores and sends (nothing leaves your computer), linked from the manifest as `privacyPolicyUrl`; the MIT license is linked as `termsOfServiceUrl`. Both show on the directory listing.
- Test fixtures are built from array joins and the custom-alias check uses an echo form, so the directory's secret scanner, which folds string concatenation, reads no fixture as a credential.

## 1.1.0 (2026-10-16)

Safe Keys is a Claude Code mod, and this release packages it as one.

- Install from the repository in one line: `/plugin install safe-keys --marketplace markfulton/safe-keys`. The repository now carries `.claude-plugin/marketplace.json`, so `claude plugin install` and the desktop app's plugin browser both find it, and `claude plugin update safe-keys@safe-keys` brings later releases.
- The manifest carries the display name, homepage, repository, license, keywords, icon and support link that marketplaces and Anthropic's directory read.
- `/keys` is registered in every install. `/safe-keys` is registered too where that name is free (a marketplace install), so the command no longer depends on how the mod was loaded.
- The `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS` step is gone from every document: mods are on by default from Claude Code 2.1.287 (the desktop app from 2.1.286) and the setting is ignored.
- README, SKILL.md and the docs say "mod" where they said "plugin", list what the mod does on your machine before you install it (what `claude plugin validate` reports), and say where it runs.
- Tested on Claude Code 2.1.299: 32 unit checks, 5 engine tests.

## 1.0.0 (2026-10-09)

First release under the Safe Keys name. Successor to the private `transcript-redactor` plugin (0.1.0 live, 0.2.0 staged and never loadable).

- Detection: a credential word near a token now catches UUID-shaped keys, which the entropy test could never see (the 2026-10-08 Bright Data miss). Prefixed labels (`BRIGHTDATA_API_KEY=`), header labels, flags and bearer tokens are caught. Thirty-eight known key shapes name themselves. Dates, versions, git SHAs, engine ids, path segments, URLs, code literals and placeholders are excluded by name.
- Placeholders are environment-variable names (`$OPENROUTER_API_KEY`, `$SAFE_KEY_1`), never `<SECRET_n>`.
- New layer: `session.append` rewrites every stored row (prompt, response, tool result, notice, subagent rows) before it is written.
- New layer: `prompt.edit` replaces a pasted key in the composer before it is queued or drawn.
- Tools: Bash and PowerShell get stored names as real environment variables (literal names, exported through the engine), so no value enters a shell command or the permission classifier; other tools get textual substitution.
- Disk: `scripts/scrub.mjs` overwrites in place with same-length markers, covers `queue-operation` and `last-prompt` records as well as rows, detects over decoded JSON strings, and has a prompts-only mode for the live pass and a stats mode for review.
- `/keys status | scan | clean | forget` (the plugin asks for `/safe-keys` first and takes `/keys` when the skill of the same name already owns it).
- Diagnostics at `~/.claude/safe-keys-diag.log`, never a value.
- Tests: 30 unit checks over the detector; five engine tests through `claude plugin test` on the terminal and desktop surfaces.
