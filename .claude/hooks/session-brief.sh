#!/bin/bash
#
# SessionStart hook — the standing brief.
#
# The rules that govern this work live in two Google Drive documents a fresh
# session has not read, and the handoff from the previous session lives in a
# file nobody remembers to open. Both were being carried across by hand, by
# paste, at 3am. This removes the hand.
#
# It prints the never-bend rules and a pointer to the current handoff. It does
# NOT print the handoff body — 30KB at the top of every session is a context
# tax; a line with a date and a size gets read.
#
# Contract: never block a session. Every path exits 0. No network, no writes.

set -uo pipefail

ROOT="${CLAUDE_PROJECT_DIR:-$PWD}"
HANDOFF="$ROOT/HANDOFF.local.md"

cat <<'BRIEF'

──────────────────────────────────────────────────────────────────────────
CM HEATING SALES OPS — STANDING BRIEF
──────────────────────────────────────────────────────────────────────────

Rules that never bend. These hold even when you are certain, even for one
cell, even if asked directly in the moment:

  1. Never write to a spreadsheet. The whole write surface is a Gmail draft
     (never sent) plus files in Drive. Hand corrected values back as text.
  2. Never run or deploy an Apps Script function. Propose the call; a human
     runs it from the editor.
  3. Never edit the Combo Log — and never recommend editing it. Laura owns
     it. Recommending the write is the violation.
  4. This repo is PUBLIC. No PINs, customer names, dollar figures, staff
     emails, or Drive file IDs in anything committed.
  5. Nothing goes outward without a human sending it. Draft, never send.
  6. One writer per document. Hand back paste-ready text for START HERE and
     the account skill; do not edit them yourself.

Read before working:
  • AGENTS.md, then CLAUDE.md — repo root, you have them.
  • "00 AGENT RULES — read first"  → 🧠 Second Brain (Drive)
  • "START HERE — CM Heating Sales Ops Source of Truth" → Sales Ops (Drive)
  Find both BY TITLE. The IDs change on every save.
  Precedence: 00 AGENT RULES > START HERE > AGENTS.md > CLAUDE.md.

Two habits that would have saved the night of 08-19:
  • A command that did not fail is not a command that did something.
    Verify a positive — count something, compare it to an expected value.
  • A missing day is a lag, never a zero. Exports post about a day behind.
BRIEF

if [ -f "$HANDOFF" ]; then
  # stat is not portable. GNU first (its -f means something else entirely and
  # succeeds with garbage, so it must not be the fallback), then BSD/macOS.
  if t="$(stat -c '%y' "$HANDOFF" 2>/dev/null)"; then
    when="${t:0:16}"
  elif t="$(stat -f '%Sm' -t '%Y-%m-%d %H:%M' "$HANDOFF" 2>/dev/null)"; then
    when="$t"
  else
    when="unknown date"
  fi
  lines="$(wc -l < "$HANDOFF" 2>/dev/null | tr -d ' ')"
  cat <<BRIEF

>>> A HANDOFF IS WAITING. Read it before doing anything else:
>>>   $HANDOFF
>>>   written $when · ${lines} lines
>>> It carries the previous session's state: open work, what is already
>>> settled, and what went wrong. Do not rediscover any of it.
BRIEF
else
  cat <<'BRIEF'

No HANDOFF.local.md in the repo root. If a previous session left one in the
Drive HANDOFFS folder, read the newest by title before starting. If you
cannot reach Drive, say so rather than proceeding without it.
BRIEF
fi

cat <<'BRIEF'
──────────────────────────────────────────────────────────────────────────

BRIEF

exit 0
