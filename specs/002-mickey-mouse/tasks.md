# Feature 002 — Mickey Mouse — Tasks

Each task is intended as a single small commit. `[P]` = parallelisable with adjacent tasks.

## Shared-type extension

- [ ] **T001** Add optional `intent?: string` to `ThrowRecord` in `src/shared/types/core.ts`. Document it as game-specific opaque metadata. No other code changes — existing games ignore it.

## Engine

- [ ] **T002** Create `src/games/mickey-mouse/engine.ts` exporting:
  - `MickeyTarget` union, `MICKEY_TARGETS_15` / `MICKEY_TARGETS_12` constants
  - `MickeyEngineState` interface
  - `initMickey(ctx)` — reads `startingNumber`, `multipliersScore`, `dtRequireTargetRange` from `ctx.resolvedSettings`
  - `applyThrowMickey(state, throw_)` — enumerates candidates, filters closed targets, branches on `throw_.intent`, advances pointer, emits `scored`/`turnAdvance`/`gameWon` effects
  - `selectScoreboardMickey(state)` — minimal summary string (e.g. `"3 / 9 closed"`)
  - `getCandidatesForThrow(state, throw_)` — pure helper exported for the UI; returns `Array<{ intent: "number" | "double" | "triple" | "bull"; label: string }>` after filtering closed targets
- [ ] **T003** [P] Unit tests `tests/unit/games/mickey-mouse/engine.test.ts` covering: single 18 → 1 mark; T18 with intent=number → 3 marks; T18 with intent=triple → 1 mark on Triple; D14 with `dtRequireTargetRange=true` → 0 marks; multiplier OFF makes T18-as-number = 1 mark; inner-bull intent=bull with multiplier ON = 2 bull marks; closing the last target sets status=won and ends the turn mid-throw.

## Manifest + registry

- [ ] **T004** Create `src/games/mickey-mouse/manifest.ts` exporting `mickeyMouseManifest` with id `"mickey-mouse"`, displayName `"Mickey Mouse"`, the three settings, schemaVersion 1, and the engine functions. No `getBoardHints` for v1 (could come later — dim closed numbers).
- [ ] **T005** Register the manifest in `src/games/registry.ts`.

## UI

- [ ] **T006** Create `src/games/mickey-mouse/ui/ScoreboardPanel.tsx` and `.module.css`. Adapt Cricket's grid: ascending row order, glyph = `n` × `"x"`, strikethrough at `n === 3`, no score column. Header labels `D`, `T`, `B` for the categorical rows.
- [ ] **T007** Create `src/games/mickey-mouse/ui/IntentChooser.tsx` — a small inline panel rendered by the play screen when the engine reports 2 candidates. Two large buttons. Apply on tap.
- [ ] **T008** Wire IntentChooser into `src/shell/pages/PlayPage.tsx` (or its current path — verify before editing). Pattern: after a tap on the dartboard, call `getCandidatesForThrow`. If 2 candidates → render chooser, hold the throw in local state until the user picks. If 0 or 1 → call `applyThrow` directly.
- [ ] **T009** [P] Add a settings chip showing condensed config (`"15 • mult • +D/T any"` style) — mirror the x01 chip pattern.
- [ ] **T010** [P] Verify the game-select grid auto-picks up the new manifest from the registry; if not, add the entry. Card title "Mickey Mouse".

## Verification

- [ ] **T011** Manual smoke per spec.md §6 (10 steps).
- [ ] **T012** Type-check + full vitest run + production build (`vite build`).
- [ ] **T013** Update `MEMORY.md` project entry to note 002 status; **do not** auto-update `AGENTS.md` — the user moves the SPECKIT pointer when ready.

## Rough size estimate

~250–350 net new lines of code, plus ~150 lines of tests. Single afternoon of focused work.
