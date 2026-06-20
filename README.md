# CM Heating Sales Operations Hub

Follow-up accountability system for Home Comfort Advisors — built to drive conversion, documentation culture, and leadership visibility.

## Live URLs

| Tool | URL |
|---|---|
| HCA Home Screen | https://cmheating.github.io/sales-tools/ |
| HCA Field Guide | https://cmheating.github.io/sales-tools/hca-field-guide.html |
| CaaS Quoting Tool | https://cmheating.github.io/sales-tools/hca-caas-quoting.html |
| Install Availability | https://install-availability-tracker.web.app/ |
| Follow-Up Leaderboard | https://cmheating.github.io/sales-tools/leaderboard.html |
| Daily 1-on-1 Brief | https://cmheating.github.io/sales-tools/daily-brief.html |
| Executive Summary | https://cmheating.github.io/sales-tools/exec-summary.html |

## The Tools

### 1. HCA Home Screen
**File:** `index.html`

Mobile-first home screen for HCAs. Links to all tools in one place.

---

### 2. HCA Field Guide / Command Center
**File:** `hca-field-guide.html`

HCA reference hub — scripts, objection handling, product info, and follow-up guidance in one page.

---

### 3. Comfort as a Service (CaaS) Quoting Tool
**File:** `hca-caas-quoting.html`

Interactive quoting tool for the CaaS membership program. HCAs enter system details and get Good/Better/Best pricing options with monthly payment breakdowns.

---

### 4. Install Availability Tracker
**Live:** https://install-availability-tracker.web.app/ (Firebase Hosting)
**Source:** `install-availability.html` → built to `install-availability-secure.html`

Real-time schedule and availability tracker for install coordinators and HCAs. Secured with Firebase Auth (Email/Password) — login with name + PIN.

See `INSTALL-AVAILABILITY-SECURITY.md` for build, deploy, and user management instructions.

---

### 5. Follow-Up Leaderboard
**File:** `leaderboard.html`

Live office screen display. Auto-cycles every 15 seconds between Rankings and Detail view.

**Points system:**

| Action | Points |
|---|---|
| Conversion | 100 pts |
| Early contact ≤3 days | 25 pts |
| Hot window 4–14 days | 15 pts |
| Documented entry | 20 pts |
| Follow-up attempt | 10 pts |
| Full sequence (4 attempts) | 50 pts |

---

### 6. Per-HCA Activity Trackers
**Files:** `tracker-[name].html`

Individual tracker pages for each HCA, pulling from the shared Google Sheet.

**HCA Tabs:** Amber · Chester · Davis · Jay · Joe · Joseph · Kyle · Samir · Trevor

Google Sheet: https://docs.google.com/spreadsheets/d/1cnPXu58HkWNV4EFJOeH48dxhGZsRFXLDzOJOty2uJTY/edit

---

### 7. Daily 1-on-1 Brief
**File:** `daily-brief.html`

Geoff's daily prep tool. One card per HCA showing:
- Conversion rate, documentation rate, follow-up attempts (color coded)
- 4 oldest open leads with urgency and dollar value
- 3 talking points specific to that HCA

Print to PDF for in-person 1-on-1s.

---

### 8. Executive Summary
**File:** `exec-summary.html`

Weekly report for Paul (Sr VP) and Kailana (GM). One page with:
- 5 KPI tiles — pipeline value, conversion rate, attempts, doc compliance, critical leads
- Full team performance table with status badges
- Pipeline value by HCA
- Highlights and risks

---

### 9. Weekly Unsold Consult Tracker
Generated on demand — not a static file in the repo.

**Workflow:** Geoff exports unsold report from ServiceTitan → uploads to Claude → receives fresh HTML file → HCAs use it that week.

**Urgency coding:**
- 🟢 0–3 days — Fresh, no action needed yet
- 🟡 4–7 days — First follow-up window
- 🟠 8–14 days — Hot window, needs contact now
- 🔴 15–21 days — Critical, dropping fast
- ⚫ 21+ days — At risk

## Weekly Workflow

**Monday**
- Geoff exports ServiceTitan unsold report → uploads to Claude
- Claude generates fresh Tracker + updates to Leaderboard / Daily Brief / Exec Summary
- Geoff updates GitHub files (Ctrl+A → Ctrl+V → Commit)

**Daily**
- HCAs log follow-up activity in their Google Sheet tab
- Geoff opens Daily Brief before each 1-on-1

**Weekly**
- Geoff forwards Exec Summary to Paul + Kailana
- Leaderboard auto-updates on office screen

## Best Practice Follow-Up Timing

| Day | Action |
|---|---|
| Day 2–3 | First touch — stay top of mind, offer to answer questions |
| Day 7 | Second touch — value reinforcement, financing, warranty |
| Day 14 | Third touch — uncover real objection |
| Day 21 | Fourth touch — last serious attempt |
| Day 30+ | Nurture only — quarterly check-in |

80% of HVAC unsold consults are won or lost in days 2–14.

## HCA Roster

| Name | Email |
|---|---|
| Amber Maddalena | amber.maddalena@cmheating.com |
| Chester Granard | chester.granard@cmheating.com |
| Davis Diosdado | davis.diosdado@cmheating.com |
| Javierre Milo (Jay) | javierre.milo@cmheating.com |
| Joe Chounramany | jchounramany@cmheating.com |
| Joseph Ruble | joseph.ruble@cmheating.com |
| Kyle McAlister | kmcalister@cmheating.com |
| Samir Khoury | samir.khoury@cmheating.com |
| Trevor Bohm | trevor.bohm@cmheating.com |

## Leadership

| Name | Role |
|---|---|
| Geoff Simons | Sales MGR |
| Paul | Sr VP |

---
Built May 2026 — CM Heating Sales Operations
