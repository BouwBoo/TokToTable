# TokToTable

**From Scroll to Table**  
Turn short-form food content (TikTok, Reels) into structured, usable recipes and a smart shopping list.

---

## Current Status (Jan 2026)

TokToTable is now a **working end-to-end prototype**:

1. **Extraction**
   - TikTok URL → recipe title, steps, ingredients
   - Gemini (2.5 Flash / Flash‑Lite) as primary LLM
   - Strict JSON output (no markdown, no backticks)
   - Automatic fallback handling reduced
   - Thumbnails show food image where available

2. **Recipe Vault**
   - Extracted vs validated states
   - Recipe detail view
   - Editable ingredients and steps
   - Image loading & fallback fixed

3. **Shopping List v2**
   - Aggregated ingredients
   - Grouped by aisle
   - Shopping vs cooking mode
   - Pantry exclusion
   - Cost visibility
   - Normalized units

4. **Cleanup Panel**
   - Missing prices detection
   - Pantry candidates surfaced
   - Manual confirmation only
   - CSV import/export

---

## Recent Fixes

- Gemini model errors resolved
- Prompt hardened (raw JSON only)
- Image rendering fixed
- Mock recipes no longer override real data
- Shopping cleanup logic implemented
- UI and build errors resolved

---

## Design Principles

- No silent automation
- LLM parses, user decides
- Shopping list is core
- Pantry is opt-in
- Costs are first-class

---

## Next Focus: Shopping List v2 UX

- Inline cleanup actions
- Faster price entry
- Clear totals per aisle/recipe
- Persistent prices & pantry rules

---

## Tech Stack

- React + TypeScript + Vite
- Node backend
- Gemini 2.5 Flash
- Local-first state

---

## Context Keyword

**pom** — use this to resume TokToTable context in a new chat.

---

TokToTable is stable.  
Next: make it delightful for weekly use.
