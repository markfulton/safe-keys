# Live checks

What the unit and engine tests cannot prove: that the hooks fire on the surface you actually use, that the engine's environment reaches the Bash tool's child, and that the transcript on disk ends up clean. Run these in a real session after installing. Every value below is synthetic.

## Install for every session

```powershell
New-Item -ItemType Junction -Path "$env:USERPROFILE\.claude\skills\safe-keys" -Target "D:\safe-keys"
```

A junction makes the repo the live copy: edits hot-reload in the next session, git tracks everything. (`git clone` into that path works the same for anyone else.)

## 1. A pasted key

Paste this line as a message, nothing else:

```
my openrouter key is sk-or-v1-0123456789abcdef...
```

Type the block `0123456789abcdef` four times after the prefix, 64 characters in all. The line is cut here so this file never holds a key-shaped string.

```
(the full line, as above)
```

Expect, in this order:

- the row on screen reads `my openrouter key is $OPENROUTER_API_KEY`
- a one-line notice: `safe-keys: stored $OPENROUTER_API_KEY (prompt)`
- the assistant answers using the name and never the value
- `~/.claude/safe-keys-diag.log` gained lines for `prompt.submit` (and `prompt.edit fires on this surface` if the composer layer is live on that app)
- a scan of the live transcript reports 0:

```bash
node D:/safe-keys/scripts/scrub.mjs --file "<transcript path from /safe-keys>" --prompts-only --dry-run
```

## 2. The shell gets a real variable

Ask: "run `printf '%s' \"$OPENROUTER_API_KEY\" | wc -c` in Bash".

Expect `70` (the synthetic key's length), the tool row showing the name and not the value, and a diag line `tool.call Bash: resolved stored name(s) as environment variables`. If the count is `0`, the environment did not reach the child: the diag log will say `env: $.env.set unavailable`, and the textual path is what the session is on.

## 3. A key that arrives through a tool

Create a throwaway file: ask the assistant to write `GH_TEST=ghp_` followed by `A1b2C3d4E5f6G7h8I9j0` and `K1l2M3n4O5p6Q7r8S9t0`, joined with no space into `D:\safe-keys\scratch.env` and then `cat` it.

Expect the tool result row to show `GH_TEST=$GITHUB_TOKEN`, a notice `safe-keys: stored $GITHUB_TOKEN (tool.call Bash result)`, and the transcript scan still at 0. Delete the file afterwards.

## 4. The inbox

Put the line `AKIA` + `IOSFODNN7EXAMPLE` (joined, no space) in `~/.claude/safe-keys-inbox.txt`, send any message. Expect the notice `stored $AWS_ACCESS_KEY_ID (inbox)` and the file emptied.

## 5. History

```
/keys scan
```

Read the counts by record type, then `/keys clean` when you are satisfied. The pass overwrites in place with same-length markers, so every transcript stays valid JSONL and resumes.

## Reading the diag log

```bash
tail -40 ~/.claude/safe-keys-diag.log
```

Every hook that fired is a line; no line ever carries a value or a placeholder's contents. `prompt.edit fires on this surface` appearing once means the composer layer is live on that app; its absence means the desktop composer does not raise it and the prompt layer is the first line.
