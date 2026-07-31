#!/usr/bin/env node
//
// cmh-guard — repo-safety hook engine.
//
// Runs as a PreToolUse/PostToolUse hook on the file-editing tools and enforces
// whatever the current repo declares in .claude/guard.json:
//
//   generated[]      files the build owns — deny hand-edits
//   frozen[]         files kept at a captured state — deny edits, allow creation
//   secretPatterns[] literals that must never enter a committed file
//   rebuild[]        build inputs — after an edit, note that outputs are stale
//
// No config file means no rules, so the plugin is inert in a repo that hasn't
// opted in. That is what makes it safe to enable everywhere.
//
// Everything fails open. A guard that breaks the session is worse than no
// guard, so a bad config, a bad regex, or an unexpected payload exits 0 and
// lets the tool call through.
//
// Escape hatch: CMH_GUARD_OFF=1 disables all rules for a session.

const fs = require("fs");
const path = require("path");

const CONFIG_REL = path.join(".claude", "guard.json");
const DEFAULT_WINDOW = 2000;

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

// Minimal glob -> RegExp. Supports ** (any depth), * (within a segment), and ?.
// A pattern containing no "/" is matched against the basename, so "*.before-*.html"
// works regardless of which directory the file sits in.
// "/**/" collapses to an optional run of directories so that "src/**/*.js"
// matches "src/c.js" as well as "src/a/b/c.js" — the standard globstar behavior.
//
// Sentinels are built with fromCharCode rather than written as escapes so this
// file stays plain source with no control characters embedded in it.
const GLOBSTAR_SLASH = String.fromCharCode(0);
const GLOBSTAR = String.fromCharCode(1);

function globToRegExp(glob) {
  const body = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\/\*\*\//g, GLOBSTAR_SLASH)
    .replace(/\*\*/g, GLOBSTAR)
    .replace(/\*/g, "[^/]*")
    .replace(/\?/g, "[^/]")
    .split(GLOBSTAR_SLASH)
    .join("/(?:.*/)?")
    .split(GLOBSTAR)
    .join(".*");
  return new RegExp(`^${body}$`, "i");
}

function matchesGlob(glob, relPath, baseName) {
  try {
    const re = globToRegExp(glob);
    return glob.includes("/") ? re.test(relPath) : re.test(baseName);
  } catch {
    return false;
  }
}

function matchesAny(globs, relPath, baseName) {
  return (
    Array.isArray(globs) &&
    globs.some(glob => typeof glob === "string" && matchesGlob(glob, relPath, baseName))
  );
}

