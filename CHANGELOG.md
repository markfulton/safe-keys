# Changelog

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
