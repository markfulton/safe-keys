# Safe Keys: build plan and acceptance bar

Started 2026-10-09. Successor to the `transcript-redactor` plugin (v0.1 live, v0.2 staged and never loadable).

## Why the old one failed on 2026-10-08

1. A UUID-shaped key (Bright Data, Twilio, Notion, Kie and many others) can never pass the entropy test: hex plus dash tops out at 4.09 bits per character, below the 4.6 threshold for tokens with separators. The live detector had no other rule that fired on "the new key is <uuid>".
2. The staged v0.2 fixed prefixed labels (`BRIGHTDATA_API_KEY=`) but was never installed, and it fails the engine's own validator (`$.env.get` with a computed name), so it could not have loaded.
3. The disk pass only rewrote `queue-operation` records. `user` and `last-prompt` records were never touched.

## Layers (each tested on its own)

| Layer | Hook | Closes |
|---|---|---|
| Composer | `prompt.edit` | a pasted key before it is queued or drawn |
| Prompt | `prompt.submit` | the message the model and the transcript receive |
| Every stored row | `session.append` | prompts, responses, tool results, notices, subagent rows |
| Tool arguments | `tool.call` | `$NAME` resolved as an environment variable for Bash and PowerShell, textual elsewhere |
| Tool results | `tool.call`, `session.append` | stored values and new keys a tool prints |
| Screen | `ui.render` | every drawn component, every surface |
| Disk | `scripts/scrub.mjs` | queue records, last-prompt records, older sessions; same-length in-place |
| Model awareness | `prompt.submit` context, `SKILL.md` | the model knows what a placeholder is and how to use it |

## Acceptance bar (all must hold before any release)

- Unit tests (`node --experimental-strip-types lib/detect.unit.mjs`): every fixture in `lib/detect.unit.mjs` caught or left alone as listed, including the 2026-10-08 Bright Data case verbatim in shape.
- `claude plugin validate D:/safe-keys` passes.
- `claude plugin test D:/safe-keys` passes on terminal and desktop surfaces (session.append is covered by the unit layer: an engine append cannot be bottomed by a test hook).
- Live, in a desktop session: a synthetic key pasted in chat is shown as a name on screen, reaches the model as a name, appears nowhere raw in the transcript file (`scrub.mjs --file <transcript> --dry-run` reports 0), and a Bash command using the name authenticates.
- Live, a `cat` of a file holding a synthetic key stores it and shows the name.
- Diag log at `~/.claude/safe-keys-diag.log` lists every hook that fired, with no value.
- History cleanup: `scrub.mjs --all` leaves 0 known-shape hits across `~/.claude/projects`.

## Time box

Phase 1 (code, unit tests, validator): one session, 2026-10-09.
Phase 2 (engine tests, live load through hot reload, this session): same day.
Phase 3 (run clean for several days of real sessions, diag reviewed): before any public release.
