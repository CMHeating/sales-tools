# V0 Workflow: Step-by-Step Process

This document walks through the complete workflow for using V0 to improve HCA Tools.

## Phase 1: Planning

### 1.1 Identify the Tool
Choose what to improve:
- [ ] `index.html` — Home screen
- [ ] `hca-field-guide.html` — Field guide
- [ ] `leaderboard.html` — Office leaderboard
- [ ] `install-availability.html` — Schedule tracker
- [ ] `daily-brief.html` — Manager prep tool
- [ ] `tracker-[name].html` — Individual tracker
- [ ] Other: ___________

### 1.2 Define the Problem
What needs improvement?
- [ ] Mobile responsiveness
- [ ] Accessibility
- [ ] Performance
- [ ] Visual design
- [ ] Usability/UX flow
- [ ] New feature
- [ ] Other: ___________

### 1.3 Set Success Criteria
How will you know it's better?
- Example: "Faster to load on 4G"
- Example: "Works perfectly on iPhone 12"
- Example: "Field guide search finds info in <2 seconds"

Your criteria:
1. _________________
2. _________________
3. _________________

## Phase 2: Design in V0

### 2.1 Open V0
1. Go to https://v0.dev
2. Sign in (or create account)
3. Click "Create new"

### 2.2 Paste Prompt
Use the templates from `V0-INTEGRATION.md` or write your own.

**Example prompt for home screen improvement:**
```
I'm improving a sales team dashboard. The current design works but:
- Cards are too cramped on mobile
- Icons are hard to tap
- No indication of tool status

Please redesign the card grid to:
- Larger touch targets (min 48px)
- Better spacing between cards
- Show a small status indicator (online/offline) for each tool
- Keep dark navy (#0a1628) background + orange (#f58220) accents
- Use Outfit font family
- Make it mobile-first
```

### 2.3 Iterate with V0
V0 will generate code. Use these prompts to refine:
- "Make the cards bigger"
- "Add a back button"
- "Show a loading spinner"
- "Improve the color contrast"
- "Add keyboard navigation"
- "Make this work on tablets too"

Take 5–10 iterations until you're happy.

### 2.4 Review Generated Code
V0 typically outputs:
- HTML structure
- Inline CSS (often with Tailwind)
- React or vanilla JS

Read through and note:
- [ ] Responsive breakpoints used
- [ ] Accessibility features (ARIA, semantic HTML)
- [ ] Color values (check against our palette)
- [ ] Font choices
- [ ] Animation/transition timing

## Phase 3: Extract & Adapt

### 3.1 Copy the Code
In V0, click **"Copy code"** or **"Export"**

### 3.2 Create Feature Branch
```bash
git checkout -b v0/[tool-name]-improvement
# Example: v0/home-screen-mobile-responsive
```

### 3.3 Integrate into Project

**For most tools (single-file HTML):**

1. Open the existing HTML file (e.g., `index.html`)
2. Copy the `<style>` block from V0
3. Update CSS variables to match our design system:
   ```css
   /* V0 might have: #1f2937 */
   /* Update to: #0a1628 (our navy) */
   ```
4. Copy the `<body>` structure from V0 (or key sections)
5. Keep any existing JavaScript functions working
6. Merge V0's JS with our existing code (don't break Firebase, Google Sheets, etc.)

**For Firebase tools (Install Availability):**

1. Update UI structure from V0
2. **Do NOT replace the Firebase initialization or listeners**
3. Update only the rendering functions (e.g., `renderWeek()`, `renderTabs()`)
4. Test that data still syncs correctly

### 3.4 Color & Typography Mapping

**Replace V0 colors:**
```css
/* V0 defaults → Our values */
#1f2937 → #0a1628
#374151 → #0f1d2d
#4b5563 → #1a2a3a
#f59e0b → #f58220 (orange accent)
#ffffff → #ffffff (keep)
#d1d5db → #a0aec0 (secondary text)
```

**Update fonts:**
```css
/* V0 might use: font-family: 'Tailwind', sans-serif; */
/* Change to: font-family: 'Outfit', 'IBM Plex Sans', sans-serif; */
```

### 3.5 Test Locally

1. Open the updated HTML in your browser
2. Test on mobile (DevTools or physical phone)
3. Test on tablet + desktop
4. Check:
   - [ ] All links/buttons work
   - [ ] Responsive layout
   - [ ] Dark theme looks right
   - [ ] Fonts render correctly
   - [ ] No console errors
   - [ ] Existing features still work (Google Sheets, Firebase, etc.)

## Phase 4: Review & Commit

### 4.1 Before/After Comparison
Create a simple comparison:
- Screenshot of old version
- Screenshot of new version
- List of improvements

