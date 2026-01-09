# TokToTable – V1 Recovery Post-mortem

## Context
This document describes the recovery of TokToTable V1 after a series of experimental changes caused instability in the main branch.

Primary objectives:
- Restore a stable V1
- Make `main` immutable
- Enable safe V2/V3 development

---

## Final stable state
- `main`: v1.0.1 (commit 7d109a2)
- `v1.0.0`: post-recovery snapshot
- Netlify production tracks `main`
- Development continues on `v2`

---

## What worked before the incident
- Landing page (`/`) worked correctly
- App routed via `/app`
- TikTok URL input supported:
  - URL field
  - Optional notes/ingredients
  - Clear Extract CTA
- Extraction flow:
  1. URL input
  2. Loading / processing visualizer
  3. Recipe preview
  4. Recipe editing
  5. Validation & save
- No rate-limit UX
- No API hardening
- `useRecipes` hook had a fixed contract:
  ```ts
  extractFromUrl(url: string)
  ```
- UI fully aligned to hook contract
- No TypeScript or React runtime errors
- Local and Netlify production fully aligned

---

## Intended improvements
- Gemini API cost control
- Rate limiting and 429 handling
- Cooldown UX
- Prevent unlimited free extracts
- Better error messaging
- `/api/extract` hardening
- No production mock fallbacks
- User-facing transparency

---

## What went wrong

### 1. Hook contract violations
- `useRecipes` return shape changed
- UI was not updated 1:1
- Resulted in runtime and TypeScript failures

### 2. UI changes during stabilisation
- UrlInput rebuilt multiple times
- Layout and flow changed unintentionally
- UX regressions introduced

### 3. React / TypeScript namespace errors
- Usage of `React.FC`, `React.FormEvent`, etc.
- No React import under new JSX runtime
- Errors masked deeper issues

### 4. Rate-limit logic leaked into local dev
- Cooldowns blocked local extraction
- UX appeared broken despite correct backend behavior

### 5. Git context loss
- Late return to known-good commit
- Multiple stashes and branch switches
- Working code overwritten

---

## Recovery actions taken
- Restored stable extraction flow
- Rebuilt Git structure
- Protected `main` branch
- Introduced immutable version tags
- Re-synced Netlify production

---

## What was lost (not conceptually)
- Rate-limit UX experiments
- Duration-per-step logic
- API hardening iterations

---

## Lessons learned
1. Hooks are APIs; contract changes are breaking changes
2. Stabilisation and improvement must not be mixed
3. UI changes require explicit intent
4. TypeScript errors must be resolved first
5. Rate limiting must be environment-aware
6. Always branch from known-good commits

---

## Rules going forward
- `main` is immutable
- All work via branches + PRs
- V2 development lives on `v2`
- UI changes require explicit agreement
