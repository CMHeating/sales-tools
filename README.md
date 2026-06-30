# CM Heating Sales Operations Hub

Follow-up accountability system and HCA tool hub for Home Comfort Advisors — built to drive conversion, documentation culture, rental/CaaS process discipline, and leadership visibility.

## Live URLs

| Tool | URL |
|---|---|
| HCA Home Screen | https://cmheating.github.io/sales-tools/ |
| HCA Field Guide | https://cmheating.github.io/sales-tools/hca-field-guide.html |
| CaaS Quoting Tool | https://cmheating.github.io/sales-tools/hca-caas-quoting.html |
| Invest the Difference / HYSA Beta | https://cmheating.github.io/sales-tools/hca-hysa-rental-quote-tool.html |
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

HCA reference hub — scripts, objection handling, product info, financing/credit rules, ownership documentation, permitting, electrical review, rebates, equipment fit, warranty guidance, and escalation paths.

Current Field Guide sections include financing/credit, rebates, outdoor placement, jurisdictions, electrical, labor timing, ductless/Mitsubishi, equipment-specific rules, warranty/permits, objections/scripts, fireplace rules, copy-to-ServiceTitan notes, and escalation contacts.

---

### 3. Comfort as a Service (CaaS) Quoting Tool
**File:** `hca-caas-quoting.html`

Interactive quoting tool for the CaaS membership program. HCAs enter system details and get Good/Better/Best pricing options with monthly payment breakdowns.

---

### 4. Invest the Difference / HYSA Rent vs Buy Beta
**File:** `hca-hysa-rental-quote-tool.html`

Beta quoting aid showing the customer impact of keeping the HVAC purchase price invested in a HYSA instead of paying cash up front.

Current beta features:

- Editable package price and monthly rental payment.
- HYSA APY selector in whole-number percentages.
- Free-month promo value calculation.
- 15-year / 180-month compounding projection table.
- Residual month selector from month 1 to month 180.
- Auto-updating straight-line residual calculation.
- Manual residual override.
- Monthly payment difference column showing how average monthly interest offsets average monthly rent paid.
- Copyable customer summary.

Default example used for testing:

| Input | Value |
|---|---:|
| Package price | $21,499 |
| Monthly rental payment | $259.99 |
| HYSA APY | 4% |
| Free months | 3 |
| Contract term | 180 months |
| Default residual checkpoint | Month 96 |
| Month-96 residual | $10,032.87 |

Residual formula:

```text
Package Price × Remaining Months ÷ Contract Term
```

Example:

```text
$21,499 × 84 ÷ 180 = $10,032.87
```

---

### 5. Install Availability Tracker
**Live:** https://install-availability-tracker.web.app/ (Firebase Hosting)  
**Source:** `install-availability.html` → built to `install-availability-secure.html`

Real-time schedule and availability tracker for install coordinators and HCAs. Secured with Firebase Auth (Email/Password) — login with name + PIN.

See `INSTALL-AVAILABILITY-SECURITY.md` for build, deploy, and user management instructions.

---

### 6. Follow-Up Leaderboard
**File:** `leaderboard.html`

Live office screen display. Auto-cycles every 15 seconds between Rankings and Detail view.

**Points system:**

| Action | Points |
|---|---:|
| Conversion | 100 pts |
| Early contact ≤3 days | 25 pts |
| Hot window 4–14 days | 15 pts |
| Documented entry | 20 pts |
| Follow-up attempt | 10 pts |
| Full sequence (4 attempts) | 50 pts |

---

### 7. Per-HCA Activity Trackers
**Files:** `tracker-[name].html`

Individual tracker pages for each HCA, pulling from the shared Google Sheet.

**HCA Tabs:** Amber · Chester · Davis · Jay · Joe · Joseph · Kyle · Samir · Trevor

Google Sheet: https://docs.google.com/spreadsheets/d/1cnPXu58HkWNV4EFJOeH48dxhGZsRFXLDzOJOty2uJTY/edit

---

### 8. Daily 1-on-1 Brief
**File:** `daily-brief.html`

Geoff's daily prep tool. One card per HCA showing:

- Conversion rate, documentation rate, follow-up attempts (color coded)
- 4 oldest open leads with urgency and dollar value
- 3 talking points specific to that HCA

Print to PDF for in-person 1-on-1s.

---

### 9. Executive Summary
**File:** `exec-summary.html`

Weekly report for Paul (Sr VP). One page with:

