# GEMINI.md

This repository's agent instructions live in **[`AGENTS.md`](./AGENTS.md)** —
one master file shared by every agent surface (Claude, Codex, Gemini,
scheduled runs) so a rule added once applies everywhere.

Read `AGENTS.md` first. Then, for the mechanics of working in this codebase —
build pipeline, file routing, deploy, design patterns — read
[`CLAUDE.md`](./CLAUDE.md), which is vendor-named for historical reasons but
is not Claude-specific in content.

Do not add rules to this file. New rules are routed by `AGENTS.md` §4.
