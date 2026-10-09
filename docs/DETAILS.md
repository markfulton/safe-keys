# Safe Keys

A Claude Code plugin that keeps the API keys you paste out of the conversation, the transcript on disk, the screen and the model, while your tools can still use them.

Paste a key into the chat and it is stored outside the conversation the moment it is submitted. Everywhere you and the model look, it reads as an environment-variable name: `$OPENROUTER_API_KEY`, `$BRIGHTDATA_API_KEY`, `$SAFE_KEY_1`. Bash and PowerShell commands get the name as a real environment variable, every other tool gets the value substituted at the moment it runs, and anything a tool prints back is scrubbed before the model reads it.

## What it protects

| Where a key could land | What Safe Keys does |
|---|---|
| The prompt box, on paste | Replaced before the text is queued or drawn (`prompt.edit`) |
| The message the model reads | Replaced before it enters the session (`prompt.submit`) |
| The transcript file | Every stored row is rewritten before it is written (`session.append`); the two records that are not rows (the queue entry and the last-prompt entry) are overwritten in place by `scripts/scrub.mjs` right after the prompt, again a few seconds later, at each turn's end and at session end |
| Tool arguments | `$NAME` becomes a real environment variable for Bash and PowerShell, so the shell expands it and the permission classifier never sees a value; other tools get the value substituted textually |
| Tool output | Stored values are replaced by their names; a key a tool surfaces (a `cat .env`) is stored and replaced the same way, and the model is told the name |
| The screen | Every drawn row is scrubbed on every surface (terminal, desktop app, VS Code, mobile); anything that merely looks secret in a user row shows as `[hidden]` |
| Older sessions | `/keys scan` dry-runs every transcript on the machine; `/keys clean` overwrites in place |

Real values live only in the plugin's memory for the length of the session, plus the engine process environment under the names it exported, which is what lets a hot reload of the plugin pick them up again. Nothing is written to `$.store`, `$.state` or any file.

## What it detects

1. **Known key shapes**, which name themselves: Anthropic, OpenAI, OpenRouter, GitHub, GitLab, AWS, Google, Slack, Stripe, Resend, Supabase, Apify, Hugging Face, npm, DigitalOcean, Linear, Notion, Groq, Perplexity, Replicate, Fly, SendGrid, Mailgun, Twilio, Telegram, Doppler, PyPI, Vercel, JWTs, PEM private keys, connection strings that carry a password.
2. **A credential label, then the value**: `BRIGHTDATA_API_KEY=...`, `x-api-key: ...`, `"token": "..."`, `--password ...`, `Authorization: Bearer ...`. The label names the key.
3. **A credential word nearby, then a token**: "the new key is 3f9a1c2e-7b4d-...". This is what catches UUID-shaped keys (Bright Data, Twilio, Notion and many more), which no entropy test can see: a UUID tops out at 4.09 bits per character. A vendor named earlier in the message names the key.
4. **A bare high-entropy token** in something you typed.

Rules 3 and 4 run only on text you typed. Tool output and the model's own text get rules 1 and 2, so the ids that fill a `git log` or a JSON response are never touched. Dates, versions, git SHAs, engine ids, path segments, URLs, code literals and placeholders are excluded by name.

## Install

Function hooks are an early-access surface of Claude Code (2.1.286 at the time of writing). Turn them on once in `~/.claude/settings.json`:

```json
{ "env": { "CLAUDE_CODE_ENABLE_FUNCTION_HOOKS": "1" } }
```

Then put the plugin where Claude Code loads skills-folder plugins from. Any of these works:

```bash
git clone https://github.com/reinventingai/safe-keys ~/.claude/skills/safe-keys
```

```bash
claude --plugin-dir /path/to/safe-keys
```

For a session the desktop app starts, name the folder in `CLAUDE_CODE_PLUGIN_DIRS` inside the same `env` block.

Check it before the first session:

```bash
claude plugin validate /path/to/safe-keys
```

`node` on the PATH is needed for the on-disk pass; without it the in-memory layers still run and the plugin says so in its log.

## Use

Paste a key the way you always did. The row on screen shows the name, the session confirms it in one line, and the model uses the name:

```bash
curl -s https://openrouter.ai/api/v1/key -H "Authorization: Bearer $OPENROUTER_API_KEY"
```

Write the name unquoted or in double quotes in a shell command. Inside single quotes no shell expands a variable, so there Safe Keys puts the value itself in.

- `/keys` shows what is stored this session (names only), where the transcript and the log are.
- `/keys scan` dry-runs every transcript under `~/.claude/projects` and reports counts by record type.
- `/keys clean` overwrites those spans in place with a same-length `[hidden]***` marker, so the files stay valid and sessions still resume.
- `/keys forget` empties the vault for the rest of the session.
- Drop a key in `~/.claude/safe-keys-inbox.txt` (one per line) and it is stored on your next message without ever touching the chat.

`~/.claude/safe-keys-diag.log` lists every hook that fired and what it did, and never a value. Read it when something seems not to work.

## Verify it yourself

```bash
node lib/detect.unit.mjs
claude plugin validate .
claude plugin test .
```

The unit tests cover every rule and every exclusion with synthetic values. The engine tests run the plugin's hooks against Claude Code itself on the terminal and desktop surfaces: a pasted key reaching the bottom as a name, a stored row with no value in it, a shell command resolved both ways, a tool result scrubbed with a new key stored, and a drawn row with nothing to see.

## Limits, stated plainly

- A key typed character by character is caught at submit, not while typing.
- A heredoc with a quoted delimiter (`<<'EOF'`) does not expand variables; write `$NAME` in double quotes or outside the heredoc.
- The permission classifier in auto mode sees the arguments of non-shell tools after substitution. Shell commands are the safe path; that is why names, not values, go into them.
- Detection is heuristic. A low-entropy custom secret with no label and no credential word near it is not caught. Use the inbox for those.
- Function hooks are early access and the contract may change between Claude Code releases. `claude plugin validate` tells you before a session does.

## License

MIT. Built by Mark Fulton at [Reinventing.AI](https://www.reinventing.ai).
