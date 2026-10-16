<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/logo-dark.png">
    <img alt="Safe Keys" src="assets/logo-light.png" width="480" height="114">
  </picture>
</p>

<h3 align="center">Paste an API key into Claude Code. Nothing keeps it.</h3>
<p align="center">Not the chat, not the transcript on disk, not the screen, not the model. Your tools still get to use it.</p>

<p align="center">
  <a href="https://club.reinventing.ai/safe-keys?utm_source=github&utm_medium=readme&utm_campaign=safe-keys&utm_content=nav-guide"><strong>Setup guide</strong></a>
  &nbsp;&bull;&nbsp;
  <a href="https://club.reinventing.ai/?utm_source=github&utm_medium=readme&utm_campaign=safe-keys&utm_content=nav-club"><strong>Agent Ops Club</strong></a>
  &nbsp;&bull;&nbsp;
  <a href="https://club.reinventing.ai/ai-employees?utm_source=github&utm_medium=readme&utm_campaign=safe-keys&utm_content=nav-employees"><strong>AI Employees</strong></a>
  &nbsp;&bull;&nbsp;
  <a href="https://club.reinventing.ai/events?utm_source=github&utm_medium=readme&utm_campaign=safe-keys&utm_content=nav-sessions"><strong>Live sessions</strong></a>
  &nbsp;&bull;&nbsp;
  <a href="https://club.reinventing.ai/faq?utm_source=github&utm_medium=readme&utm_campaign=safe-keys&utm_content=nav-faq"><strong>FAQ</strong></a>
</p>

<p align="center">
  <img alt="Stars" src="https://img.shields.io/github/stars/markfulton/safe-keys?style=flat-square&color=E3B341&logo=github&logoColor=white&label=Stars">
  <img alt="MIT license" src="https://img.shields.io/badge/License-MIT-3FB950?style=flat-square">
  <img alt="Claude Code mod" src="https://img.shields.io/badge/Claude_Code-mod-D97757?style=flat-square&logo=anthropic&logoColor=white">
  <img alt="Tested on Claude Code 2.1.299" src="https://img.shields.io/badge/Tested_on-2.1.299-2B2B2B?style=flat-square">
  <img alt="Windows, macOS and Linux" src="https://img.shields.io/badge/Windows_macOS_Linux-ready-2B2B2B?style=flat-square">
</p>

<p align="center">
  <a href="https://club.reinventing.ai/safe-keys?utm_source=github&utm_medium=readme&utm_campaign=safe-keys&utm_content=btn-guide"><img src="assets/btn-guide.png" width="211" height="60" alt="Get the Safe Keys setup guide, free"></a>
  <a href="https://club.reinventing.ai/register?utm_source=github&utm_medium=readme&utm_campaign=safe-keys&utm_content=btn-join"><img src="assets/btn-join.png" width="198" height="60" alt="Join the Agent Ops Club free"></a>
  <a href="https://club.reinventing.ai/events?utm_source=github&utm_medium=readme&utm_campaign=safe-keys&utm_content=btn-sessions"><img src="assets/btn-sessions.png" width="161" height="60" alt="Agent Ops Club live sessions"></a>
  <a href="https://club.reinventing.ai/?utm_source=github&utm_medium=readme&utm_campaign=safe-keys&utm_content=btn-club"><img src="assets/btn-club.png" width="184" height="60" alt="Visit the Agent Ops Club"></a>
</p>

<p align="center">
  <img src="assets/hero.jpg" width="900" alt="A brass key dissolving into a stream of blue characters that form a tag, drifting toward a laptop">
</p>

<p align="center">
  ⭐ <em>Found something useful? Star the repo. It takes a second and helps the next person find it.</em>
</p>

## Safe Keys

You are working with Claude Code. A service emails you a new API key. You paste it into the chat and say "set this". That key is now in the conversation, in the transcript file on your disk, on your screen, and in the model's context. It stays in that transcript for as long as the file exists.

