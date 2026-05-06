# Implementation Plan: Dart Game Tracker

**Branch**: `001-dart-game-tracker` | **Date**: 2026-05-06 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-dart-game-tracker/spec.md`

## Summary

A static, single-page React webapp that lets a group around a physical dartboard set up 2-8 teams (1-4 players each), pick one of four supported games (501, 301, Cricket, Around the Clock), record every dart on a virtual board, automatically advance turns and detect wins, and keep an unbounded session history of completed games. Persistence is local-only (localStorage) via a single storage layer; each game type lives in its own self-contained module behind a registry contract; the UI is mobile-first and works at 320px-up; the build deploys as static assets to GitHub Pages under a non-root base path.

## Technical Context

**Language/Version**: TypeScript 5.x (project-wide), React 18+ (functional components + hooks).
**Primary Dependencies**: React, ReactDOM, a hash-based router (TBD: react-router-dom v6 in hash mode, or a ~50-line in-repo hash router — see research.md). No state-management library, no UI kit, no backend SDK.
**Storage**: `localStorage` only in v1, accessed exclusively through an in-repo `storage/` abstraction. `IndexedDB` is permitted by the constitution but not needed for v1's payload sizes.
**Testing**: Vitest + React Testing Library for unit/integration. Playwright (or manual notes) for the four required breakpoints (~360, ~430, ~700-850, ≥1200 px) per Principle III.
**Target Platform**: Modern evergreen browsers — latest 2 majors of Chrome, Safari, Firefox, Edge, including mobile and Chrome/Android foldable postures. Static hosting on GitHub Pages under `/<repo>/`.
**Project Type**: Single static frontend project. No backend, no API server, no monorepo split.
**Performance Goals**: SC-003: tap-to-update p50 under 3s on a typical phone (dominated by user motor time, not render). SC-007: in-progress game restore under 2s on reload. Interactions render at 60fps on a mid-range Android phone (~3-year-old hardware). Initial bundle < 200 KB gzipped is a soft target — keeps cold-load fast on mobile.
**Constraints**: Fully offline after first load (no required network calls in any feature). Base-path-aware asset URLs and routing. Minimum supported width 320 CSS px. Minimum touch target 44×44 CSS px on every interactive element. No PII or telemetry leaves the device.
**Scale/Scope**: Single device, single host user, one in-progress game at a time, up to 8 teams × 4 players = 32 active players per match. Session history is unbounded (constrained only by localStorage quota; on quota failure the app must surface an error per FR-027a). Approximately 5 primary screens (Team Setup, Game Select, Game Settings, Play, Game End / History).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Gates derived from `.specify/memory/constitution.md` v1.0.0.

### I. Module-First Game Architecture

- **Gate I.a**: Each of the four v1 games MUST live under `src/games/<game>/` and expose its rules, state shape, scoring logic, and game-specific UI behind a single declared module contract.
- **Gate I.b**: Adding a fifth game MUST require only (1) a new directory under `src/games/` and (2) a new entry in the single registry file. No edits to other game modules MUST be required.
- **Gate I.c**: Cross-imports between game modules are FORBIDDEN. Shared logic MUST live under `src/shared/`.
- **Gate I.d**: Each module MUST declare a persisted state schema and a `version` field on every persisted record.

**Status (pre-Phase 0)**: PASS — design uses `src/games/<game>/` layout with a single `src/games/registry.ts` registration point and module contract defined in `contracts/game-module.md`. 501 and 301 share an underlying x01 engine but register as two distinct game types from one module (`src/games/x01/`); this does not introduce cross-module imports because they are the same module — see research.md decision R9.

### II. Frontend-Only, Static-Deployable

- **Gate II.a**: No code path MUST require a backend service belonging to this project. (Spec already says no accounts, no sync.)
- **Gate II.b**: Production build MUST work under `/<repo>/`. Vite `base` config + hash-based router are mandated.
- **Gate II.c**: Every feature MUST function with the network offline after first load. The spec's local-only persistence (FR-025..027a) makes this naturally satisfiable — no plan feature requires a network call.

**Status (pre-Phase 0)**: PASS.

### III. Responsive, Mobile-First UI

- **Gate III.a**: All screens MUST use fluid layouts; no fixed pixel widths that break below 360 px or above 1200 px.
- **Gate III.b**: Every primary interaction (board taps, Miss, Undo, end-of-player confirm, New Game) MUST be reachable on touch with ≥44×44 CSS px hit areas.
- **Gate III.c**: PRs that touch UI MUST be verified at the four required breakpoints.
- **Gate III.d**: No feature MAY rely on hover-only interaction.

**Status (pre-Phase 0)**: PASS — the dartboard component must size with `min(100vw, 100vh-<header>)` and use SVG segments with hit-padding to satisfy III.b. See research.md R7.

### IV. Local-First Persistence

- **Gate IV.a**: All persistence access MUST go through `src/shared/storage/`. No direct `localStorage.*` calls outside that layer.
- **Gate IV.b**: Every persisted record MUST carry a `schemaVersion` (or per-module `version`) field. Each module MUST own its forward migrations.
- **Gate IV.c**: The app MUST tolerate corrupted, missing, or quota-exceeded storage without crashing — graceful degrade + user message. FR-027a satisfies the quota-exceeded branch explicitly.
- **Gate IV.d**: No PII or telemetry leaves the device. (Trivially satisfied — there is no telemetry endpoint.)

**Status (pre-Phase 0)**: PASS — storage abstraction contract defined in `contracts/storage.md`.

### V. Simplicity & Decoupling (YAGNI)

- **Gate V.a**: No state-management or DI framework MAY be introduced. React's built-in `useState`/`useReducer` + Context for narrowly-scoped sharing are sufficient for v1.
- **Gate V.b**: No speculative extension points. Game-module contract is the only intentional extension surface, and it is mandated by Principle I.
- **Gate V.c**: Each new runtime npm dependency requires a one-line note. The plan introduces only React, ReactDOM, and a router (TBD in research). Build/test deps (Vite, TypeScript, Vitest, RTL, Playwright) are tooling, not runtime, but each is justified in research.md.
- **Gate V.d**: No commented-out code, no dead exports.

**Status (pre-Phase 0)**: PASS.

**Overall Constitution Check (pre-Phase 0)**: PASS — proceeding to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/001-dart-game-tracker/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── game-module.md
│   ├── storage.md
│   └── url-routes.md
├── checklists/          # /speckit-checklist outputs
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
darts/                              # repo root (current working dir)
├── index.html                      # Vite entry (base-path-aware)
├── vite.config.ts                  # Vite config; sets `base` for GH Pages
├── tsconfig.json
├── package.json
├── public/                         # static assets copied verbatim
├── src/
│   ├── main.tsx                    # React mount + router init
│   ├── shell/                      # Host shell — owns routes, layout, navigation
│   │   ├── App.tsx
│   │   ├── pages/
│   │   │   ├── TeamSetupPage.tsx
│   │   │   ├── GameSelectPage.tsx
│   │   │   ├── GameSettingsPage.tsx
│   │   │   ├── PlayPage.tsx
│   │   │   └── GameEndPage.tsx
│   │   ├── components/             # Shell-only UI (BoardSettingsMenu, AbandonConfirmModal, …)
│   │   │   ├── BoardSettingsMenu.tsx
│   │   │   ├── TurnIndicatorCard.tsx
│   │   │   ├── BustBanner.tsx
│   │   │   └── AbandonConfirmModal.tsx
│   │   └── session/                # Session-level state: teams, history, in-progress pointer
│   │       ├── SessionContext.tsx
│   │       └── sessionStore.ts
│   ├── shared/                     # Shared layer (Principle I) — no game-specific logic
│   │   ├── components/             # Generic UI primitives (Button, Modal, Toast, etc.)
│   │   ├── dartboard/              # Reusable virtual dartboard SVG component (themes + getBoardHints rendering)
│   │   ├── prefs/                  # User-prefs accessor backed by the `prefs` storage namespace
│   │   ├── storage/                # Single storage abstraction (Principle IV)
│   │   │   ├── index.ts
│   │   │   ├── localStorageDriver.ts
│   │   │   └── errors.ts
│   │   ├── teams/                  # Team color palette + auto-assignment helper
│   │   ├── types/                  # Shared cross-module types: Team, Player, ThrowRecord, GameTypeId, DartSegment
│   │   └── routing/                # Hash-router config + base-path helper
│   ├── games/                      # Game modules (Principle I)
│   │   ├── registry.ts             # SINGLE registration point — imports each module's manifest
│   │   ├── x01/                    # 501 + 301 (shared engine, two registered game types)
│   │   │   ├── manifest.ts
│   │   │   ├── engine.ts
│   │   │   ├── ui/
│   │   │   └── storage.ts          # x01-owned schema + migrations
│   │   ├── cricket/
│   │   │   ├── manifest.ts
│   │   │   ├── engine.ts
│   │   │   ├── ui/
│   │   │   └── storage.ts
│   │   └── around-the-clock/
│   │       ├── manifest.ts
│   │       ├── engine.ts
│   │       ├── ui/
│   │       └── storage.ts
│   └── styles/                     # Global tokens, reset, base styles
│       ├── tokens.css              # CSS custom properties: colors, spacing, typography, team palette, board themes
│       ├── reset.css               # ~20-line modern CSS reset (hand-copied)
│       └── global.css              # Body/font defaults, accent + destructive vars, dark-mode @media block
└── tests/
    ├── unit/                       # Pure-logic tests (engines, storage, scoring)
    ├── integration/                # Component + multi-screen flows under RTL
    └── e2e/                        # Optional Playwright smoke at the four breakpoints
```

