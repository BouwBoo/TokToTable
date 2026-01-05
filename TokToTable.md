# TokToTable -- Product & Build Plan

This document is the **single source of truth** for TokToTable. It
captures the vision, decisions, and concrete next steps so work can
continue across chats and sessions without losing context.

------------------------------------------------------------------------

## 1. Vision

**TokToTable turns TikTok cooking videos into cookable reality.**

Not an "AI recipe app", but a **practical cooking tool**: - from
inspiration → recipe - from recipe → menu - from menu → shopping list -
from shopping list → dinner

**Primary audience (Phase 1): Consumers** People who already cook using
TikTok videos and want structure, clarity, and less friction.

Creators and professional use cases follow naturally once the consumer
product is strong.

------------------------------------------------------------------------

## 2. Core Principles

-   Consumer-first
-   Local-first, cloud optional
-   No AI keys in the frontend
-   AI assists, humans decide
-   Structure \> automation
-   Simple UX over feature bloat

------------------------------------------------------------------------

## 3. Current State (Baseline)

### What exists

-   Vite + React + TypeScript frontend
-   Recipe extraction from TikTok URLs
-   Powerful recipe editor (ingredients, steps, units, comments)
-   Weekly planner
-   LocalStorage persistence
-   Clean architecture:
    -   components = UI
    -   services = side effects
    -   hooks = state & behavior

### Recent refactors completed

-   D1: Centralized storage
-   D2: Moved AI infra out of components
-   D3: Extracted recipes & planner logic into hooks

------------------------------------------------------------------------

## 4. Product Flow (Consumer)

1.  Paste TikTok URL
2.  Extract → editable recipe
3.  Save recipe
4.  Add recipe to week menu
5.  Generate shopping list
6.  Cook

Everything built must strengthen this flow.

------------------------------------------------------------------------

## 5. Feature Roadmap

### Phase 1 -- Must-have (Consumer MVP)

-   ✅ Recipe extraction
-   ✅ Recipe editor
-   🔜 Shopping list (aggregated, unit-normalized)
-   🔜 Improved week menu (meals per day, servings)
-   🔜 Cost per recipe (manual input → per person calculation)
-   🔜 Shareable recipe/menu links (view-only)

### Phase 2 -- Retention & Cloud

-   Optional login (magic link / Google)
-   Cloud sync (Supabase)
-   "Save to cloud" CTA
-   Menu export (PDF / print)

### Phase 3 -- Creator entry (no pivot)

-   Claim recipe
-   Verified creator profile
-   Creator menus (curated)
-   Optional monetization later

------------------------------------------------------------------------

## 6. Data Model (Target)

-   users
-   recipes
-   recipe_ingredients
-   recipe_steps
-   menus
-   menu_items
-   shopping_lists
-   imports (TikTok URL, status, raw extract)

Database: **Supabase (Postgres)**

------------------------------------------------------------------------

## 7. Backend Architecture (Planned)

AI must run server-side.

Endpoints: - POST /api/extract - POST /api/image - POST
/api/shopping-list

Frontend never sees API keys.

------------------------------------------------------------------------

## 8. AI Strategy

-   Two-pass extraction:
    1.  Raw extract
    2.  Normalize + validate
-   Confidence indicators in UI
-   User corrections feed future prompt improvements
-   Source evidence always preserved

------------------------------------------------------------------------

## 9. What TokToTable Is NOT (Yet)

-   Not a creator marketplace
-   Not a restaurant ERP
-   Not a nutrition tracker
-   Not a social network

These may come later, but are explicitly **out of scope** now.

------------------------------------------------------------------------

## 10. Success Criteria (Consumer)

TokToTable is successful when: - Users return weekly - Shopping lists
are actually used - Recipes are edited, not just extracted - People say:
"I don't cook from TikTok without this anymore"

------------------------------------------------------------------------

## 11. Immediate Next Steps

1.  Move AI calls to backend (serverless)
2.  Build shopping list feature
3.  Refine week menu UX
4.  Introduce cost-per-recipe
5.  Add shareable links

------------------------------------------------------------------------

## 12. How to Use This Document

-   Share this file in new chats to restore full context
-   Treat this as the canonical plan
-   Update it when major decisions change

------------------------------------------------------------------------

**TokToTable** From scroll → to table.
