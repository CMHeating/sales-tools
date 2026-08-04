# cmh-guard

A Claude Code hook that stops three classes of mistake before they land:

- editing a **generated** file that the next build overwrites
- editing a **frozen** file (a recovery snapshot) that is supposed to stay as captured
- committing a **secret literal** into a file that gets published

It also posts a reminder when a **build input** changes, so generated outputs don't quietly go stale.

## Install

In the consuming repo's `.claude/settings.json`:

```json
{
  "enabledPlugins": { "cmh-guard@cmh-tools": true },
  "extraKnownMarketplaces": {
    "cmh-tools": { "source": { "source": "github", "repo": "CMHeating/sales-tools" } }
  }
}
```

The plugin has no rules of its own. It reads `.claude/guard.json` from the repo it's running in, and does nothing when that file is absent — so enabling it everywhere is safe.

## Configuration

`.claude/guard.json`, all four sections optional:

```json
{
  "generated": [
    {
      "path": "dist/bundle.js",
      "what": "the production bundle",
      "from": "src/index.js",
      "build": "npm run build",
      "docs": "README.md"
    }
  ],

  "frozen": [
    {
      "glob": "*.before-*.html",
      "reason": "a recovery snapshot, kept at the state it captured",
      "allowCreate": true
    }
  ],

  "secretPatterns": [
    {
      "name": "API keys",
      "declaration": "API_KEYS\\s*=\\s*\\{",
      "value": "\"sk-[A-Za-z0-9]{20,}\"",
      "window": 2000,
      "allow": ["*.private.*", ".env*"],
      "hint": "Keys belong in .env, injected at build time."
    }
  ],

  "rebuild": [
    {
      "glob": "src/**/*.js",
      "build": "npm run build",
      "stale": ["dist/bundle.js"],
      "note": "Anything extra worth saying.",
      "docs": "DEPLOY.md"
    }
  ]
}
```

**Globs** support `*`, `**`, and `?`. A pattern with no `/` matches the basename at any depth (`*.before-*.html`); one with a `/` matches the repo-relative path (`scripts/users.js`).

**`allowCreate`** (frozen, default `true`) permits creating a new matching file while still blocking edits to existing ones — taking a snapshot stays easy, clobbering one doesn't.

**`declaration` + `value`** (secretPatterns) is what keeps false positives down. `value` alone matches anywhere in the scanned text; pairing it with `declaration` only fires when `value` appears within `window` characters (default 2000) after the declaration, so an unrelated numeric or key-shaped literal elsewhere in the file doesn't trip the rule. Both are JavaScript regex sources — remember to double-escape backslashes in JSON.

**`allow`** exempts paths that legitimately hold the secret, like gitignored config.

### What secret rules scan

Not the incoming fragment. An edit can drop a value into a declaration that is already sitting in the file — the fragment carries the secret but not the declaration that scopes it, and a fragment-only scan would wave it through. So the engine replays the call against the real file and scans the result, keeping the fragment union as a fallback for a call it can't replay.

It denies only what the call **introduces**: if the same rule already matches the file as it stands, the edit is allowed through. A violation that is already committed needs a cleanup, not a wall in front of every subsequent edit to that file.

## Behavior

| Event | Action |
|---|---|
| `PreToolUse` on `Edit`/`Write`/`MultiEdit`/`NotebookEdit` | Denies with an explanation naming the file to edit instead |
| `PostToolUse` on `Edit`/`Write`/`MultiEdit` | Injects the stale-build reminder as context |

Every failure path is open: no config, malformed config, an invalid regex, an unrecognized payload, or a thrown exception all exit 0 and let the tool call proceed. A guard that breaks the session is worse than no guard.

Set `CMH_GUARD_OFF=1` to disable all rules for a session.

## Development

The engine is a single dependency-free Node script, `scripts/guard.js`.

```bash
node plugins/cmh-guard/test/guard.test.js          # regression suite, no deps
claude plugin validate ./plugins/cmh-guard --strict # after changing a manifest
```

The suite builds a throwaway repo per case, so it runs anywhere and never touches real files.