### 4.2 Commit Changes
```bash
git add [filename]
git commit -m "V0: Improve [tool name] — [specific change]

- Increased card touch targets from 40px to 48px
- Better spacing on mobile (12px → 16px gaps)
- Added status indicators for tools
- Improved color contrast for accessibility

Before: [V0 design link]
After: [New screenshot]"
```

### 4.3 Push & Open PR
```bash
git push origin v0/[tool-name]-improvement
```

On GitHub:
1. Go to https://github.com/CMHeating/sales-tools
2. Click "New Pull Request"
3. Select your branch
4. Fill in:
   - **Title:** `V0: Improve [tool] — [change]`
   - **Description:** Before/after comparison + list of changes
   - **Testing:** Describe how you tested (mobile, desktop, etc.)
   - **Screenshots:** Add before/after if possible

### 4.4 Get Feedback
Ensure:
- [ ] No breaking changes
- [ ] Works on HCA's phones (iPhone 12, Android)
- [ ] Existing workflows not disrupted
- [ ] Performance acceptable

## Phase 5: Deploy

### 5.1 Merge to Main
Once approved:
```bash
# On GitHub: Click "Merge pull request"
# Or locally:
git checkout main
git pull origin main
git merge v0/[tool-name]-improvement
git push origin main
```

### 5.2 Deploy
**For GitHub Pages tools:**
- Automatic! Deploy happens in ~30 seconds
- Check: https://cmheating.github.io/sales-tools/[tool].html

**For Firebase tools (Install Availability):**
```bash
node scripts/build-install-availability-spark.js
firebase deploy --only hosting
```

### 5.3 Verify Live
1. Wait 30 seconds for GitHub Pages to update
2. Visit the live URL
3. Test on your phone
4. Confirm changes are live

## Phase 6: Monitor & Iterate

### 6.1 Gather Feedback
After deployment:
- Ask HCAs: "Does this work better for you?"
- Monitor any issues
- Note pain points

### 6.2 Plan Next Iteration
If feedback is positive, consider:
- Improving other tools with same design
- Adding related features
- Gathering user feedback for v2

## Quick Reference: V0 Prompting Tips

### Good Prompts
✅ "Create a responsive card grid that works on 6-inch mobile screens"
✅ "Add a search bar with real-time filtering for 100+ items"
✅ "Improve accessibility: ARIA labels, keyboard nav, 7:1 color contrast"
✅ "Make a loading skeleton that matches our dark theme"

### Vague Prompts (Avoid)
❌ "Make it look better"
❌ "Improve the UI"
❌ "Make it modern"
❌ "Add some cool animations"

### Pro Tips
1. **Include design system:** "Use dark navy (#0a1628), orange (#f58220), Outfit font"
2. **Specify constraints:** "Must work offline" / "Must fit on screen < 320px wide"
3. **Reference existing:** "Similar layout to the install availability tool"
4. **Ask for multiple versions:** "Generate 3 variations, I'll pick the best"
5. **Iterate on feedback:** "That's good, but make the buttons more rounded"

## Troubleshooting

### V0 generates React, but I need vanilla JS
**Solution:**
1. Copy the JSX code from V0
2. Use this React-to-vanilla template:
   ```javascript
   // V0: const [count, setCount] = useState(0);
   // Vanilla:
   let count = 0;
   function updateCount(n) {
     count = n;
     render();
   }
   ```
3. Replace `useState` with regular variables
4. Replace `onClick={() => ...}` with `onclick="..."`

### Colors don't match
**Solution:**
1. Find all color values in the CSS
2. Replace with our palette (see `V0-INTEGRATION.md`)
3. Test in dark room to verify contrast

### Responsive breakpoints are wrong
**Solution:**
1. V0 uses Tailwind breakpoints by default
2. Update media queries to match our needs:
   ```css
   /* V0 might use: @media (max-width: 768px) */
   /* Try: @media (max-width: 640px) for small phones */
   ```

### Firebase sync stops working
**Solution:**
1. Did you replace the Firebase code? Don't!
2. Only update the UI rendering functions
3. Keep all `onValue()`, `update()`, `set()` calls intact
4. Test in Firebase console that data still flows

## Checklist Before Merge

- [ ] V0 code adapted to vanilla JS / vanilla HTML
- [ ] All colors match design system
- [ ] Fonts are Outfit + IBM Plex
- [ ] Tested on mobile (< 6 inches)
- [ ] Tested on desktop (> 24 inches)
- [ ] Tested on tablet
- [ ] No console errors
- [ ] Existing features still work
- [ ] Accessibility improved (ARIA, contrast, keyboard nav)
- [ ] Performance acceptable (no jank)
- [ ] Before/after screenshots attached
- [ ] PR description clear
- [ ] No unrelated changes
- [ ] Follows repository conventions

---

**Need help?** See `V0-INTEGRATION.md` for templates and design system details.
