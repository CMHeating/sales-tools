/**
 * CM Heating — Gmail triage (rules only, labels only).
 *
 * Replaces the hourly Codex triage automation. No AI model, no tokens, nothing
 * leaves Google. Ported from the deterministic rules in goose_gmail_triage.py
 * and the 2026-09-21 hourly-gmail-triage handoff.
 *
 * WHAT IT DOES
 *   Every hour it looks at inbox messages from the last 26 hours that carry none
 *   of the four Triage/* labels, and adds exactly one label when a rule is sure.
 *   Anything a rule is not sure about gets NO label and stays in the inbox as-is.
 *
 * WHAT IT NEVER DOES
 *   Archive, delete, trash, move, star, mark read/unread, send, draft, reply,
 *   forward, create labels, or remove any label. The only mailbox write in this
 *   file is addTriageLabel_().
 *
 * SETUP (once, in a NEW standalone Apps Script project owned by the mailbox owner)
 *   1. Paste this file as Code.gs.
 *   2. Services (+) → add "Gmail API" (identifier: Gmail).
 *   3. Project Settings → Script properties:
 *        TRIAGE_ACCOUNT   the mailbox address this must run as (refuses otherwise)
 *        TRIAGE_MODE      dry      (logs what it WOULD do; change to apply later)
 *        TRIAGE_MGMT_FROM optional: the internal sender whose "New event
 *                         notification" mail is automated
 *   4. Run testRules (no mailbox access). Every line must say PASS.
 *   5. Run triageRun once, approve the Gmail permission, read the log.
 *   6. Run installHourlyTrigger.
 *   Leave TRIAGE_MODE=dry while the old Codex job still runs. Two writers can
 *   race and put two labels on one message. Turn the Codex job off first, then
 *   set TRIAGE_MODE=apply.
 *
 * No email addresses of staff live in this file on purpose (the repo is public);
 * they come from Script properties.
 */

var LABELS = {
  Action: 'Triage/Action Needed',
  FYI: 'Triage/FYI - Informational',
  Automated: 'Triage/Automated - Notifications',
  Promotions: 'Triage/Newsletters & Promotions'
};
var WINDOW_QUERY = 'in:inbox newer_than:26h';
var MAX_PER_RUN = 150;              // stays well inside the 6-minute limit
var PROMO_DOMAINS = ['nextdoor.com', 'tripadvisor.com', 'ground-news.com', 'bloomberg.com',
  'news.weather.com', 'jackery.com', 'redditmail.com'];

// ---------------------------------------------------------------- entry points

function triageRun() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) { console.log('Another run is in progress; skipping.'); return; }
  try {
    var props = PropertiesService.getScriptProperties();
    var account = checkAccount_(props.getProperty('TRIAGE_ACCOUNT'));
    var mode = (props.getProperty('TRIAGE_MODE') || 'dry').toLowerCase();
    var apply = mode === 'apply';
    var ids = resolveLabelIds_();
    var triageIds = Object.keys(ids).map(function (k) { return ids[k]; });
    var cfg = { account: account, mgmtFrom: (props.getProperty('TRIAGE_MGMT_FROM') || '').toLowerCase() };

    var counts = { Action: 0, FYI: 0, Automated: 0, Promotions: 0, unsure: 0, skipped: 0 };
    var actionSubjects = [];
    var done = 0;
    listIds_(WINDOW_QUERY).forEach(function (id) {
      if (done >= MAX_PER_RUN) return;
      var msg = Gmail.Users.Messages.get('me', id, {
        format: 'metadata', metadataHeaders: ['From', 'To', 'Cc', 'Subject', 'List-Unsubscribe']
      });
      var before = msg.labelIds || [];
      var already = before.filter(function (l) { return triageIds.indexOf(l) >= 0; });
      if (before.indexOf('INBOX') < 0 || already.length) {
        if (already.length > 1) console.warn('Message ' + id + ' has ' + already.length + ' triage labels; left alone.');
        counts.skipped++;
        return;
      }
      done++;
      var cat = classify_(msg, cfg);
      if (!cat) { counts.unsure++; return; }
      counts[cat]++;
      if (cat === 'Action') actionSubjects.push(clean_(header_(msg, 'subject')));
      if (apply) addTriageLabel_(id, ids[cat], before, triageIds);
    });

    console.log((apply ? 'APPLIED' : 'DRY RUN') + ' — Action ' + counts.Action + ', FYI ' + counts.FYI +
      ', Automated ' + counts.Automated + ', Promotions ' + counts.Promotions +
      ', left unlabeled (unsure) ' + counts.unsure + ', already triaged ' + counts.skipped +
      (done >= MAX_PER_RUN ? ' — hit the per-run cap; the next run continues.' : ''));
    if (actionSubjects.length) console.log('Action Needed:\n- ' + actionSubjects.join('\n- '));
  } finally {
    lock.releaseLock();
  }
}

function installHourlyTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'triageRun') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('triageRun').timeBased().everyHours(1).create();
  console.log('Hourly trigger installed (exactly one).');
}

function removeTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'triageRun') ScriptApp.deleteTrigger(t);
  });
  console.log('Trigger removed. Triage is off.');
}

// ---------------------------------------------------------------- the rules

/** Returns 'Action' | 'Promotions' | 'Automated' | 'FYI', or null when unsure. */
function classify_(msg, cfg) {
  var from = header_(msg, 'from');
  var sender = addr_(from);
  var subject = header_(msg, 'subject').toLowerCase();
  var snippet = String(msg.snippet || '').replace(/\s+/g, ' ').toLowerCase().slice(0, 230);
  var labels = msg.labelIds || [];
  var personal = personallyAddressed_(msg, cfg.account, snippet);

  // 1. Action first: a personal task outranks every other category.
  if (/^\W*spot-check needed/.test(subject)) return 'Action';
  if (personal && /\b(geoff(rey)?[, :]+)?please approve\b|\byou still owe\b/.test(snippet)) return 'Action';

  // 2. Promotions.
  if (labels.indexOf('CATEGORY_PROMOTIONS') >= 0 || labels.indexOf('CATEGORY_SOCIAL') >= 0) return 'Promotions';
  if (PROMO_DOMAINS.some(function (d) { return sender.slice(-d.length) === d; })) return 'Promotions';

  // 3. Automated.
  if (sender === 'alerts@servicetitan.com') return 'Automated';
  if (subject.indexOf('growth auto —') === 0) return 'Automated';
  if (cfg.mgmtFrom && subject.indexOf('new event notification') === 0 && from.toLowerCase().indexOf(cfg.mgmtFrom) >= 0) return 'Automated';
  if (/@contractorcommerce\.com$/.test(sender) && subject.indexOf('invoice') >= 0) return 'Automated';
  if (sender.indexOf('geotab') >= 0) return 'Automated';
  if (/no-?reply|no_reply/.test(sender) && !header_(msg, 'list-unsubscribe')) return 'Automated';

  // 4. Not addressed to the owner: awareness only.
  if (!personal) return 'FYI';

  // 5. Addressed to the owner with a clear request: Action.
  if (/\b(can you|could you|need you|your approval|please (review|confirm|reply|respond|call|send|advise|sign|let me know))\b/.test(snippet)) return 'Action';

  // 6. Addressed to the owner, no clear signal: unsure. No label; it stays in the inbox.
  return null;
}

function personallyAddressed_(msg, account, snippet) {
  var to = header_(msg, 'to').toLowerCase();
  var cc = header_(msg, 'cc').toLowerCase();
  return to.indexOf(account) >= 0 ||
    (cc.indexOf(account) >= 0 && /\bgeoff(rey)?[, :]+(please|can you|could you|need you)\b/.test(snippet));
}

// ---------------------------------------------------------------- Gmail helpers

function checkAccount_(expected) {
  if (!expected) throw new Error('Set the TRIAGE_ACCOUNT script property first.');
  var actual = String(Gmail.Users.getProfile('me').emailAddress || '').toLowerCase();
  if (actual !== expected.toLowerCase()) throw new Error('Running as the wrong mailbox; refusing to label.');
  return actual;
}

function resolveLabelIds_() {
  var byName = {};
  (Gmail.Users.Labels.list('me').labels || []).forEach(function (l) {
    if (l.type === 'user') byName[l.name] = l.id;
  });
  var ids = {};
  Object.keys(LABELS).forEach(function (k) {
    if (!byName[LABELS[k]]) throw new Error('Label missing: ' + LABELS[k] + ' — refusing to create labels.');
    ids[k] = byName[LABELS[k]];
  });
  return ids;
}

function listIds_(q) {
  var out = [], token = null;
  do {
    var res = Gmail.Users.Messages.list('me', { q: q, maxResults: 500, pageToken: token });
    (res.messages || []).forEach(function (m) { out.push(m.id); });
    token = res.nextPageToken;
  } while (token);
  return out;
}

