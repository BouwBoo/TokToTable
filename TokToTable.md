# TokToTable — Project Context (SYNC v1)

## Status
Local development is stable.

Frontend (Vite + React + TypeScript) and a local backend are running correctly.
AI functionality is intentionally mocked to unblock product and UX development.

Local and GitHub repositories are in sync.

---

## Current Architecture

### Frontend
- Vite + React + TypeScript
- Uses `/api/*` endpoints only
- No API keys in the browser
- State persisted via localStorage

### Backend (local dev)
- `server.cjs` (pure Node HTTP server, no dependencies)
- Endpoints:
  - `POST /api/extract` → mock recipe extraction
  - `POST /api/image` → mock image generation (SVG placeholder with timestamp)

### Project Mode
- ESM project (`"type": "module"`)
- CommonJS used explicitly via `.cjs` where needed

---

## Key Files

- `server.cjs` — local API server
- `api/extract.cjs` — mock TikTok → recipe extraction
- `api/image.cjs` — mock image generation (visual regen proof)
- `services/geminiService.ts` — frontend → backend bridge
- `services/aiClient.ts` — image generation facade
- `services/storage.ts` — centralized localStorage access
- `vite.config.ts` — Vite dev server + `/api` proxy

---

## Known Limitations (Intentional)

- TikTok extraction is mocked (no real video parsing yet)
- Image regeneration uses mock SVGs (no real AI images)
- No authentication
- No database (localStorage only)
- No creator publishing flow yet

These are deliberate to avoid blocking on AI or infra.

---

## Immediate Next Product Goals

1. Shopping List
   - Aggregate ingredients across Planner
   - Normalize units (g/kg, ml/l, tbsp/tsp)
   - Checkbox UI + reset
   - Export / print

2. Planner Improvements
   - Day-based meals
   - Auto-ingredient aggregation

3. Cost Estimation
   - Price per ingredient
   - Total recipe cost
   - Weekly menu cost

4. Creator Flow (future)
   - Creators publish recipes
   - Users save & remix

---

## Deferred (Post-AI / Infra)

- Replace mock `/api/extract` with real provider (Gemini / OpenAI / Claude)
- Replace mock `/api/image` with real image generation
- Move backend to serverless (Vercel / Cloudflare)
- Authentication (users & creators)
- Database (Supabase / Postgres)

---

## Design Principles

- Never block product progress on AI infra
- Backend owns all AI keys
- Frontend only talks to `/api/*`
- UX > AI cleverness
- Deterministic, debuggable flows

---

## Continuation Keyword

Use the keyword below in a new chat to resume instantly:

**TOKTOTABLE_SYNC_V1**
