# TokToTable

TokToTable turns TikTok food videos into structured, usable recipes you can actually cook from.

The product is built **local-first**, with a strong focus on clarity, ownership, and practical cooking workflows — not feeds, not social features.

---

## Status

- **Current stable release:** `v1.0.1`
- **Production branch:** `main` (protected, PR-only)
- **Active development:** `v2`

V1 is considered **feature-complete and stable**.  
All new work happens on `v2` and feature branches.

---

## What TokToTable does

- Extracts recipes from TikTok videos
- Structures ingredients and cooking steps
- Allows validation and editing before saving
- Supports planning and shopping workflows
- Works reliably in local-first mode

---

## Development principles

- `main` is immutable and production-only
- Hooks are treated as public APIs (no silent contract changes)
- UI changes require explicit intent
- Stabilisation and feature development are separated
- Local development must never be blocked by production safeguards

---

## Documentation

All project documentation lives in the `/docs` folder:

- Product vision and roadmap
- Technical architecture
- V1 recovery post-mortem
- Marketing and landing copy

Start here:
- [`docs/00-overview.md`](docs/00-overview.md)

---

## Getting started (development)

```bash
npm install
npm run dev
```

---

## Versioning

- `v1.0.0` – Post-recovery snapshot
- `v1.0.1` – Stable V1 release (production)
- Future releases follow semantic versioning

---

## License

Private project. All rights reserved.