function loadConfig(projectDir) {
  try {
    const raw = fs.readFileSync(path.join(projectDir, CONFIG_REL), "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null; // Absent or malformed: no rules.
  }
}

// Edit/Write use file_path, NotebookEdit uses notebook_path.
function targetPath(toolInput) {
  const raw = toolInput.file_path || toolInput.notebook_path;
  return typeof raw === "string" && raw ? path.resolve(raw) : null;
}

// Everything this tool call is about to introduce, across every tool shape.
function incomingText(toolInput) {
  const parts = [];
  for (const key of ["content", "new_string", "new_source"]) {
    if (typeof toolInput[key] === "string") parts.push(toolInput[key]);
  }
  if (Array.isArray(toolInput.edits)) {
    for (const edit of toolInput.edits) {
      if (edit && typeof edit.new_string === "string") parts.push(edit.new_string);
    }
  }
  return parts.join("\n");
}

// A secret rule fires when `value` appears close enough after `declaration` to
// be inside the same literal. Scoping it that way keeps ordinary numeric maps
// (tonnage, sizes, package ids) from tripping a PIN rule. A rule with no
// declaration matches `value` anywhere.
function violatesSecretRule(rule, text) {
  if (!rule || typeof rule.value !== "string") return false;

  let valueRe;
  try {
    valueRe = new RegExp(rule.value);
  } catch {
    return false; // Bad regex in config: skip the rule, don't break the call.
  }

  if (typeof rule.declaration !== "string" || !rule.declaration) {
    return valueRe.test(text);
  }

  let declRe;
  try {
    declRe = new RegExp(rule.declaration, "g");
  } catch {
    return false;
  }

  const window = Number.isInteger(rule.window) ? rule.window : DEFAULT_WINDOW;
  let match;
  while ((match = declRe.exec(text)) !== null) {
    if (valueRe.test(text.slice(match.index, match.index + window))) return true;
    if (declRe.lastIndex === match.index) declRe.lastIndex++; // zero-width guard
  }
  return false;
}

function preToolUse(config, toolInput, absPath, relPath, baseName) {
  for (const entry of config.generated || []) {
    if (!entry || !matchesGlob(String(entry.path || entry.glob || ""), relPath, baseName)) continue;
    const what = entry.what ? ` — ${entry.what}` : "";
    const from = entry.from ? ` Edit ${entry.from} instead` : " Edit the source instead";
    const build = entry.build ? `, then run \`${entry.build}\` from the repo root.` : ".";
    deny(
      `${relPath} is generated${what}, so a hand-edit is overwritten by the next ` +
        `build.${from}${build}${entry.docs ? ` See ${entry.docs}.` : ""}`
    );
  }

  for (const entry of config.frozen || []) {
    if (!entry || !matchesGlob(String(entry.glob || entry.path || ""), relPath, baseName)) continue;
    // Creating a new frozen file is the point; overwriting an existing one is not.
    if (entry.allowCreate !== false && !fs.existsSync(absPath)) continue;
    deny(
      `${relPath} is ${entry.reason || "kept frozen at the state it captured"}. ` +
        `Edit the live file instead. If this one genuinely needs to change, the ` +
        `user should confirm first.${entry.docs ? ` See ${entry.docs}.` : ""}`
    );
  }

  const text = incomingText(toolInput);
  if (!text) return;

  for (const rule of config.secretPatterns || []) {
    if (!rule) continue;
    if (matchesAny(rule.allow, relPath, baseName)) continue;
    if (!violatesSecretRule(rule, text)) continue;
    deny(
      `This edit writes ${rule.name || "a secret literal"} into ${relPath}, which is ` +
        `committed${rule.published === false ? "" : " and published"}. ` +
        `${rule.hint || "Keep secrets in an ignored file and inject them at build time."}` +
        `${rule.docs ? ` See ${rule.docs}.` : ""}`
    );
  }
}

function postToolUse(config, relPath, baseName) {
  for (const entry of config.rebuild || []) {
    if (!entry || !matchesGlob(String(entry.glob || entry.path || ""), relPath, baseName)) continue;
    const stale = Array.isArray(entry.stale) && entry.stale.length
      ? `${entry.stale.join(" and ")} ${entry.stale.length > 1 ? "are" : "is"} now stale — `
      : "";
    notice(
      `${relPath} is a build input. ${stale}` +
        `run \`${entry.build}\` from the repo root before committing.` +
        `${entry.note ? ` ${entry.note}` : ""}` +
        `${entry.docs ? ` Deploy commands are in ${entry.docs}.` : ""}`
    );
  }
}

function main() {
  if (process.env.CMH_GUARD_OFF === "1") return;

  const raw = readStdin();
  if (!raw.trim()) return;

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return;
  }

  const toolInput = payload && payload.tool_input;
  if (!toolInput || typeof toolInput !== "object") return;

  const projectDir = payload.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const config = loadConfig(projectDir);
  if (!config) return; // Repo hasn't opted in.

  const abs = targetPath(toolInput);
  if (!abs) return;

  const rel = path.relative(projectDir, abs);
  if (!rel || rel.startsWith("..")) return; // Outside the repo: not ours to police.

  const relPath = rel.split(path.sep).join("/");
  const baseName = path.basename(abs);

  if (payload.hook_event_name === "PreToolUse") {
    preToolUse(config, toolInput, abs, relPath, baseName);
  } else if (payload.hook_event_name === "PostToolUse") {
    postToolUse(config, relPath, baseName);
  }
}

try {
  main();
} catch {
  // Never let a guard failure break a tool call.
}

process.exit(0);