/** The only mailbox write: add one triage label, then read back and verify. */
function addTriageLabel_(id, labelId, before, triageIds) {
  if (triageIds.indexOf(labelId) < 0) throw new Error('Refusing a non-triage label.');
  Gmail.Users.Messages.modify({ addLabelIds: [labelId], removeLabelIds: [] }, 'me', id);
  var after = Gmail.Users.Messages.get('me', id, { format: 'minimal' }).labelIds || [];
  var triageAfter = after.filter(function (l) { return triageIds.indexOf(l) >= 0; });
  var otherBefore = before.filter(function (l) { return triageIds.indexOf(l) < 0; }).sort().join(',');
  var otherAfter = after.filter(function (l) { return triageIds.indexOf(l) < 0; }).sort().join(',');
  if (triageAfter.length !== 1 || triageAfter[0] !== labelId) throw new Error('Verify failed on ' + id + ': triage labels ' + triageAfter.join(','));
  if (otherBefore !== otherAfter) throw new Error('Verify failed on ' + id + ': other labels changed.');
}

function header_(msg, name) {
  var hs = (msg.payload && msg.payload.headers) || [];
  for (var i = 0; i < hs.length; i++) if (String(hs[i].name).toLowerCase() === name) return String(hs[i].value || '');
  return '';
}

function addr_(from) {
  var m = String(from).match(/<([^>]+)>/);
  return (m ? m[1] : String(from)).trim().toLowerCase();
}

function clean_(s) { return String(s).replace(/[\u0000-\u001f\u007f-\u009f]/g, '').slice(0, 120); }

// ---------------------------------------------------------------- self-test (no mailbox access)

function testRules() {
  var me = 'owner@example.com';
  var cfg = { account: me, mgmtFrom: 'mgmt@example.com' };
  function s(from, to, subject, snippet, labels, cc, unsub) {
    var h = [{ name: 'From', value: from }, { name: 'To', value: to }, { name: 'Subject', value: subject }];
    if (cc) h.push({ name: 'Cc', value: cc });
    if (unsub) h.push({ name: 'List-Unsubscribe', value: '<mailto:x@y>' });
    return { snippet: snippet || '', labelIds: labels || ['INBOX'], payload: { headers: h } };
  }
  var cases = [
    ['ServiceTitan alert', s('alerts@servicetitan.com', me, 'Booked Job Alert'), 'Automated'],
    ['Approval to owner', s('Amy <amy@x.com>', me, 'Rebate', 'Geoff, please approve this'), 'Action'],
    ['Approval to someone else', s('Amy <amy@x.com>', 'Joe <joe@x.com>', 'Rebate', 'Please approve'), 'FYI'],
    ['CC with named ask', s('Amy <amy@x.com>', 'amy@x.com', 'Rebate', 'Geoffrey, please approve this rebate', null, me), 'Action'],
    ['CC, team ask', s('Amy <amy@x.com>', 'amy@x.com', 'Rebate', 'Team, please approve this rebate', null, me), 'FYI'],
    ['Gmail promotions tab', s('News <news@example.com>', me, 'Sale', '', ['INBOX', 'CATEGORY_PROMOTIONS']), 'Promotions'],
    ['Promo domain', s('Nextdoor <reply@rs.email.nextdoor.com>', me, 'Digest'), 'Promotions'],
    ['Spot-check beats automated', s('noreply@x.com', me, '🔧 Spot-check needed: install 10/21'), 'Action'],
    ['No-reply, no unsubscribe', s('no-reply@vendor.com', me, 'Your report'), 'Automated'],
    ['No-reply with unsubscribe is not auto', s('no-reply@vendor.com', 'list@vendor.com', 'Newsletter', '', null, null, true), 'FYI'],
    ['Mgmt event notice', s('Mgmt <mgmt@example.com>', me, 'New event notification: meeting'), 'Automated'],
    ['Direct, clear request', s('Kyle <k@x.com>', me, 'Quote', 'Can you look at this quote before 3?'), 'Action'],
    ['Direct, no signal = unsure', s('Kyle <k@x.com>', me, 'Thanks', 'Got it, thanks for the help today'), null],
    ['Growth auto', s('robot@x.com', me, 'Growth Auto — 10/21'), 'Automated']
  ];
  var fails = 0;
  cases.forEach(function (c) {
    var got = classify_(c[1], cfg);
    var ok = got === c[2];
    if (!ok) fails++;
    console.log((ok ? 'PASS ' : 'FAIL ') + c[0] + ' → ' + got + (ok ? '' : ' (expected ' + c[2] + ')'));
  });
  console.log(fails ? fails + ' FAILED' : 'ALL ' + cases.length + ' PASS');
  if (fails) throw new Error(fails + ' rule tests failed');
}
