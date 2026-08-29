# Follow-Up Tracker — how it works and what Geoff has to turn on

`follow-up-tracker.html` is the HCA follow-up page. It is served from GitHub
Pages, which is public, so the page itself contains no customer data at all —
it asks Firebase for the data at runtime, after the person using it signs in
with their CM Heating Google account.

This file explains what the page reads, what it writes, the three console
settings that have to be turned on before it works, and what the hourly sync
has to change next.

---

## What the page reads

One node in the Realtime Database:

    cmh_followup_tracker

Shape:

    {
      updated: "<ISO timestamp of the last sync>",
      leads: [ { ...one object per open lead... } ],      // array or keyed map, both work
      leaderboard: { "<HCA name>": { open, neverTouched, logged7, logged30 } }
    }

Fields the page uses on each lead:

| Field | What it is used for |
|---|---|
| `hca` | Which HCA's list the lead belongs to |
| `customer` | Name shown at the top of the card |
| `key` | Lead identity sent back with a logged outcome; also a fallback job number when it is six or more digits |
| `createdOn` | Shown as "Consult created"; fallback for the age badge |
| `lastApptDate` | Shown as "last visit"; **primary** source for the age badge |
| `visits` | "· 3 visits" |
| `leadType`, `campaign` | The grey line under the name |
| `notes` | The grey note box. Array of lines or a single string, both work |
| `status`, `followUps`, `lastFollowUp` | The status chip and the stale test |
| `snoozeUntil` | Sorts the card to the bottom of the list and pauses the stale test until that date |
| `canceled` | "CANCELED CONSULT — rebook?" badge |
| `jobNumber` (or `job` / `jobId`) | Builds the "Open in ServiceTitan" link. **Not emitted yet — see below** |

Two fields the sync currently emits that the page now **ignores on purpose**:
`phone` and `address`. They are not rendered anywhere. See "What the hourly
sync must change".

The read goes over the REST API using the signed-in user's own Firebase ID
token. If the database rule says no, the page shows:

> Signed in, but this account isn't allowed to read the tracker yet — ask Geoff.

That is the message to expect until the rule below is pasted in.

## What the page writes

**Primary — the Realtime Database.** Every "Log it" click POSTs one entry to:

    cmh_followup_log

Entry shape (Firebase generates the key):

    {
      hca:          "Kyle McAlister",
      customer:     "<customer name>",
      leadKey:      "<the lead's key>",
      status:       "Contacted",
      notes:        "",                      // optional, may be empty
      followUpDate: "",                      // optional, may be empty
      by:           "<signer's email>",      // filled in from the Google account
      at:           "2026-08-29T17:04:11.902Z",
      source:       "follow-up-tracker"
    }

The card says "Logged" **only** when Firebase returns 2xx and a generated key.
Anything else and the HCA sees "Save failed (…) — nothing was recorded. Retry."
and the button comes back. The old version printed a checkmark no matter what
happened, so a silently dropped save looked exactly like a good one.

**Transitional — the Apps Script receiver.** After a successful database write,
the same JSON is also fired at the existing `/exec` sheet receiver with
`mode:'no-cors'`, because today's hourly sync still reads outcomes from the
sheet. That second post is fire-and-forget: its result is unreadable by design
and it never affects what the HCA is told. It comes out of the page as soon as
the sync reads `cmh_followup_log` instead.

---

## Console steps for Geoff

Three things, all in the Firebase console for the **install-availability-tracker**
project. Nothing here touches the Install Availability tool.

**1. Turn on Google sign-in**

Firebase console → **Authentication** → **Sign-in method** → **Add new provider**
→ **Google** → toggle Enable → pick a support email → **Save**.

**2. Authorize the page's domain**

Firebase console → **Authentication** → **Settings** → **Authorized domains** →
**Add domain** → `cmheating.github.io`

Without this, sign-in fails with an "unauthorized domain" error even though
Google itself is enabled.

**If sign-in fails on an iPhone, this is why.** The page opens a Google popup
first, and falls back to a full-page redirect if the popup is blocked. The
redirect fallback is the fragile one: Safari (and Chrome with third-party cookies
turned off) partitions storage between `cmheating.github.io` and the
`…firebaseapp.com` sign-in domain, and Firebase's redirect flow needs both. The
documented fix is to serve the sign-in helper from a CM Heating domain instead of
`firebaseapp.com`. Not done here — flag it if an HCA reports being bounced back
to the sign-in screen in a loop, rather than assuming they typed something wrong.

**3. Merge the database rules**

Firebase console → **Realtime Database** → **Rules**. Merge the snippet below
into the existing rules — do not paste over them, the Install Availability nodes
(`cmh_schedule`, `cmh_availability`, `cmh_edit_locks`, `cmh_audit_logs`) live in
the same rules document and would be wiped out.

Replace `WRITER-ACCOUNT-EMAIL-HERE` with the address of the account the hourly
sync signs in as. Do not put a person's own address there — make a dedicated
service account for the sync, so revoking it later doesn't lock a human out.

### Rules snippet

