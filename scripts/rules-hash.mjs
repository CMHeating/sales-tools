#!/usr/bin/env node
// Prints the sha256 the Firebase Rules Tripwire uses for a rules file (same normalization as Code.js).
// Usage: node rules-hash.mjs OUT.json   -> paste the output into Script Property EXPECTED_RULES_SHA256, then deploy.
import fs from "fs"; import crypto from "crypto";
const file = process.argv[2];
if (!file) { console.error("usage: node rules-hash.mjs <rules.json>"); process.exit(2); }
const stable = (o) => o === null || typeof o !== "object" ? JSON.stringify(o)
  : Array.isArray(o) ? "[" + o.map(stable).join(",") + "]"
  : "{" + Object.keys(o).sort().map((k) => JSON.stringify(k) + ":" + stable(o[k])).join(",") + "}";
const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
if (!parsed || typeof parsed.rules !== "object") { console.error("not a rules file: no top-level \"rules\""); process.exit(1); }
console.log(crypto.createHash("sha256").update(stable(parsed), "utf8").digest("hex"));
