#!/usr/bin/env node
//
// Regression tests for the cmh-guard engine.
//
//   node plugins/cmh-guard/test/guard.test.js
//
// Each case builds a throwaway repo with its own .claude/guard.json, feeds the
// engine a hook payload on stdin, and asserts on the decision. Nothing here
// touches the real sales-tools files, so the suite runs anywhere.

const assert = require("assert");
const { execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const GUARD = path.resolve(__dirname, "..", "scripts", "guard.js");

const CONFIG = {
  generated: [
    { path: "dist/bundle.js", what: "the production bundle", from: "src/index.js", build: "npm run build" }
  ],
  frozen: [{ glob: "*.before-*.html", reason: "a recovery snapshot", allowCreate: true }],
  secretPatterns: [
    {
      name: "PIN literals",
      declaration: "(?:ADMIN_PINS|HCA_PINS)\\s*=\\s*\\{",
      value: '"\\d{4,12}"\\s*:\\s*"',
      window: 2000,
      allow: ["*.private.*"],
      hint: "PINs belong in an ignored file."
    }
  ],
  rebuild: [{ glob: "src/index.js", build: "npm run build", stale: ["dist/bundle.js"] }]
};

// A source file whose PIN maps are empty — the shape the real repo ships.
const SOURCE = [
  "<script>",
  "const FIREBASE = { messagingSenderId: \"187871662912\" };",
  "",
  "const ADMIN_PINS = {};",
  "",
  "const HCA_PINS = {};",
  "",
  "function render() { return 1; }",
  "</script>"
].join("\n");

function makeRepo(extraFiles) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cmh-guard-"));
  fs.mkdirSync(path.join(dir, ".claude"));
  fs.writeFileSync(path.join(dir, ".claude", "guard.json"), JSON.stringify(CONFIG));
  const files = Object.assign(
    {
      "source.html": SOURCE,
      "dist/bundle.js": "generated",
      "page.before-change.html": "<html>snapshot</html>",
      "sizes.html": 'const SIZES = { "2400": "3 ton" };'
    },
    extraFiles || {}
  );
  for (const [rel, body] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, body);
  }
  return dir;
}

function decide(dir, payload, env) {
  const out = execFileSync("node", [GUARD], {
    input: JSON.stringify(Object.assign({ cwd: dir }, payload)),
    encoding: "utf8",
    env: Object.assign({}, process.env, env || {})
  });
  if (!out.trim()) return { decision: "allow", text: "" };
  const parsed = JSON.parse(out);
  const hook = parsed.hookSpecificOutput || {};
  if (hook.permissionDecision === "deny") return { decision: "deny", text: hook.permissionDecisionReason };
  if (hook.additionalContext) return { decision: "notice", text: hook.additionalContext };
  return { decision: "allow", text: out };
}

function pre(dir, file, toolInput, toolName) {
  return decide(dir, {
    hook_event_name: "PreToolUse",
    tool_name: toolName || "Edit",
    tool_input: Object.assign({ file_path: path.join(dir, file) }, toolInput)
  });
}

let passed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log("ok   " + name);
  } catch (err) {
    failures.push({ name, err });
    console.log("FAIL " + name + "\n       " + err.message.split("\n")[0]);
  }
}

// ---------------------------------------------------------------- generated

test("denies an edit to a generated file", () => {
  const dir = makeRepo();
  const r = pre(dir, "dist/bundle.js", { new_string: "x" });
  assert.strictEqual(r.decision, "deny");
  assert.ok(/npm run build/.test(r.text), "names the build command");
});

// ------------------------------------------------------------------- frozen

test("denies an edit to an existing snapshot", () => {
  const dir = makeRepo();
  assert.strictEqual(pre(dir, "page.before-change.html", { new_string: "x" }).decision, "deny");
});

test("allows creating a new snapshot", () => {
  const dir = makeRepo();
  const r = pre(dir, "page.before-brand-new.html", { content: "<html>" }, "Write");
  assert.strictEqual(r.decision, "allow");
});

// ------------------------------------------------------------------ secrets

test("denies a Write whose content carries declaration and value", () => {
  const dir = makeRepo();
  const r = pre(dir, "source.html", { content: 'const ADMIN_PINS = {\n  "4821": "Kyle"\n};' }, "Write");
  assert.strictEqual(r.decision, "deny");
});

// The regression this suite exists for: the fragment holds the PIN but not the
// declaration, because the declaration is already sitting in the file.
test("denies an Edit that inserts a PIN into a declaration already in the file", () => {
  const dir = makeRepo();
  const r = pre(dir, "source.html", {
    old_string: "const ADMIN_PINS = {};",
    new_string: 'const ADMIN_PINS = {\n  "4821": "Kyle"\n};'
  });
  assert.strictEqual(r.decision, "deny");
});

test("denies an Edit whose fragment omits the declaration entirely", () => {
  const dir = makeRepo();
  // old_string is just the empty braces of the ADMIN_PINS line.
  const r = pre(dir, "source.html", {
    old_string: "const ADMIN_PINS = {}",
    new_string: 'const ADMIN_PINS = {\n  "4821": "Kyle"\n}'
  });
  assert.strictEqual(r.decision, "deny");
});

test("allows a PIN in a file the rule exempts", () => {
  const dir = makeRepo({ "pins.private.json": "{}" });
  const r = pre(dir, "pins.private.json", { content: 'const ADMIN_PINS = {\n  "4821": "Kyle"\n};' }, "Write");
  assert.strictEqual(r.decision, "allow");
});

