#!/usr/bin/env node
//
// Claude Code guard hook for sales-tools.
//
// Wired up in .claude/settings.json as both a PreToolUse and a PostToolUse
// hook on the file-editing tools. It enforces the three rules in CLAUDE.md
// that are easy to forget mid-task:
//
//   1. Generated files are never hand-edited (they come from the build).
//   2. *.before-*.html snapshots are recovery points, not working files.
//   3. PIN literals never land in a file that GitHub Pages publishes.
//
// ...and, after an edit to a build input, reminds Claude to rebuild.
//
// Everything here fails open. A guard that breaks the session is worse than
// no guard, so any parse error, unexpected payload shape, or unreadable file
// exits 0 and lets the tool call through.
//
// Escape hatch: set CMH_GUARD_OFF=1 to disable all blocking for a session.

const fs = require("fs");
const path = require("path");

// Generated artifacts — the build script owns these byte for byte.
const GENERATED = {
  "install-availability-secure.html":
    "the Firebase Hosting production build",
  "database.install-availability.spark.rules.json":
    "the Firebase Realtime Database rules"
};

// Editing either of these means the secure build is now stale.
const BUILD_INPUTS = [
  "install-availability.html",
  path.join("scripts", "install-availability-users.spark.js")
];

const BUILD_CMD = "node scripts/build-install-availability-spark.js";
const SNAPSHOT_RE = /\.before-[^/\\]*\.html$/i;

// A PIN map entry: "4821": "Kyle McAlister". Matched only inside a *_PINS
// object literal so ordinary numeric-keyed maps (years, zips, sizes) in the
// quoting and BOM tools don't trip it.
const PINS_DECL_RE = /(?:ADMIN_PINS|HCA_PINS|PIN_MAP|PINS)\s*=\s*\{/g;
const PIN_PAIR_RE = /"\d{4,12}"\s*:\s*"/;

function readStdin() {
  try {
    return fs.readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function emit(obj) {
  process.stdout.write(JSON.stringify(obj));
  process.exit(0);
}

function deny(reason) {
  emit({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: reason
    }
  });
}

function notice(text) {
  emit({
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext: text
    }
  });
}

// Edit/Write use file_path, NotebookEdit uses notebook_path.
function targetPath(toolInput) {
  const raw = toolInput.file_path || toolInput.notebook_path;
  return typeof raw === "string" && raw ? path.resolve(raw) : null;
}

// The text this tool call is about to introduce, across every tool shape.
function incomingText(toolInput) {
  const parts = [];
  if (typeof toolInput.content === "string") parts.push(toolInput.content);
  if (typeof toolInput.new_string === "string") parts.push(toolInput.new_string);
  if (typeof toolInput.new_source === "string") parts.push(toolInput.new_source);
  if (Array.isArray(toolInput.edits)) {
    for (const edit of toolInput.edits) {
      if (edit && typeof edit.new_string === "string") parts.push(edit.new_string);
    }
  }
  return parts.join("\n");
}

// True if `text` puts a real PIN inside a PINS object literal. Scans a window
// after each declaration rather than the whole payload, so a PIN-shaped pair
// elsewhere in a large file doesn't false-positive.
function addsPinLiteral(text) {
  PINS_DECL_RE.lastIndex = 0;
  let match;
  while ((match = PINS_DECL_RE.exec(text)) !== null) {
    if (PIN_PAIR_RE.test(text.slice(match.index, match.index + 2000))) return true;
  }
  return false;
}

function relFromRepo(absPath) {
  const repoRoot = path.resolve(__dirname, "..");
  const rel = path.relative(repoRoot, absPath);
  // Outside the repo entirely — not ours to police.
  return rel && !rel.startsWith("..") ? rel : null;
}

function preToolUse(toolInput) {
  const abs = targetPath(toolInput);
  if (!abs) return;

  const rel = relFromRepo(abs);
  if (!rel) return;

  const base = path.basename(abs);

  if (GENERATED[base]) {
    deny(
      `${rel} is ${GENERATED[base]} — it is generated, so a hand-edit is ` +
        `overwritten by the next build. Edit install-availability.html (or ` +
        `scripts/install-availability-users.spark.js for the roster), then run ` +
        `\`${BUILD_CMD}\` from the repo root. See CLAUDE.md > Install Availability ` +
        `Build Pipeline.`
    );
  }

  // Creating a new snapshot is fine; overwriting an existing one is not.
  if (SNAPSHOT_RE.test(base) && fs.existsSync(abs)) {
    deny(
      `${rel} is a .before-*.html recovery snapshot — an intentional restore ` +
        `point, kept frozen at the state it captured. Edit the live tool instead. ` +
        `If this snapshot genuinely needs to change, the user should confirm first. ` +
        `See CLAUDE.md > Backup File Convention.`
    );
  }

  // *.private.* files are gitignored and legitimately hold PINs.
  if (!/\.private\./i.test(base) && addsPinLiteral(incomingText(toolInput))) {
    deny(
      `This edit writes PIN literals into ${rel}, which is committed and ` +
        `published to GitHub Pages. PINs belong in pin-config.private.json ` +
        `(gitignored) and are injected by the build. Leave ADMIN_PINS/HCA_PINS ` +
        `empty in committed source. See INSTALL-AVAILABILITY-SECURITY.md.`
    );
  }
}

function postToolUse(toolInput) {
  const abs = targetPath(toolInput);
  if (!abs) return;

  const rel = relFromRepo(abs);
  if (!rel) return;

  const normalized = rel.split(path.sep).join(path.sep);
  if (!BUILD_INPUTS.includes(normalized)) return;

  const rosterNote = normalized.endsWith("install-availability-users.spark.js")
    ? ` Roster changes also change the database rules, so redeploy those too.`
    : ``;

  notice(
    `${rel} is a build input for the Install Availability tracker. ` +
      `install-availability-secure.html and database.install-availability.spark.rules.json ` +
      `are now stale — run \`${BUILD_CMD}\` from the repo root (the script uses ` +
      `relative paths) before committing.${rosterNote} Deploy commands are in ` +
      `INSTALL-AVAILABILITY-SECURITY.md.`
  );
}

function main() {
  if (process.env.CMH_GUARD_OFF === "1") return;

  const raw = readStdin();
  if (!raw.trim()) return;

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return; // Unparseable input: fail open.
  }

  const toolInput = payload && payload.tool_input;
  if (!toolInput || typeof toolInput !== "object") return;

  if (payload.hook_event_name === "PreToolUse") preToolUse(toolInput);
  else if (payload.hook_event_name === "PostToolUse") postToolUse(toolInput);
}

try {
  main();
} catch {
  // Never let a guard failure break a tool call.
}

process.exit(0);