```json
{
  "rules": {

    "cmh_followup_tracker": {
      ".read": "auth != null && auth.token.email_verified == true && auth.token.email.endsWith('@cmheating.com')",
      ".write": "auth != null && auth.token.email_verified == true && auth.token.email == 'WRITER-ACCOUNT-EMAIL-HERE'"
    },

    "cmh_followup_log": {
      ".read": "auth != null && auth.token.email_verified == true && auth.token.email.endsWith('@cmheating.com')",
      "$entry": {
        ".write": "auth != null && auth.token.email_verified == true && auth.token.email.endsWith('@cmheating.com') && !data.exists() && newData.child('by').val() == auth.token.email",
        ".validate": "newData.hasChildren(['hca','customer','status','at','by'])",
        "hca":      { ".validate": "newData.isString() && newData.val().length <= 80" },
        "customer": { ".validate": "newData.isString() && newData.val().length <= 200" },
        "status":   { ".validate": "newData.isString() && newData.val().length <= 40" },
        "at":       { ".validate": "newData.isString() && newData.val().length <= 40" },
        "by":       { ".validate": "newData.isString() && newData.val() == auth.token.email" },
        "leadKey":      { ".validate": "newData.isString() && newData.val().length <= 120" },
        "notes":        { ".validate": "newData.isString() && newData.val().length <= 2000" },
        "followUpDate": { ".validate": "newData.isString() && newData.val().length <= 20" },
        "source":       { ".validate": "newData.isString() && newData.val().length <= 40" },
        "$other": { ".validate": false }
      }
    }

  }
}
```

What each line is doing, in plain terms:

- **Read the tracker:** any signed-in, email-verified `cmheating.com` account.
  Nobody outside the company, and no anonymous token, gets in.
- **Write the tracker:** only the sync's own writer account. An HCA cannot
  rewrite the lead list, only log against it.
- **Write a log entry:** any company account may add an entry, but `!data.exists()`
  means an entry can be created and never edited or deleted afterwards — the log
  is append-only, so nobody can quietly rewrite history. `newData.child('by')`
  must equal the signer's own email, so an HCA cannot log an outcome under
  somebody else's name.
- **`$other: false`** rejects any field not on the list, so a modified page
  cannot stuff extra data into the database.

Rules are text — paste, click **Publish**, and it is live in seconds. There is a
**Rules Playground** on the same screen if you want to test one before publishing.

### What this does NOT do yet

Any signed-in company account can read **every** HCA's leads, not just their own,
and can view any HCA through the picker. That is deliberate for now — the leads
live in one flat node, and a rule cannot filter rows out of a node. Splitting the
data into per-HCA sub-nodes (below) is what makes own-list-only enforceable.

---

## What the hourly sync must change

The page is done; the sync that fills `cmh_followup_tracker` still needs four
changes. Roughly in order of how much they matter:

1. **Stop emitting `phone` and `address`.** The page no longer displays them, but
   they are still sitting in the database where any signed-in account can read
   them straight off the REST endpoint. Dropping them from the payload is the
   only thing that actually removes them. Delete the existing node once and let
   the sync rewrite it, or the old copies stay.

2. **Emit `jobNumber`.** The "Open in ServiceTitan" button only appears when the
   lead carries a job number. Right now most leads will not have one, so most
   cards will not show the button and the HCA has no way to reach the contact
   details from the page. This is the piece that makes removing phone and address
   painless instead of annoying.

3. **Read `cmh_followup_log` as the source of logged outcomes**, then retire the
   sheet receiver. Once the sync reads the database node, the transitional
   `no-cors` post to the Apps Script `/exec` URL comes out of the page. That
   receiver is unauthenticated — anyone who has seen the page source can post
   fake outcomes into it — so retiring it is a real fix, not tidying.

4. **Write the node as a signed-in writer account, not an anonymous token.** The
   rule above requires it. Create a dedicated Firebase Auth user for the sync and
   sign in as that account. While you are in there, split the leads into per-HCA
   sub-nodes (`cmh_followup_tracker/leads/<hca>/…`) so a later rule can restrict
   each HCA to their own list.

---

## Why any of this

Three things were true at once, and together they were the problem.

**The repository is public.** Everything committed to it is readable by anyone on
the internet. Ten older per-HCA tracker pages had customer data baked directly
into the HTML, which put names and addresses into the git history permanently.
That is the mistake this page is built to not repeat: it holds no data, only the
code that fetches it.

**The old page minted an anonymous token.** It called Firebase's anonymous
sign-up endpoint with the web API key printed in the page source. That key is a
public identifier, not a password — it is supposed to be visible. So anyone who
viewed source could mint the same token and pull the entire tracker node: every
HCA's customers, with phone numbers and street addresses. Google sign-in replaces
that with a token tied to a real person at a real company domain, which is
something a database rule can actually check.

**The write path lied.** The `no-cors` POST to the sheet cannot read its own
response, so the page printed "Logged" whether the save worked or not. An HCA who
logged a call into a dropped request would have every reason to believe it was
recorded. Now the checkmark means Firebase confirmed the write.

One thing worth being clear about: the domain check inside the page is a
courtesy, not a lock. Anyone can edit a page in their own browser. The database
rules are the actual protection, which is why step 3 above is the step that
matters most.
