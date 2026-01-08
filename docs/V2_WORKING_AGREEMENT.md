# TokToTable – V2 Working Agreement

This document defines the operating rules for V2 development so we can ship improvements without destabilizing V1.

## Branch strategy

### `main` (production, immutable)
**Purpose**
- Always deployable
- Tracks Netlify production
- Source of truth for the latest stable release

**Rules**
- No direct pushes (PR-only)
- No experimental work
- No incomplete features

### `v2` (integration branch)
**Purpose**
- Where V2 features come together
- Can be temporarily unstable during active development

**Rules**
- All changes land via PRs from feature branches
- It’s OK if `v2` breaks briefly, but we restore it quickly
- No “silent” refactors that change UX or contracts

### Feature branches (`feat/*`, `fix/*`, `chore/*`)
**Purpose**
- All work starts here

**Rules**
- 1 feature = 1 branch = 1 PR
- Small, coherent PRs (prefer squash merge)
- Branch names:
  - `feat/rate-limit-ux`
  - `feat/step-duration`
  - `fix/extraction-cache-limit`
  - `chore/docs-structure`

---

## Code rules (hard constraints)

### Hooks are APIs
- Hooks (e.g. `useRecipes`) are treated as public APIs
- Breaking contract changes require:
  - explicit PR description
  - matching UI updates
  - migration notes if needed

### UI changes require explicit intent
- No layout/flow changes “while we’re here”
- UX changes only when the feature is explicitly UX-driven

### Environment awareness
- Local dev must never be blocked by production safeguards
- Rate limits and cooldowns:
  - **Never block local dev**
  - **Visible and enforced in production**
- Use environment flags (examples):
  - `import.meta.env.DEV`
  - `import.meta.env.PROD`

---

## PR rules

### PRs into `v2`
A PR into `v2` must:
- represent one feature or one fix
- keep `useRecipes` contract intact (or explicitly migrate)
- include a short “What changed / What not changed” description

### PRs into `main` (release PRs only)
A PR into `main` must:
- be release-scoped (batch of V2 features, or a single hotfix)
- have a passing Netlify preview
- explicitly confirm critical flows:
  - extract → editor → validate/save
  - open recipe from vault
  - planner and shopping

---

## Stop-moments (prevent chaos)
After each feature PR:
- Stop
- Verify:
  - UX is coherent
  - Hook contract still matches UI
  - No accidental redesign
- Only then start the next feature

---

## Current baseline
- Stable V1 release: `v1.0.1` on `main`
- Recovery snapshot: `v1.0.0`
- V2 development: `v2` branch
