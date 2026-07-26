# V0 Integration Guide

This guide explains how to use V0 (Vercel's design-to-code tool) to improve and generate UI components for the CM Heating Sales Tools.

## Quick Start

### What is V0?
V0 is an AI-powered UI builder that generates React/HTML components from design descriptions or screenshots. It's perfect for:
- Rapid component prototyping
- Responsive layout refinement
- Accessibility improvements
- Design consistency updates
- Interactive feature development

### How to Use V0 with This Repo

1. **Go to** https://v0.dev
2. **Paste or describe** what you want to build (see templates below)
3. **Copy the generated code**
4. **Adapt for this project** (convert to vanilla JS or integrate into existing HTML)
5. **Test locally** → Commit to GitHub → Deploy

## V0 Prompt Templates

Use these prompts to get the best results. Customize as needed.

### Template 1: Home Screen (`index.html`)

```
Create a mobile-first dashboard home screen for HVAC sales team tools.

Design requirements:
- Header: CM Heating logo + "HCA Tools" title + current time/date
- Dark navy background (#0a1628)
- Orange accent color (#f58220)
- Card grid with 12 tool shortcuts:
  1. ServiceTitan Comfort Club Rental Process (🚨)
  2. Comfort Club vs. Buy (💰)
  3. HCA CaaS Quoting Tool (🧾)
  4. HCA Top Sellers (🏆)
  5. Install Availability (📅)
  6. My Follow-Up Tracker (📋)
  7. My Sold Job Tracker (✅)
  8. Book HCA 1:1 (🤝)
  9. Equifax Credit Check (💳)
  10. RISE 2.0 (🔥)
  11. Invest the Difference (📈)
  12. HCA Field Guide (📚)

Each card should:
- Show icon, title, 1-line description
- Be clickable (link or open modal for name selection)
- Use Outfit font family
- Have hover state with subtle highlight
- Support touch on mobile

Footer: "CM Heating · Internal HCA Tool · Not for distribution"
```

### Template 2: Field Guide Card Layout

```
Create a collapsible card-based reference guide for HVAC sales training.

Design requirements:
- Dark theme (navy #0a1628, white text)
- Search bar at top
- Category tabs: Financing · Rebates · Equipment · Warranty · Objections · Process
- Cards within each category (expand/collapse)
- Each card has:
  - Bold title
  - Bullet points or numbered steps
  - Icons or color-coded badges
  - Optional "copy to clipboard" button

Example sections:
- Financing Rules
- Credit Thresholds
- Rebate Eligibility
- Equipment Specs
- Objection Handling
- ServiceTitan Rental Process

Make it fast to scan and reference during a sales call.
```

### Template 3: Leaderboard (Office Display)

```
Create a real-time leaderboard dashboard for office display (auto-cycles).

Design requirements:
- Full-screen layout (1920x1080)
- Dark theme with orange accents
- Two views that auto-cycle every 15 seconds:

View 1: Rankings Table
- HCA name | Conversion Rate | Follow-Up Attempts | Doc Compliance | Points
- Green badge for top performer
- Color-coded status badges

View 2: Individual Details
- Single HCA spotlight
- Big KPI tiles (Conversion, Doc Rate, Attempts)
- 4 oldest open leads (card format: lead age, value, urgency)
- 3 talking points
- Auto-cycle through HCAs

Typography: Large, readable from distance (10+ ft)
Refresh data every 30 seconds
```

### Template 4: Install Availability Tracker

```
Create a weekly schedule grid for HVAC install coordination.

Design requirements:
- 3-week view (current + next 2 weeks)
- Each week: 6-day grid (Mon–Sat)
- Rows: Installation crews + On-Call techs
- Cell statuses:
  - FILLED (red) / FULL DAY AVAIL (green) / HALF DAY AM (yellow) / HALF DAY PM (orange)
  - NOT AVAILABLE (gray) / TEAM OFF (dark) / ON CALL (blue) / HOLD (purple)
- Admin mode: Click cell to edit status
- Show which team/crew + HCA name + job details
- Lock mechanism: Show when another user is editing
- Audit log: Track changes (who, when, what)
- Color legend at bottom

Dark theme, monospace font for data entry
```

### Template 5: Follow-Up Tracker

```
Create a personal activity tracker for HCA follow-ups.

Design requirements:
- Lead list: Age | Customer Name | Value | Last Contact | Next Action
- Color-coded urgency:
  - 0–3 days (green) / 4–7 days (yellow) / 8–14 days (orange) / 15+ days (red)
- Quick-log buttons: "Contacted" / "Left VM" / "Email Sent" / "Scheduled"
- Filters: By age, status, value
- Stats row: Total leads | Conversion rate | Follow-ups completed this week
- One-click details: Click lead to see full history + notes
- Print to PDF option

Responsive: Works on phone during sales calls
```

### Template 6: Daily 1-on-1 Brief

```
Create a one-page sales manager prep tool.

Design requirements:
- Card per HCA showing:
  - Name + photo placeholder
  - Conversion rate (%) + status badge
  - Follow-up attempts count
  - Doc compliance (%)
  - 4 oldest open leads (compact table)
  - 3 talking points (bullet list)
  - One key metric highlight

Print-friendly layout (fits on 1 page per HCA)
Designed for manager to review before 1-on-1 meeting
Dark theme, clear hierarchy
```

## V0 Workflow for This Project

### Step 1: Describe Your Improvement
```
Use the templates above, or describe what you want:
"Improve the home screen card grid to show active/inactive status for each tool"
"Add a search bar to the field guide"
"Make the leaderboard mobile-responsive"
```

### Step 2: Generate in V0
- Paste your prompt into https://v0.dev
- V0 generates React or HTML
- Preview and iterate ("Make cards bigger", "Add a back button", etc.)

### Step 3: Extract Code
V0 gives you clean, modular code. Choose the extraction that fits this project:
- **Vanilla JS version** (for single-file HTML tools)
- **React component** (if we add a build step later)
- **Copy the CSS + HTML structure**

### Step 4: Integrate into Project
Depending on the tool:

#### For Self-Contained HTML Tools (Most Common)
1. Copy the HTML structure from V0
2. Update CSS to match our dark theme variables
3. Replace React hooks with vanilla JS
4. Test locally
5. Commit + deploy

Example adaptation:
```javascript
// V0 generates: const [isOpen, setIsOpen] = useState(false)
// We use:      let isOpen = false; function toggleOpen() { isOpen = !isOpen; ... }
```

#### For Firebase Tools (Install Availability)
1. Keep the UI structure from V0
2. Integrate with existing Firebase listeners
3. Update the data binding logic
4. Test sync + collisions

### Step 5: Submit PR
- Branch name: `v0/[tool-name]-improvement`
- PR title: `V0: Improve [tool name] — [specific change]`
- Description: Link to V0 design, before/after comparison
- Test on mobile + desktop

## Design System Reference

### Colors
- **Background:** `#0a1628` (dark navy)
- **Surface:** `#0f1d2d` (slightly lighter)
- **Surface 2:** `#1a2a3a` (for cards)
- **Accent:** `#f58220` (orange) / `#c97d10` (darker hover)
- **Text:** `#ffffff` (white)
- **Text secondary:** `#a0aec0` (muted)
- **Text tertiary:** `#64748b` (very muted)
- **Success:** `#16a34a` (green)
- **Warning:** `#f59e0b` (amber)
- **Error:** `#dc2626` (red)

### Typography
- **Font stack:** Outfit, IBM Plex Sans, sans-serif
- **Headings:** Outfit Bold (700–800)
- **Body:** Outfit Regular (400–500)
- **Monospace:** IBM Plex Mono (for data tables)

### Spacing
- **Base unit:** 8px
- **Padding:** 12px, 16px, 20px, 24px
- **Gaps:** 8px (tight), 12px (normal), 16px (loose)

### Borders & Radius
- **Radius:** 6px (small), 10px (medium), 14px (large)
- **Border color:** `#2d3748` (dark)

### Shadows
- **Subtle:** `0 4px 6px rgba(0,0,0,0.1)`
- **Medium:** `0 10px 15px rgba(0,0,0,0.2)`
- **Heavy:** `0 20px 25px rgba(0,0,0,0.3)`

## Common Improvements to Request from V0

- ✅ **Responsive mobile-first design**
- ✅ **Improved accessibility** (ARIA labels, keyboard nav, color contrast)
- ✅ **Loading states** (spinners, skeletons)
- ✅ **Empty states** (helpful messages when no data)
- ✅ **Error handling** (clear error messages, retry buttons)
- ✅ **Micro-interactions** (hover effects, transitions)
- ✅ **Better touch targets** (min 44x44px for mobile)
- ✅ **Dark mode optimization** (readability, eye comfort)

## Examples of V0 Improvements We've Done

| Tool | Improvement | Result |
|---|---|---|
| index.html | Redesigned card grid with better spacing | Mobile-friendly, faster scanning |
| hca-field-guide.html | Added search + tabs | Easier to find info during calls |
| leaderboard.html | Made responsive + added detail drawer | Works on all screen sizes |
| install-availability.html | Improved cell editing UX | Fewer clicks, clearer status |

## Tips & Tricks

1. **Be specific:** "Dark theme with orange accents" beats "make it look modern"
2. **Provide constraints:** "Must work on 6-inch phone screens" + "Must fit 100 HCAs per page"
3. **Reference the existing design:** "Match the style of CM Heating's current tools"
4. **Test variations:** Generate 2–3 versions, pick the best
5. **Iterate:** Use V0's feedback loop — don't settle on v1

## Next Steps

1. Pick a tool to improve (start with `index.html` or `hca-field-guide.html`)
2. Choose a prompt template above (or write your own)
3. Go to https://v0.dev → paste prompt → iterate
4. Copy code → adapt → test → commit
5. Open PR for review

**Questions?** See `CLAUDE.md` or `README.md` for project context.

---

**Last updated:** July 26, 2026
