# TokToTable --- Technical Plan

## Core Architecture

-   Frontend-first application
-   Local-first state as default
-   Optional cloud sync layer
-   No hard dependency on backend for core flows

## State Domains

-   prices
-   pantry
-   ui preferences
-   shopping lists (local)
-   recipes (local)

## Auth & Sync (V2)

### Provider

-   Managed auth (Supabase / Firebase / Clerk)

### Synced Tables

-   users
-   prices
-   pantry
-   ui_prefs

### Sync Rules

-   Explicit user-triggered updates
-   Last-write-wins
-   No background magic
-   Logout keeps local data intact

## AI Usage

-   Used only for extraction/parsing
-   No decision-making authority
-   Output always reviewed by user

## Non-Goals

-   Real-time collaboration
-   Recommendation engines
-   Automated substitutions
