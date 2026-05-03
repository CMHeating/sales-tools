# CM Heating Sales Operations Hub

> Follow-up accountability system for Home Comfort Advisors — built to drive conversion, documentation culture, and leadership visibility.

---

## What We Built

A complete weekly sales operations system connecting ServiceTitan data to daily follow-up accountability, live leaderboard display, and executive reporting.

---

## The Tools

### 1. Weekly Unsold Consult Tracker
**File:** `CM-Heating-Unsold-Tracker.html`

Generated fresh each week from a ServiceTitan Excel export. Each HCA gets their own tab showing open unsold consults ranked by urgency, with notes and status tracking.

**Urgency coding:**
- 🟢 0–3 days — Fresh, no action needed yet
- 🟡 4–7 days — First follow-up window
- 🟠 8–14 days — Hot window, needs contact now
- 🔴 15–21 days — Critical, dropping fast
- ⚫ 21+ days — At risk

**Weekly workflow:** Geoff exports unsold report from ServiceTitan → uploads to Claude → receives fresh HTML file → HCAs use it that week.

---

### 2. Follow-Up Leaderboard
**URL:** (https://cmheating.github.io/sales-tools/leaderboard.html)

Live office screen display. Auto-cycles every 15 seconds between Rankings and Detail view.

**Points system (conversion first):**
| Action | Points |
|--------|--------|
| Conversion | 100 pts |
| Early contact ≤3 days | 25 pts |
| Hot window 4–14 days | 15 pts |
| Documented entry | 20 pts |
| Follow-up attempt | 10 pts |
| Full sequence (4 attempts) | 50 pts |

---

### 3. HCA Daily Activity Log
**Sheet:** https://docs.google.com/spreadsheets/d/1cnPXu58HkWNV4EFJOeH48dxhGZsRFXLDzOJOty2uJTY/edit

One tab per HCA. After every follow-up attempt, each HCA logs one row:
- Date · Customer · Outcome · Next Step · Status

Takes 20 seconds. Feeds directly into daily reports.

**HCA Tabs:** Amber · Chester · Davis · Jay · Joe · Joseph · Kyle · Samir · Trevor

---

### 4. Daily 1-on-1 Brief
**URL:** (https://cmheating.github.io/sales-tools/daily-brief.html)

Geoff's daily prep tool. One card per HCA showing:
- Conversion rate, documentation rate, follow-up attempts (color coded)
- 4 oldest open leads with urgency and dollar value
- 3 talking points specific to that HCA

Print to PDF for in-person 1-on-1s.

---

### 5. Executive Summary
**URL:** https://cmheating.github.io/sales-tools/exec-summary.html

Weekly report for Paul (Sr VP) and Kailana (GM). One clean page with:
- 5 KPI tiles — pipeline value, conversion rate, attempts, doc compliance, critical leads
- Full team performance table with status badges
- Pipeline value by HCA
- Highlights and risks — who to celebrate, who needs coaching

---

## HCA Roster
| Name | Email |
|------|-------|
| Amber Maddalena | amber.maddalena@cmheating.com |
| Chester Granard | chester.granard@cmheating.com |
| Davis Diosdado | davis.diosdado@cmheating.com |
| Javierre Milo (Jay) | javierre.milo@cmheating.com |
| Joe Chounramany | jchounramany@cmheating.com |
| Joseph Ruble | joseph.ruble@cmheating.com |
| Kyle McAlister | kmcalister@cmheating.com |
| Samir Khoury | samir.khoury@cmheating.com |
| Trevor Bohm | trevor.bohm@cmheating.com |

---

## Weekly Workflow

```
Monday
  └── Geoff exports ServiceTitan unsold report → uploads to Claude
  └── Claude generates: Tracker + Leaderboard + Daily Brief + Exec Summary
  └── Geoff updates GitHub files (Ctrl+A → Ctrl+V → Commit)

Daily
  └── HCAs log follow-up activity in their Google Sheet tab
  └── Geoff opens Daily Brief before each 1-on-1

Weekly
  └── Geoff forwards Exec Summary to Paul + Kailana
  └── Leaderboard auto-updates on office screen
```

---

## Best Practice Follow-Up Timing

| Day | Action |
|-----|--------|
| Day 2–3 | First touch — stay top of mind, offer to answer questions |
| Day 7 | Second touch — value reinforcement, financing, warranty |
| Day 14 | Third touch — uncover real objection |
| Day 21 | Fourth touch — last serious attempt |
| Day 30+ | Nurture only — quarterly check-in |

> 80% of HVAC unsold consults are won or lost in days 2–14.

---

## Leadership

| Name | Role |
|------|------|
| Geoff Simons | Sales MGR |
| Paul | Sr VP |
| Kailana | GM |

---

*Built May 2026 — CM Heating Sales Operations* 
