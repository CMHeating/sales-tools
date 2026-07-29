# V0 Component Improvement Tracker

Track which tools have been improved with V0, and what's planned next.

## Status Legend
- ⬜ Not started
- 🟡 In progress (PR open)
- ✅ Complete (merged)
- 🔄 Iterating (feedback gathered)
- ⏳ Planned

---

## Tools Overview

### Home Screen (`index.html`)
**Status:** ⬜ Not started  
**V0 Template:** Template 1 (Home Screen)
**Key Improvements Needed:**
- [ ] Better mobile card layout
- [ ] Clearer tool descriptions
- [ ] Status indicators (online/offline)
- [ ] Search functionality
- [ ] Recent tool shortcuts

**Notes:** This is the entry point for all HCAs. High impact improvement.

---

### Field Guide (`hca-field-guide.html`)
**Status:** ⬜ Not started  
**V0 Template:** Template 2 (Field Guide Card Layout)
**Key Improvements Needed:**
- [ ] Add search/filter bar
- [ ] Organize into tabs (Financing, Rebates, Equipment, etc.)
- [ ] Collapsible cards for easier scanning
- [ ] Better mobile readability
- [ ] Copy-to-clipboard for key info
- [ ] Faster scroll performance (279KB file is large)

**Notes:** Most-used tool during sales calls. Mobile responsiveness critical.

---

### CaaS Quoting Tool (`hca-caas-quoting.html`)
**Status:** ⬜ Not started  
**V0 Template:** Custom (large calc form)
**Key Improvements Needed:**
- [ ] Better form layout on mobile
- [ ] Real-time validation
- [ ] Clearer input labels
- [ ] Results summary card
- [ ] Export to PDF

**Notes:** Used during customer conversations. Mobile-first essential.

---

### Install Availability Tracker (`install-availability-secure.html`)
**Status:** ⬜ Not started  
**V0 Template:** Template 4 (Install Availability Tracker)
**Key Improvements Needed:**
- [ ] Better calendar cell sizing
- [ ] Clearer status color legend
- [ ] Faster cell editing (reduce clicks)
- [ ] Mobile view for field technicians
- [ ] Better audit log visibility

**Notes:** Firebase-backed. Keep sync logic intact, update UI only.

---

### Follow-Up Leaderboard (`leaderboard.html`)
**Status:** ⬜ Not started  
**V0 Template:** Template 3 (Leaderboard)
**Key Improvements Needed:**
- [ ] Make responsive (currently desktop-only)
- [ ] Better auto-cycling UX
- [ ] Larger fonts for office display
- [ ] More prominent KPIs
- [ ] Mobile companion view

**Notes:** Office display tool. Should work on 1920x1080 AND mobile.

---

### Daily 1-on-1 Brief (`daily-brief.html`)
**Status:** ⬜ Not started  
**V0 Template:** Template 6 (Daily 1-on-1 Brief)
**Key Improvements Needed:**
- [ ] Print-friendly layout (fits on 1 page per HCA)
- [ ] Better data visualization
- [ ] Quick notes section
- [ ] Color-coded metrics
- [ ] Mobile view for on-the-go review

**Notes:** Used before manager meetings. Print layout is critical.

---

### Per-HCA Trackers (`tracker-[name].html`)
**Status:** ⬜ Not started  
**V0 Template:** Template 5 (Follow-Up Tracker)
**Key Improvements Needed:**
- [ ] Consistent layout across all 9 HCAs
- [ ] Better urgency color coding
- [ ] Quick-log buttons for activities
- [ ] Lead filtering by age/value
- [ ] Mobile-optimized (used during sales calls)

**HCAs:** Amber, Chester, Davis, Jay, Joe, Joseph, Kyle, Samir, Trevor

**Notes:** Highly used during workday. Mobile performance critical.

---

### Sold Job Tracker (`sold-job-tracker.html`)
**Status:** ⬜ Not started  
**V0 Template:** Custom (job status tracker)
**Key Improvements Needed:**
- [ ] Better status workflow
- [ ] Installation timeline view
- [ ] Payment status indicators
- [ ] Mobile view for field checks

**Notes:** Lower priority than follow-up tracker.

---

### Exec Summary (`exec-summary.html`)
**Status:** ⬜ Not started  
**V0 Template:** Custom (executive dashboard)
**Key Improvements Needed:**
- [ ] Better KPI tile design
- [ ] Clearer team performance table
- [ ] Highlight critical items
- [ ] Print-friendly layout

**Notes:** For Sr VP (Paul). High-polish appearance important.

---

## Priority Queue

### Phase 1: High Impact (User-Facing, Daily Use)
1. **Home Screen** (`index.html`) — Entry point for all HCAs
2. **Field Guide** (`hca-field-guide.html`) — Most-used reference
3. **Tracker-[name]** (`tracker-*.html`) — Personal tools used constantly

### Phase 2: Medium Impact (Specialized Use)
4. **Install Availability** (`install-availability-secure.html`) — Firebase-backed, needs care
5. **CaaS Quoting** (`hca-caas-quoting.html`) — Customer-facing tool

### Phase 3: Lower Priority (Strategic/Reporting)
6. **Leaderboard** (`leaderboard.html`) — Office display (less frequent changes)
7. **Daily Brief** (`daily-brief.html`) — Manager prep (weekly use)
8. **Exec Summary** (`exec-summary.html`) — Executive reporting (weekly use)

---

## Recent V0 Improvements

| Tool | PR | Change | Date | Status |
|---|---|---|---|---|
| — | — | (none yet) | — | — |

---

## Next Steps

### Immediate (Week of July 26, 2026)
- [ ] Set up V0 workflow (DONE — this guide)
- [ ] Pick first tool to improve (recommend: `index.html`)
- [ ] Write V0 prompt
- [ ] Generate designs
- [ ] Create feature branch
- [ ] Integrate code
- [ ] Test on phone
- [ ] Open PR

### Following Weeks
- [ ] Iterate based on feedback
- [ ] Improve Field Guide
- [ ] Improve Trackers
- [ ] Tackle Install Availability

---

## Notes & Ideas

### Design System Consistency
- All tools should use: Outfit font, navy (#0a1628), orange (#f58220)
- Ensure consistent spacing, shadows, border radius
- Dark theme should reduce eye strain in field

### Mobile-First Philosophy
- HCAs use phones during sales calls
- All tools must work on 6-inch screens
- Touch targets should be ≥44px
- No hover-dependent interactions

### Performance Considerations
- Field Guide (279KB) should be split or lazy-loaded
- Firebase tools should sync efficiently
- Google Sheets API calls should be debounced

### Accessibility
- All tools need ARIA labels
- Keyboard navigation required
- Color contrast ratio ≥7:1 (WCAG AAA)
- Form inputs should be properly labeled

### Future Enhancements (Not V0)
- Mobile app version (React Native/Flutter)
- Real-time notifications
- Offline mode support
- Analytics/usage tracking

---

**Last updated:** July 26, 2026  
**Maintained by:** Geoff (Sales Manager)  
**See also:** `V0-INTEGRATION.md`, `V0-WORKFLOW.md`
