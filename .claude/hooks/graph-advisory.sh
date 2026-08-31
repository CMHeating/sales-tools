#!/bin/sh
# PreToolUse advisory for Grep / Glob / Read — replaces graphify's own `hook-guard` hooks.
#
# graphify's hook text is hard-coded in its cli.py and says "MANDATORY: you MUST run
# graphify query before grepping". In this repo that directive points at an index that
# covers about 3% of the logic by line (about 10% by unique substantive lines): the
# AST extractor does not parse the inline <script> blocks in the HTML tools and does
# not classify apps-script/*.gs at all. An empty `graphify affected` result from that
# index is not evidence that nothing references a thing. This hook says so, once per
# tool call, as advisory context only. It never blocks (always exit 0) and stays
# silent when there is no graph to point at.
#
# Measured 2026-08-30 (see CLAUDE.md "graphify"): inline <script> ~24.9k lines
# (~4.3k unique in the live tools), apps-script/*.gs ~15.4k lines (~8.4k unique),
# extracted .js/.mjs/.py/.sh ~1.35k lines.
ROOT="${CLAUDE_PROJECT_DIR:-$PWD}"
[ -f "$ROOT/graphify-out/graph.json" ] || exit 0
cat <<'JSON'
{"hookSpecificOutput":{"hookEventName":"PreToolUse","additionalContext":"graphify-out/graph.json indexes ~3% of this repo's logic by line (~10% by unique substantive lines): the markdown docs plus the .js/.mjs/.py/.sh under scripts/, plugins/ and .claude/. NOT indexed: inline <script> in *.html (60% of lines) and apps-script/*.gs (37%) — the Apps Script backends are invisible to it. Use `graphify query`/`explain`/`path` when the question is about the docs or build tooling; grep-first for anything an HTML tool or a .gs backend does; an empty `graphify affected` result is NOT evidence that nothing references a thing."}}
JSON
exit 0
