# Safe Keys privacy policy

Last updated 2026-10-16. This policy covers the Safe Keys mod for Claude Code, published by Mark Fulton (Reinventing.AI) at https://github.com/markfulton/safe-keys.

## The short version

Safe Keys runs entirely on your computer. It collects nothing, sends nothing anywhere, and has no server. The only data it handles is the credentials you paste into Claude Code, and it handles them so that they leave your session with less exposure than they would have had without it.

## What the mod reads

- **The text you submit to Claude Code**, so it can find a pasted API key, token or password before the text is stored or sent to the model.
- **The arguments and results of tool calls**, so it can put a stored value into a command that needs it and take the value back out of what the tool prints.
- **The rows Claude Code writes to the session transcript**, so it can rewrite a row that would otherwise hold a value.
- **Its own files under `~/.claude`**: the inbox file `safe-keys-inbox.txt`, the diagnostic log `safe-keys-diag.log`, and the transcript file of the running session.

It does not read your other files, your browser, your clipboard or anything outside the session, and it does not look for names, email addresses or other personal data.

## What the mod stores

- **Stored values live in the mod's memory for the length of the session**, and in the environment of the Claude Code process under a fixed name such as `OPENROUTER_API_KEY`, so that a shell command can use the variable. They are gone when the session ends.
- **The diagnostic log** at `~/.claude/safe-keys-diag.log` records which hooks fired and what each one did. It never holds a value, a fragment of a value, or the contents of your prompts.
- **Nothing is written** to Claude Code's plugin store, to any file other than the two named above, or to any database.

The on-disk pass (`scripts/scrub.mjs`) edits transcript files that already exist on your computer, replacing a credential with a same-length marker. It creates no copy and keeps no record of what it replaced.

## What the mod sends

Nothing. Safe Keys makes no network request, calls no model, and has no telemetry. There is no account, no sign-up and no server on the publisher's side. You can confirm this without running it: `claude plugin validate` lists every call the mod makes, and the list contains no `$.http` call.

## Third parties

None. Safe Keys sends no data to Anthropic, to Reinventing.AI or to anyone else. The credentials it handles are sent only where Claude Code would have sent them anyway, by the tool you asked to use them, for that one call.

## Your choices

- Uninstall the mod at any time with `/plugin` in Claude Code or `claude plugin uninstall safe-keys@safe-keys`. Nothing of it remains except the diagnostic log, which you can delete.
- Run `/keys forget` to empty the stored values for the rest of a session.
- Read every line before you load it. The code is MIT licensed and the whole of it is in the repository.

## Changes and contact

Changes to this policy are made in this file, in the repository, with the date above updated. Questions go to https://github.com/markfulton/safe-keys/issues or to the publisher through https://club.reinventing.ai.
