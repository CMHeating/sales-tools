#!/bin/bash
#
# SessionStart hook — installs the graphify CLI for Claude Code on the web.
#
# Why this exists
# ---------------
# .claude/settings.json registers two PreToolUse hooks that call `graphify`.
# Both are written as `command -v graphify >/dev/null 2>&1 && ... || exit 0`,
# so on a machine without the binary they silently do nothing. Web sessions
# start from a fresh container every time, so without this they ALWAYS do
# nothing, and CLAUDE.md's graphify guidance is dead text.
#
# How to switch it on
# -------------------
# Set GRAPHIFY_INSTALL in the environment's variables (Claude Code on the web:
# environment settings). It is the literal command that puts `graphify` on the
# PATH. Examples:
#
#   npm i -g git+ssh://git@github.com/<org>/<repo>.git
#   npm i -g @<scope>/graphify
#   pipx install graphify
#
# It lives in the environment rather than in this file on purpose: the source
# may be a private repo or carry a token, and neither belongs in git.
#
# WARNING: the public npm package literally named `graphify` is an unrelated
# "Random Graph Generator". `npm i -g graphify` installs the wrong thing.
#
# Contract
# --------
# This hook must never block a session. Every failure path exits 0. A missing
# GRAPHIFY_INSTALL is a normal state, not an error — the repo works fine
# without graphify, using Grep/Glob/Read directly.

# Deliberately no `-e`: a failed install must not abort the session.
set -uo pipefail

log() { echo "[session-start] $*" >&2; }

# Web sessions only. Local machines install graphify once, by hand, and should
# not have a repo hook reinstalling it underneath them.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

# npm's global bin is not always on PATH in a fresh container. Add it before
# checking, or an already-installed graphify looks missing.
NPM_BIN="$(npm bin -g 2>/dev/null || true)"
if [ -n "$NPM_BIN" ] && [ -d "$NPM_BIN" ] && [[ ":$PATH:" != *":$NPM_BIN:"* ]]; then
  export PATH="$PATH:$NPM_BIN"
  if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
    echo "export PATH=\"\$PATH:$NPM_BIN\"" >> "$CLAUDE_ENV_FILE"
  fi
fi

# Idempotent: the container is cached after this hook completes, so on a warm
# start graphify is already here and there is nothing to do.
if command -v graphify >/dev/null 2>&1; then
  log "graphify already present ($(command -v graphify))"
else
  if [ -z "${GRAPHIFY_INSTALL:-}" ]; then
    log "GRAPHIFY_INSTALL is not set — skipping graphify install."
    log "  The graphify PreToolUse hooks will no-op, which is a supported state."
    log "  To enable: set GRAPHIFY_INSTALL in this environment's variables."
    exit 0
  fi

  log "installing graphify via: ${GRAPHIFY_INSTALL}"
  if timeout 300 bash -lc "${GRAPHIFY_INSTALL}" >&2; then
    log "install command finished"
  else
    log "install FAILED (exit $?) — continuing without graphify"
    exit 0
  fi

  if ! command -v graphify >/dev/null 2>&1; then
    log "install ran but graphify is still not on PATH — continuing without it"
    exit 0
  fi
  log "graphify installed at $(command -v graphify)"
fi

# Build the graph if it is missing — the same LLM-free pair the local post-commit
# hook runs (see CLAUDE.md "graphify"): AST re-extraction without clustering, then
# clustering with placeholder community names. Plain `graphify update` would also
# try to *name* communities through whatever model API key it finds, which sends
# repo content to a model; `--no-cluster` + `cluster-only --no-label` never does.
# Still bounded and fail-soft: a slow or broken graph build must not cost the session.
GRAPH="${CLAUDE_PROJECT_DIR:-$PWD}/graphify-out/graph.json"
if [ ! -f "$GRAPH" ]; then
  log "building graphify-out/ ..."
  if timeout 300 graphify update "${CLAUDE_PROJECT_DIR:-$PWD}" --no-cluster >&2 \
     && timeout 300 graphify cluster-only "${CLAUDE_PROJECT_DIR:-$PWD}" --no-label >&2; then
    log "graph built"
  else
    log "graph build failed or timed out — graphify queries will fall back to grep"
  fi
else
  log "graphify-out/graph.json already present"
fi

exit 0
