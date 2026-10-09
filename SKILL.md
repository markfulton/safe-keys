---
name: safe-keys
description: Stored credentials. When the user pastes an API key, token or password it is stored outside the conversation and appears as an environment-variable name ($OPENROUTER_API_KEY, $BRIGHTDATA_API_KEY, $SAFE_KEY_1). Read this when such a name appears, when a tool needs a credential the user already pasted, or when a key shows up in a tool result. Use the name exactly as written like a shell variable; never ask for the value again, never print it.
---

# Stored credentials: how to use a pasted key

The Safe Keys plugin runs in every session. Three things hold:

1. **A pasted key never enters the transcript.** The moment the user submits a message containing a credential, the value is stored in the plugin's memory and the message you read carries a name instead: `$OPENROUTER_API_KEY`, `$ANTHROPIC_API_KEY`, `$GITHUB_TOKEN`, `$STRIPE_SECRET_KEY`, `$BRIGHTDATA_API_KEY`, or `$SAFE_KEY_1` when the shape is not recognised. A second key of the same kind becomes `$OPENROUTER_API_KEY_2`.

2. **The name works everywhere a value would.** In a Bash or PowerShell command it is a real environment variable: write it unquoted or in double quotes and the shell expands it. In any other tool argument or file content, the plugin substitutes the real value at the moment the tool runs. Both of these work as written:

   ```bash
   curl -s https://openrouter.ai/api/v1/key -H "Authorization: Bearer $OPENROUTER_API_KEY"
   ```

   ```bash
   printf 'OPENROUTER_API_KEY=%s\n' "$OPENROUTER_API_KEY" >> .env.local
   ```

   `${OPENROUTER_API_KEY}` is accepted too. Avoid single quotes around a name in a shell command; if you must use them the plugin puts the value in for you, but double quotes are the clean path.

3. **A value that comes back is scrubbed before you read it.** If a tool prints a stored value (a `cat .env`, an echo, an API error that reflects the header), the result shows the name again. If a tool surfaces a key the user never pasted, the plugin stores that one too and tells you its name in the result.

## What to do when you see a name

- Use it. Do not ask the user to paste the key again; they already did.
- Do not guess, reconstruct or print the value. `echo $OPENROUTER_API_KEY` in a shell prints the real value into a tool result, which is then scrubbed back to the name; you learn nothing and the user sees nothing. Do not try.
- If a request using the name fails with an authentication error, the key itself is wrong or expired. Say so and let the user decide.
- When names first appear, confirm to the user in one short line which are stored.
- If the user pastes a key in chat and you see the raw value, the plugin is not loaded or not working: tell the user plainly, point them at `/keys` and `~/.claude/safe-keys-diag.log`, and do not use the value until they have rotated it.

## For the user, two conveniences

- A key dropped into `~/.claude/safe-keys-inbox.txt` (one per line) is picked up on the next message and the file is emptied, so the value never touches the chat at all.
- `/keys` shows the stored names; `/keys scan` and `/keys clean` find and overwrite credentials in older transcripts.
