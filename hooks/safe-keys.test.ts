// Engine tests for Safe Keys:  claude plugin test D:/safe-keys
// The kit loads this plugin and hands each test the engine's own `$`; the hooks `on` registers here
// sit beneath the plugin and stand for the engine. Synthetic values only.
import { test, expect, mock } from "claude-code/testing";

declare const h: any;

/** The engine's own drawing of a row: the text it was handed. The plugin rewrites props above this. */
function drawText(on: any) {
  on("ui.render", ($: any, e: any) => {
    const { Text } = $.ui.resolve(e);
    const p = e.props ?? {};
    const s = typeof p.text === "string" ? p.text : JSON.stringify({ input: p.input, output: p.output });
    return h(Text, null, s);
  });
}

const OR = "sk-or-v1-" + "0123456789abcdef".repeat(4);
const GH = "ghp_" + "A1b2C3d4E5f6G7h8I9j0" + "K1l2M3n4O5p6Q7r8S9t0";
const UUID = "3f9a1c2e-7b4d-4e8f-9a6b-1c2d3e4f5a6b";
const composer = { kind: "composer" } as const;

test("prompt.submit: a pasted key reaches the bottom as a name, with the usage note", async ($, on) => {
  mock.clock(on);
  let arrived: any;
  on("prompt.submit", ($, e) => {
    arrived = e;
    return { text: e.text, context: e.context };
  });
  const r: any = await $.prompt.submit({ text: "use this key " + OR + " for the call", wait: false, origin: composer });
  expect(arrived.text).toBe("use this key $OPENROUTER_API_KEY for the call");
  expect(arrived.text).not.toContain(OR);
  expect((arrived.context ?? []).join("\n")).toContain("$OPENROUTER_API_KEY");
  expect(r.text).not.toContain(OR);
});

test("prompt.submit: the Bright Data shape, a uuid after 'key is'", async ($, on) => {
  mock.clock(on);
  let arrived: any;
  on("prompt.submit", ($, e) => {
    arrived = e;
    return { text: e.text, context: e.context };
  });
  await $.prompt.submit({ text: "yes run the verification call once the new key is " + UUID + " please set it yourself", wait: false, origin: composer });
  expect(arrived.text).not.toContain(UUID);
  expect(arrived.text).toMatch(/\$SAFE_KEY_\d/);
});

// session.append has no engine test here: an append the engine makes is never answered by a hook (a hook that
// answers without next is skipped, by the engine's rule), and the kit has no store beneath it. The row rewrite is
// a pure function, rewriteContent in lib/detect.js, covered by lib/detect.unit.mjs; the live proof is a transcript
// scan after a synthetic paste (docs/PLAN.md).

test("tool.call: names resolve for the tool, values and new keys never reach the model", async ($, on) => {
  mock.clock(on);
  let seen: any;
  on("tool.call", ($, e: any) => {
    seen = e;
    const out = typeof e.command === "string" ? e.command : typeof e.content === "string" ? e.content : "";
    return { result: { stdout: out + "\nALSO=" + GH, stderr: "", interrupted: false }, text: out, isReadOnly: true } as any;
  });
  // Store a key first, the way a prompt would.
  on("prompt.submit", ($, e) => ({ text: e.text, context: e.context }));
  await $.prompt.submit({ text: "key " + OR, wait: false, origin: composer });

  // Inside single quotes no shell expands a variable, so the value itself must go in.
  const first: any = await $.tool.call({ tool: "Bash", command: "printf '%s' '$OPENROUTER_API_KEY'" } as any);
  expect(seen.command).toBe("printf '%s' '" + OR + "'");
  // The new key in that output is stored and replaced. (A plugin's own $.tool.call carries no context by
  // the engine's rules; the model's real calls get the "stored as $GITHUB_TOKEN" note.)
  expect(JSON.stringify(first.result)).toContain("$GITHUB_TOKEN");

  // Unquoted: either the shell gets the variable (env export on) or the value (export unavailable); never a broken name.
  const r: any = await $.tool.call({ tool: "Bash", command: 'curl -H "Authorization: Bearer $OPENROUTER_API_KEY" https://example.test/' } as any);
  expect(seen.command === 'curl -H "Authorization: Bearer $OPENROUTER_API_KEY" https://example.test/' || seen.command.includes(OR)).toBe(true);

  // The result the model reads: the stored value and the new key in the output are both names.
  const resultText = JSON.stringify(r.result);
  expect(resultText).not.toContain(OR);
  expect(resultText).not.toContain(GH);
  expect(resultText).toContain("$GITHUB_TOKEN");

  // A non-shell tool gets the value substituted textually.
  await $.tool.call({ tool: "Write", file_path: "C:/tmp/safe-keys-test.env", content: "OPENROUTER_API_KEY=$OPENROUTER_API_KEY\n" } as any);
  expect(seen.content).toBe("OPENROUTER_API_KEY=" + OR + "\n");
});

test("ui.render: a user row never shows a value, on the terminal and the desktop", async ($, on) => {
  drawText(on);
  for (const surface of ["terminal", "desktop"] as const) {
    const ui = await $.ui.mount({
      plugin: "safe-keys",
      surface,
      component: "UserMessage",
      props: { text: "here is " + OR + " and a stray AKIA" + "IOSFODNN7EXAMPLE", origin: composer, isExpanded: true },
      requestId: "msg-" + surface,
    } as any);
    const drawn = JSON.stringify(await ui.drawn());
    expect(drawn).not.toContain(OR);
    expect(drawn).not.toContain("AKIA" + "IOSFODNN7EXAMPLE");
    expect(drawn).toContain("[hidden]");
    await ui.unmount();
  }
});

test("ui.render: a tool row with a stored value shows the name", async ($, on) => {
  mock.clock(on);
  drawText(on);
  on("prompt.submit", ($, e) => ({ text: e.text, context: e.context }));
  await $.prompt.submit({ text: "key " + OR, wait: false, origin: composer });
  for (const surface of ["terminal", "desktop"] as const) {
    const ui = await $.ui.mount({
      plugin: "safe-keys",
      surface,
      component: "ToolUse",
      props: { tool_use_id: "toolu_render_" + surface, tool: "Bash", input: { command: "echo " + OR }, isRunning: false, isErrored: false, isInterrupted: false, output: { stdout: OR, stderr: "", interrupted: false } },
      requestId: "toolu_render_" + surface,
    } as any);
    const drawn = JSON.stringify(await ui.drawn());
    expect(drawn).not.toContain(OR);
    await ui.unmount();
  }
});
