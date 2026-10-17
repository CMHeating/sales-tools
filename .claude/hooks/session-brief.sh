#!/bin/bash
#
# SessionStart hook — the standing brief.
#
# The rules that govern this work live in two Google Drive documents a fresh
# session has not read, and the handoff from the previous session lives in a
# file nobody remembers to open. Both were being carried across by hand, by
# paste, at 3am. This removes the hand.
#
# It prints the standing rules and a pointer to the current handoff. It does
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

Rules that hold on every surface (00 AGENT RULES rev 20, 2026-09-28). They
hold even when you are certain, even for one cell, even if asked directly in
the moment:

  1. Read-only by default. Always allowed: read anything, write files in Drive,
     create Gmail drafts. A write to a Sheet, Apps Script, Firebase,
     ServiceTitan / BI, or a sent email needs Geoff's explicit yes, in this
     session, naming the target and the exact change. It covers only what was
     stated and ends with the session. An unattended run writes nothing outside
     its own Drive files. No yes, no write: hand values back as text.
  2. Apps Script is one of those writes, with one writer per project. Read
     "00 WRITE RULES" (HANDOFFS) and follow its LOCK protocol on every push.
     Not the named writer: hand the change to the owner. Save is not Deploy.
  3. The Combo Log is Geoff's. The one approved write is install job numbers
     into the column headed "Job Number" on PENDING JOBS, on a supervised run
     with his yes. Any other change only when he directs that specific change.
     When your numbers disagree with the log, fix the reader, not the data.
  4. This repo is PUBLIC. No PINs, customer names, dollar figures, staff
     emails, or Drive file IDs in anything committed.
  5. Nothing goes outward without a human. A Gmail draft is the end of your
     job; sending needs Geoff's explicit yes naming the message.
  6. One writer per canonical document. Hand back paste-ready text for START
     HERE and the account skill; do not edit them unless Geoff pointed you at
     them.

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
