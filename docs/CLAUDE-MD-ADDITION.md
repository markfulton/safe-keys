# Paste this into `~/.claude/CLAUDE.md`, under `## Secrets`

A session is refused the right to write credential-usage guidance into the global CLAUDE.md itself (the auto-mode classifier reads it as an agent teaching future sessions to use stored credentials), so this paragraph is yours to add by hand. Replace the old `transcript-redactor` paragraph if one is there.

---

**Pasted keys are stored, not lost.** The `safe-keys` plugin (repo `D:\safe-keys`, loaded from `~/.claude/skills/safe-keys`) stores any key Mark pastes outside the conversation and shows it as an environment-variable name: `$OPENROUTER_API_KEY`, `$BRIGHTDATA_API_KEY`, `$SAFE_KEY_1`. Use the name verbatim like a shell variable in any tool call: in Bash and PowerShell it is a real environment variable (double quotes, never single), elsewhere the plugin substitutes the value when the tool runs. Never ask him to paste it again, never print it. A key that shows up in a tool result (a `cat .env`) is stored the same way and its name is announced. If a raw key is ever visible in chat, the plugin is not working: say so, point at `/keys` and `~/.claude/safe-keys-diag.log`, and ask him to rotate it. Details in that repo's `SKILL.md`; the engine's validator is `claude plugin validate D:/safe-keys` and its tests `claude plugin test D:/safe-keys`.