**Structure Decision**: Single-project frontend (constitution Principle II rules out a backend split). The `src/games/<game>/` + `src/games/registry.ts` layout is non-negotiable per Principle I — adding a fifth game in the future MUST require only a new module directory plus a registry import. `src/shared/` is the only place game modules may import from. The `shell/` directory hosts the orchestration layer (routes, session state, navigation) that calls into game modules via the contract in `contracts/game-module.md` — the shell does not know game-specific rules.

## Complexity Tracking

> No constitution violations to justify. Section intentionally empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| _(none)_  | _(n/a)_    | _(n/a)_                              |

## Post-Design Constitution Re-check

After Phase 1 artifacts (data-model.md, contracts/, quickstart.md) were drafted, the gates above were re-evaluated.

- **I. Module-First**: Re-verified — `contracts/game-module.md` is the only surface the shell uses to drive games. The data-model places `Game.gameTypeId` and `Game.resolvedSettings` on the Game entity but the engine logic lives in the module. The optional `getBoardHints(state)` extension (R16) is declarative — it returns `DartSegment[]` only and never lets the module touch the dartboard's rendering directly, preserving the principle that the board never sees rules. PASS.
- **II. Static-Deployable**: Re-verified — `contracts/url-routes.md` uses hash routes only; no server-rendered route exists. PASS.
- **III. Responsive**: Re-verified — dartboard contract specifies SVG with `viewBox` and pointer-event padding, sized to `min(100vw, 100vh - header)`; tap targets ≥44 px on every control. PASS.
- **IV. Local-First**: Re-verified — `contracts/storage.md` is the single access surface; every persisted entity in `data-model.md` carries a `schemaVersion`. PASS.
- **V. Simplicity**: Re-verified — no state framework; only React + a small router. Single registry point. PASS.

**Overall Constitution Check (post-Phase 1)**: PASS.
