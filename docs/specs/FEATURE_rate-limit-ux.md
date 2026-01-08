# Feature Spec – Rate-limit UX (V2)

## Goal
Make rate limiting predictable and user-friendly **without breaking V1** and **without blocking local development**.

This is a V2 feature that:
- communicates cooldowns clearly
- prevents spam extraction in production
- handles 429 responses gracefully
- keeps the existing `useRecipes` API contract stable

---

## Non-goals (explicit)
- No new authentication requirements
- No major UrlInput redesign
- No backend “hardening” refactor beyond minimal headers/response shape
- No production mock fallback

---

## Current baseline assumptions
- V1 flow exists and works end-to-end
- `useRecipes` exposes `extractFromUrl(url: string, notes?: string)` (or equivalent) and the UI expects this contract
- Extraction is initiated from UrlInput / dashboard and leads into editor/validation flow

If the exact signature differs, we adapt internally while keeping the UI-facing contract stable.

---

## UX requirements

### 1) Cooldown visibility
When a user hits the Extract button:
- If extraction is allowed → proceed normally
- If in cooldown → show:
  - remaining time (e.g. “Try again in 42s”)
  - reason (“Rate limit to control API usage”)
  - a disabled Extract button with countdown

### 2) Friendly 429 handling
If the backend returns HTTP 429:
- Show a toast/banner:
  - Title: “Please wait a moment”
  - Message: “We’re throttling requests to keep costs under control. Try again in X seconds.”
- Start a cooldown timer in UI

### 3) No local dev blocking
In local development:
- Cooldown should either:
  - be disabled entirely, **or**
  - be reduced to a very small value (e.g. 2–5s) purely for UX testing
- The UI must never lock you out for minutes locally

### 4) Preserve the 5-step animated extraction modal (V1 experience)
If the V1 extraction flow includes a multi-step animated modal:
- Keep it as-is
- Only add rate-limit messaging around it (before starting, or on 429)

---

## Technical design

### A) Introduce a small “rate limit state” in `useRecipes`
Add non-breaking fields (optional) to the hook return shape, e.g.

- `cooldownRemainingMs?: number`
- `cooldownUntil?: number` (epoch)
- `isCooldown?: boolean`
- `setCooldown(ms: number)` internal helper

Keep existing functions unchanged so the UI doesn’t break.

### B) Storage of cooldown
Persist cooldown in `localStorage` so reload doesn’t forget it:
- key: `toktotable.cooldownUntil`
- value: epoch milliseconds

### C) Backend response shape (minimal)
On 429, return JSON like:
```json
{
  "error": "RATE_LIMITED",
  "retryAfterMs": 60000,
  "message": "Rate limit exceeded"
}
```

If your backend already sets `Retry-After`, we can use it too. UI should prefer:
1) `retryAfterMs`
2) `Retry-After` header
3) fallback default (e.g. 60s)

### D) Environment rules
- If `import.meta.env.DEV` is true:
  - ignore cooldown persistence OR cap it to a small max (e.g. 5s)
- If `import.meta.env.PROD`:
  - enforce cooldown as returned

### E) UI integration points
- UrlInput / Extract button:
  - disabled when `isCooldown`
  - shows countdown
- Toast system:
  - on 429 show message + starts cooldown
- Extraction modal:
  - if cooldown is active, do not open modal; show message instead
  - if 429 occurs mid-flow, close modal gracefully and show cooldown

---

## Acceptance checklist
- [ ] In production build, repeated clicks can’t spam extraction
- [ ] 429 triggers cooldown + clear message
- [ ] Countdown decreases smoothly and re-enables extract at 0
- [ ] Page refresh keeps cooldown (prod only)
- [ ] Local dev is not blocked by long cooldowns
- [ ] `useRecipes` contract remains compatible with V1 UI
- [ ] No redesign of UrlInput; only additive UI elements
- [ ] Netlify preview works

---

## Implementation plan (small PRs)
1. Add cooldown state + localStorage to `useRecipes` (no UI changes yet)
2. Add UI disable + countdown on Extract button
3. Add 429 parsing + toast messaging
4. Polish copy + edge cases (refresh, multiple tabs)

