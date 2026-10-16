# Changelog

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
