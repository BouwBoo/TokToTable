# TokToTable

TokToTable is a lightweight web app that helps you turn TikTok food
videos into structured menus. It's built for creators, ghost kitchens,
and food entrepreneurs who want to go from inspiration to execution
faster.

The app focuses on **flow, structure, and ownership** --- not "AI
magic". AI is used as an assistant, not a dependency.

------------------------------------------------------------------------

## ✨ What TokToTable does

-   Collect TikTok food ideas
-   Extract ingredients, dishes, and menu concepts
-   Organise them into a structured menu
-   Store everything locally during early experimentation

> ⚠️ Important: this project is intentionally early-stage and
> local-first.

------------------------------------------------------------------------

## 🧠 Architecture principles

-   **Frontend-first**: React + TypeScript
-   **Clear separation**:
    -   UI components → `components/`
    -   Side effects & logic → `services/`
-   **No AI keys in the browser**
-   **No vendor lock-in**
-   **Local storage first, backend later**

------------------------------------------------------------------------

## 🛠 Tech stack

-   **Vite**
-   **React**
-   **TypeScript**
-   **Tailwind CSS (CDN, early-stage)**
-   **LocalStorage**
-   (Planned) Serverless backend for AI calls

------------------------------------------------------------------------

## 🚀 Getting started (local)

### 1. Clone the repo

``` bash
git clone https://github.com/BouwBoo/TokToTable.git
cd TokToTable
```

### 2. Install dependencies

``` bash
npm install
```

### 3. Run the dev server

``` bash
npm run dev
```

The app will be available at:

    http://localhost:5173

------------------------------------------------------------------------

## 🔐 Environment variables

Create a local `.env.local` file **(never commit this)**:

``` env
GEMINI_API_KEY=your_key_here
```

> ⚠️ Note: AI calls should **not** be made directly from the frontend.
> This key will be used later via a backend / serverless function.

------------------------------------------------------------------------

## 📁 Project structure (simplified)

    src/
    ├─ components/     # UI components
    ├─ services/       # Logic, storage, AI adapters
    ├─ types.ts        # Shared domain types
    ├─ constants.ts    # App constants
    ├─ App.tsx         # App orchestration
    ├─ index.tsx       # Entry point

------------------------------------------------------------------------

## 🧭 Roadmap (high level)

-   [ ] Move AI calls to backend / serverless function
-   [ ] Replace CDN Tailwind with build-time setup
-   [ ] Introduce domain models (MenuItem, Dish, Video)
-   [ ] Persist data beyond LocalStorage
-   [ ] Deploy (Vercel / Netlify)

------------------------------------------------------------------------

## 🧪 Status

This project is **experimental**. Expect rapid changes, refactors, and
sharp decisions.

------------------------------------------------------------------------

## 📄 License

Private for now.