Safe Keys is a Claude Code mod that catches the key the moment you submit it, stores it outside the conversation, and shows it everywhere as a name instead: `$OPENROUTER_API_KEY`, `$BRIGHTDATA_API_KEY`, `$SAFE_KEY_1`. When a tool needs the real value, it gets it, for that one command, and the output that comes back is cleaned before the model reads it.

A [mod](https://code.claude.com/docs/en/plugins/mods/overview) is a plugin whose code runs inside Claude Code itself, on events such as a submitted prompt, a tool call, or a row being drawn. That is what lets Safe Keys act before the key reaches the transcript, which no settings hook, skill or MCP server can do.

I built it after pasting a Bright Data key into my own session and watching the redactor I had at the time miss it. The miss is explained in [docs/DETAILS.md](docs/DETAILS.md), and the fix is the context rule in `lib/detect.js`.

Created by [Mark Fulton](https://www.reinventing.ai/?utm_source=github&utm_medium=readme&utm_campaign=safe-keys) of Reinventing.AI, founder of [Vibe Coding is Life](https://facebook.com/groups/vibecodinglife) (340,000+ members).

## Install

One line, at the prompt of a Claude Code session:

```text
/plugin install safe-keys --marketplace markfulton/safe-keys
```

Claude Code asks once whether to add the marketplace (`y`), then which scope to install at. Choose **Install for you**. The mod is active in that session from then on, and in every session after it.

From a shell, with no session open:

```bash
claude plugin install safe-keys --marketplace markfulton/safe-keys
```

In the Claude desktop app, where `/plugin` does not run: click **+** next to the prompt box, then **Plugins**, **Add marketplace** with `markfulton/safe-keys`, then **Add plugin** and pick Safe Keys.

To check it loaded, run `/plugin`. The dim line under the tabs reads `1 mod active · safe-keys`. Then paste a key and watch the row change to a name.

**You need** Claude Code 2.1.287 or newer in the terminal, or the desktop app from 2.1.286 (`/status` shows the version). Git fetches the marketplace. `node` on the PATH is needed for the on-disk pass; the in-memory layers run without it. If you set `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS` during the early access period, remove it: mods are on by default now and the setting does nothing.

Other ways to load it:

- **One session, from a clone**: `claude --plugin-dir /path/to/safe-keys`
- **Every session, without a marketplace**: `git clone https://github.com/markfulton/safe-keys ~/.claude/skills/safe-keys`. Claude Code loads any plugin folder it finds there.
- **Update**: `claude plugin update safe-keys@safe-keys`, then `/reload-plugins` or a new session.

### What it does on your machine, before you install it

A mod runs with your permissions, so read this part. `claude plugin validate` lists what Safe Keys hooks and calls without running it; this is what it reports and why:

| It does | Why |
|---|---|
| Hooks `prompt.edit`, `prompt.submit`, `session.append`, `tool.call`, `ui.render`, `turn.complete`, `session.start`, `session.end` | The places a key could land, listed under How it works |
| Writes environment variables under 69 fixed names (`OPENAI_API_KEY`, `GITHUB_TOKEN`, `SAFE_KEY_1` and the rest) | So a Bash or PowerShell command can use `$NAME` as a real variable and the value never enters the command text |
| Reads and writes files under `~/.claude` only | The diag log, the inbox file, and the transcript file it scrubs in place |
| Runs `node` with its own `scripts/scrub.mjs` | The on-disk pass over the two records that are not rows |
| Registers `/keys` (and `/safe-keys` where that name is free) | Status, scan, clean, forget |

It makes no network request, calls no model, and writes nothing to the plugin store. Every stored value lives in the mod's memory for the length of the session and in the process environment under its name, and nowhere else.

## How it works

<p align="center">
  <img src="assets/how-it-works.png" width="900" alt="You type a message with a key in it. The chat row, the model, the transcript on disk and the tool output all show $BRIGHTDATA_API_KEY. Only the tool, at the moment it runs, gets the real value.">
</p>

One paste, five places it would normally land, one place it actually does.

| Where a key could land | What Safe Keys does |
|---|---|
| The prompt box, on paste | Replaced before the text is queued or drawn |
| The message the model reads | Replaced before it enters the session |
| The transcript file on disk | Every stored row is rewritten before it is written. The two records that are not rows are overwritten in place a few seconds later |
| Bash and PowerShell commands | `$NAME` is a real environment variable, so the shell expands it and the command never carries the value |
| Every other tool | The value is substituted into the arguments at the moment the tool runs |
| Tool output coming back | Stored values become names again. A key a tool prints, from a `cat .env` say, is stored and named too |
| The screen | Every drawn row is scrubbed on the terminal, the desktop app, VS Code and mobile |

The detector knows 38 key shapes by name (OpenAI, Anthropic, GitHub, Stripe, Supabase, AWS and the rest), reads labels like `BRIGHTDATA_API_KEY=` and `Authorization: Bearer`, and catches a bare UUID when a word like "key" or "token" sits near it, which is the case every entropy test misses. It leaves dates, versions, git SHAs, file paths and URLs alone.

### Where it runs

| Where you run Claude Code | Safe Keys |
|---|---|
| `claude` in a terminal, including an editor's terminal | Yes |
| The Code tab of the Claude desktop app | Yes |
| The VS Code extension | Yes |
| `claude -p` and the Agent SDK | Yes, the hooks run; nothing is drawn |
| Cowork and claude.ai chat | No. Mods run in Claude Code only |

<table>
<tr><td align="center" width="900">

<h2>Get the setup guide and the clean-up walkthrough, free</h2>

<p>The guide takes you through the install, the first test paste, and the part most people skip: finding and overwriting the keys already sitting in your old transcripts, with the exact prompts to paste. A free Agent Ops Club account, no card.</p>

<a href="https://club.reinventing.ai/safe-keys?utm_source=github&utm_medium=readme&utm_campaign=safe-keys&utm_content=cta-guide"><img src="assets/btn-guide.png" width="211" height="60" alt="Get the Safe Keys setup guide, free"></a>

</td></tr>
</table>

## Using it

Paste a key the way you always did. The session confirms the name in one line, and the model uses the name:

```bash
curl -s https://openrouter.ai/api/v1/key -H "Authorization: Bearer $OPENROUTER_API_KEY"
```

- `/keys` shows what is stored this session (names only), where the transcript and the log are.
- `/keys scan` dry-runs every transcript on your machine and counts what it finds, by record type.
- `/keys clean` overwrites those spans in place with a same-length marker, so every file stays valid and every session still resumes.
- `/keys forget` empties the vault for the rest of the session.
- Drop a key in `~/.claude/safe-keys-inbox.txt`, one per line, and it is stored on your next message without touching the chat at all.

`~/.claude/safe-keys-diag.log` records which hooks fired and what each did, never a value.

## What it does not do

- A key typed character by character is caught at submit, not while typing.
- Inside single quotes no shell expands a variable, so there the value itself goes in. Double quotes are the clean path.
- Detection is heuristic. A low-entropy custom secret with no label and no credential word near it is not caught. Use the inbox for those.
- The mods API can change between Claude Code releases. `claude plugin validate` tells you before a session does, and the diag log says what a build could not do.

The full design, every rule and every exclusion, with the tests that hold them, is in [docs/DETAILS.md](docs/DETAILS.md). Verify it yourself:

```bash
node lib/detect.unit.mjs
claude plugin validate .
claude plugin test .
```

Built and tested on Claude Code 2.1.299, terminal and desktop. The engine tests in `hooks/safe-keys.test.ts` run against Claude Code itself with no session and no network.

## License

MIT. Built by Mark Fulton at [Reinventing.AI](https://www.reinventing.ai/?utm_source=github&utm_medium=readme&utm_campaign=safe-keys). Safe Keys is one of the free tools in the [Agent Ops Club](https://club.reinventing.ai/?utm_source=github&utm_medium=readme&utm_campaign=safe-keys&utm_content=footer), alongside the open source [AI Employees](https://github.com/markfulton/ai-employees). Shared as is, under the MIT license; it is not an Anthropic product.
