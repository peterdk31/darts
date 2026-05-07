# Implementation Plan: Player Registry & Team Composition

**Branch**: `003-player-registry` | **Date**: 2026-05-07 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/003-player-registry/spec.md`

## Summary

Refactor the dart game tracker so that players are first-class persistent entities managed independently from teams. This enables per-player and per-team historical statistics, soft-delete with restore, and persistent reusable teams. The primary technical approach is to introduce two new storage namespaces (`players` and `teams`) behind the existing storage abstraction, add a dedicated `/players` route, refactor the team setup page to draw from the roster, and snapshot team compositions into game records at game start.

## Technical Context

**Language/Version**: TypeScript 5.5+ / React 18  
**Primary Dependencies**: React 18, Vite 5  
**Storage**: localStorage via the existing `storage` abstraction (`src/shared/storage/`)  
**Testing**: Vitest (unit/integration), Playwright (e2e), Testing Library (component)  
**Target Platform**: Browser (static SPA deployed to GitHub Pages at `/darts/`)  
**Project Type**: Web application (client-side SPA)  
**Performance Goals**: Stats viewable within 1s with 100+ historical games (SC-003); player registration under 5s (SC-001)  
**Constraints**: Offline-capable, no backend, localStorage only, max 20 active players, max 8 teams / 4 players per team  
**Scale/Scope**: Single-user single-device; ~55 source files, 4 game modules, 6 shell pages → adding ~8-10 new files

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| **I. Module-First Game Architecture** | PASS | Player/team management lives in the shell layer, not in game modules. Game modules continue to receive `Team[]` via `InitContext` — no changes to game module interfaces. No cross-module imports introduced. |
| **II. Frontend-Only, Static-Deployable** | PASS | No backend required. All data stays in localStorage. Hash-based routing preserved. New `/players` route uses the existing `HashRouter`. |
| **III. Responsive, Mobile-First UI** | PASS | New pages (Players, player stats, team stats) will follow mobile-first responsive layout using existing CSS patterns. Minimum 44×44px touch targets. |
| **IV. Local-First Persistence** | PASS | Two new storage namespaces (`players`, `teams`) go through the existing `storage` abstraction. Each carries a `schemaVersion`. No direct `localStorage` calls. Corrupt/missing storage handled gracefully. |
| **V. Simplicity & Decoupling (YAGNI)** | PASS | No new runtime dependencies. No new abstractions beyond what's needed (a `playerStore` and `teamStore` service, analogous to existing session/history persistence). Inline stats views rather than a separate stats framework. |

**Gate result: ALL PASS — proceed to Phase 0.**

## Project Structure

### Documentation (this feature)

```text
specs/003-player-registry/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit-tasks command)
```

### Source Code (repository root)

```text
src/
├── shared/
│   ├── storage/                  # Existing — add "players" and "teams" to StorageNamespace
│   │   └── types.ts
│   ├── types/
│   │   └── core.ts               # Existing — extend Player with isDeleted, add RosterPlayer
│   └── teams/
│       └── colors.ts             # Existing — unchanged
├── shell/
│   ├── players/                  # NEW — player roster management
│   │   ├── playerStore.ts        # CRUD operations for roster via storage abstraction
│   │   ├── PlayersPage.tsx        # Top-level Players route
│   │   ├── PlayersPage.module.css
│   │   ├── PlayerStatsView.tsx    # Inline stats when tapping a player
│   │   └── PlayerStatsView.module.css
│   ├── teams/                    # NEW — persistent team management
│   │   ├── teamStore.ts          # CRUD operations for teams via storage abstraction
│   │   ├── TeamStatsView.tsx      # Inline stats when tapping a team
│   │   └── TeamStatsView.module.css
│   ├── pages/
│   │   └── TeamSetupPage.tsx     # MODIFIED — draw players from roster, assign to persistent teams
│   ├── session/
│   │   ├── types.ts              # MODIFIED — CompletedGameRecord gets team snapshot with player IDs
│   │   ├── sessionReducer.ts     # MODIFIED — snapshot logic at game start
│   │   └── SessionContext.tsx     # MODIFIED — persist/load new namespaces, clear-on-upgrade
│   ├── stats/
│   │   └── computeWinSummary.ts  # Existing — unchanged (already receives Team[] with players)
│   └── App.tsx                   # MODIFIED — add /players route
tests/
├── unit/
│   ├── playerStore.test.ts       # NEW
│   ├── teamStore.test.ts         # NEW
│   └── player-stats.test.ts      # NEW
└── integration/
    ├── player-roster.test.tsx    # NEW
    └── team-composition.test.tsx  # NEW
```

**Structure Decision**: Follows existing shell + shared pattern. Player management is a shell concern (not a game module), so it lives under `src/shell/players/` and `src/shell/teams/`. Storage types extend the existing `StorageNamespace` union. No new top-level directories needed.

## Complexity Tracking

> No constitution violations — table intentionally left empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