- 5 KPI tiles — pipeline value, conversion rate, attempts, doc compliance, critical leads
- Full team performance table with status badges
- Pipeline value by HCA
- Highlights and risks

---

### 10. Weekly Unsold Consult Tracker
Generated on demand — not a static file in the repo.

**Workflow:** Geoff exports unsold report from ServiceTitan → uploads to Claude/ChatGPT → receives fresh HTML file → HCAs use it that week.

**Urgency coding:**

- 🟢 0–3 days — Fresh, no action needed yet
- 🟡 4–7 days — First follow-up window
- 🟠 8–14 days — Hot window, needs contact now
- 🔴 15–21 days — Critical, dropping fast
- ⚫ 21+ days — At risk

## ServiceTitan Rental Process SOP

This is the Field Guide card requested by Samir. The card should be named **ServiceTitan Rental Process** and should live inside `hca-field-guide.html`.

### Required process for HCAs

1. **DL capture**  
   Capture a clear driver’s license copy/photo for all homeowner(s) required to sign. The DL is the source of truth for legal-name spelling.

2. **Mortgage statement or deed verification**  
   Collect the most recent mortgage statement if there is an active mortgage. If the home is paid off, collect the deed. If the mortgage statement shows two homeowners, verify both names against DL capture and ensure spelling is exact.

3. **Trust handling**  
   If the home is held in a trust, list the trust first and the executor/trustee as the secondary name. This is rare and should be escalated if unclear.

4. **County assessor verification**  
   Verify current named owners on the county assessor website. Link Snohomish, King, and Pierce County assessor sites in the card. The assessor is a verification step, but it does not replace the deed when the home is paid off because assessor records can lag.

5. **Add estimate in ServiceTitan**  
   Add the rental / CaaS estimate in ServiceTitan. The rental package must be within the first five estimates. A la carte estimates in the first five positions can create contract generation/import issues.

6. **Credit authorization and credit pull**  
   Have homeowner(s) complete the ServiceTitan credit authorization form. Use the existing Equifax credit pull link already built in the HCA Toolkit; the new Field Guide card should link directly to it.

7. **Second-look escalation**  
   Email `credit@reliableair.com` for second-look review when credit is near 640, when the payment is above the current internal limit, or when the credit result is unclear. Current payment review threshold: $239.99/month until updated.

8. **Contract generation and signature**  
   Generate the rental contract from ServiceTitan. Verify homeowner names, property address, rental package, monthly payment, term/residual language, and separation of COD extras before signature. All required homeowners must sign.

9. **Penny test**  
   Complete the penny test form in ServiceTitan. This verifies the card used for monthly rental payments. Rental setup is not complete until the penny test passes.

10. **Final confirmation**  
    Confirm DL capture, ownership documents, assessor verification, credit authorization, credit pull, second-look review if needed, rental estimate, signed contract, passed penny test, and ServiceTitan notes.

### Rental-process escalation path

Escalate to **Geoff or Amy** if:

- Homeowner name does not match DL / mortgage / deed / assessor.
- One listed owner is missing.
- Property is in a trust and signer setup is unclear.
- Credit is near 640.
- Payment is above the current internal limit.
- Contract does not generate correctly.
- A la carte estimates interfere with the first five estimate slots.
- Penny test fails.
- HCA is unsure whether the rental file is complete.

## Weekly Workflow

**Monday**

- Geoff exports ServiceTitan unsold report → uploads to Claude/ChatGPT
- Claude/ChatGPT generates fresh Tracker + updates to Leaderboard / Daily Brief / Exec Summary
- Geoff updates GitHub files (Ctrl+A → Ctrl+V → Commit)

**Daily**

- HCAs log follow-up activity in their Google Sheet tab
- Geoff opens Daily Brief before each 1-on-1

**Weekly**

- Geoff forwards Exec Summary to Paul
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

## Leadership / Escalation

| Name | Role |
|---|---|
| Geoff Simons | Sales Manager |
| Amy Liebel | Install Coordinator |
| Paul | Sr VP |

## Repository Working Rules

- Read the current file before editing.
- Prefer complete-file replacements for HTML tool updates.
- Keep public pages free of passwords, dealer portal credentials, private PINs, customer data, and protected login details.
- Keep HCA tools consolidated under `sales-tools` unless there is a deliberate repo-level reason to split them.

---

Built May 2026 — CM Heating Sales Operations