test("allows a numeric map that is not a PIN map", () => {
  const dir = makeRepo();
  const r = pre(dir, "sizes.html", { new_string: 'const SIZES = { "2400": "3 ton" };' });
  assert.strictEqual(r.decision, "allow");
});

// Whole-file scanning must not turn the file's own empty declaration into a
// tripwire for every unrelated edit.
test("allows an ordinary edit to a file that declares PIN maps", () => {
  const dir = makeRepo();
  const r = pre(dir, "source.html", {
    old_string: "function render() { return 1; }",
    new_string: "function render() { return 2; }"
  });
  assert.strictEqual(r.decision, "allow");
});

test("allows an unrelated edit when the file already violates", () => {
  const dir = makeRepo({ "leaked.html": 'const ADMIN_PINS = {\n  "4821": "Kyle"\n};\nlet x = 1;' });
  const r = pre(dir, "leaked.html", { old_string: "let x = 1;", new_string: "let x = 2;" });
  assert.strictEqual(r.decision, "allow", "pre-existing violations need a cleanup, not a wall");
});

test("denies a PIN arriving through MultiEdit", () => {
  const dir = makeRepo();
  const r = pre(
    dir,
    "source.html",
    { edits: [{ old_string: "const HCA_PINS = {};", new_string: 'const HCA_PINS = { "9182": "Trevor" };' }] },
    "MultiEdit"
  );
  assert.strictEqual(r.decision, "deny");
});

// ------------------------------------------------------------------ rebuild

test("notes a stale build after editing an input", () => {
  const dir = makeRepo({ "src/index.js": "export default 1;" });
  const r = decide(dir, {
    hook_event_name: "PostToolUse",
    tool_name: "Edit",
    tool_input: { file_path: path.join(dir, "src/index.js"), new_string: "x" }
  });
  assert.strictEqual(r.decision, "notice");
  assert.ok(/dist\/bundle\.js/.test(r.text));
});

test("says nothing after editing an ordinary file", () => {
  const dir = makeRepo();
  const r = decide(dir, {
    hook_event_name: "PostToolUse",
    tool_name: "Edit",
    tool_input: { file_path: path.join(dir, "sizes.html"), new_string: "x" }
  });
  assert.strictEqual(r.decision, "allow");
});

// --------------------------------------------------------------- fail open

test("is inert without a config", () => {
  const dir = makeRepo();
  fs.rmSync(path.join(dir, ".claude", "guard.json"));
  assert.strictEqual(pre(dir, "dist/bundle.js", { new_string: "x" }).decision, "allow");
});

test("fails open on a malformed config", () => {
  const dir = makeRepo();
  fs.writeFileSync(path.join(dir, ".claude", "guard.json"), "{ broken");
  assert.strictEqual(pre(dir, "dist/bundle.js", { new_string: "x" }).decision, "allow");
});

test("fails open on an invalid regex in a rule", () => {
  const dir = makeRepo();
  fs.writeFileSync(
    path.join(dir, ".claude", "guard.json"),
    JSON.stringify({ secretPatterns: [{ name: "bad", value: "(((unclosed" }] })
  );
  assert.strictEqual(pre(dir, "source.html", { content: "anything" }, "Write").decision, "allow");
});

test("fails open on unparseable stdin", () => {
  const out = execFileSync("node", [GUARD], { input: "not json", encoding: "utf8" });
  assert.strictEqual(out.trim(), "");
});

test("ignores files outside the repo", () => {
  const dir = makeRepo();
  const r = decide(dir, {
    hook_event_name: "PreToolUse",
    tool_name: "Write",
    tool_input: { file_path: "/etc/bundle.js", content: "x" }
  });
  assert.strictEqual(r.decision, "allow");
});

test("CMH_GUARD_OFF disables every rule", () => {
  const dir = makeRepo();
  const r = decide(
    dir,
    { hook_event_name: "PreToolUse", tool_name: "Edit", tool_input: { file_path: path.join(dir, "dist/bundle.js"), new_string: "x" } },
    { CMH_GUARD_OFF: "1" }
  );
  assert.strictEqual(r.decision, "allow");
});

// --------------------------------------------------------------------- globs

test("glob matching covers leading, middle, basename and path forms", () => {
  const src = fs.readFileSync(GUARD, "utf8");
  const scope = { module: {}, RegExp };
  const body = src.slice(src.indexOf("const LEADING_GLOBSTAR"), src.indexOf("function matchesAny"));
  const matchesGlob = new Function(body + "\nreturn matchesGlob;").call(scope);

  const cases = [
    ["**/*.js", "a.js", "a.js", true],
    ["**/*.js", "src/a.js", "a.js", true],
    ["**/*.js", "src/deep/a.js", "a.js", true],
    ["**/*.js", "a.ts", "a.ts", false],
    ["src/**/*.js", "src/c.js", "c.js", true],
    ["src/**/*.js", "src/a/b/c.js", "c.js", true],
    ["src/**/*.js", "other/c.js", "c.js", false],
    ["src/*.js", "src/a/b.js", "b.js", false],
    ["*.before-*.html", "deep/x.before-y.html", "x.before-y.html", true],
    ["*.before-*.html", "leaderboard.html", "leaderboard.html", false],
    ["*.private.*", "pin-config.private.json", "pin-config.private.json", true],
    ["scripts/users.js", "other/users.js", "users.js", false]
  ];
  for (const [glob, rel, base, want] of cases) {
    assert.strictEqual(matchesGlob(glob, rel, base), want, `${glob} vs ${rel}`);
  }
});

console.log(
  "\n" + passed + " passed, " + failures.length + " failed"
);
process.exit(failures.length ? 1 : 0);
