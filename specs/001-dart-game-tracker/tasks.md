---
description: "Task list for Dart Game Tracker (feature 001-dart-game-tracker)"
---

# Tasks: Dart Game Tracker

**Input**: Design documents from `/src/darts/specs/001-dart-game-tracker/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓, quickstart.md ✓

**Tests**: Tests are NOT requested as a TDD-first practice. However, the game-module contract (`contracts/game-module.md`) recommends per-module unit tests (normal-play, bust, undo equivalence). Those few targeted tests are included as tasks where they directly validate a contract obligation. Broader test coverage is in the Polish iteration.

**Organization**: Tasks form an ordered **Iteration Ladder**. Iteration 1 is the smallest user-visible slice that runs end-to-end and absorbs all bootstrap work; each subsequent iteration adds one user story on top. Stopping at any iteration leaves a working product.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story the task belongs to (US1, US2, US3). Setup/foundational/polish tasks have no story label.
- All paths are absolute under the repo root `/src/darts/`.

## Path conventions

Single static frontend project per `plan.md` "Project Structure":

- Source: `/src/darts/src/`
- Tests: `/src/darts/tests/`
- Specs (this feature): `/src/darts/specs/001-dart-game-tracker/`

---

## Iteration 1: User Story 1 — Set up teams, play a game, crown a winner (Priority: P1) 🎯 MVP

**Goal**: A host opens the app, creates 2-8 teams (1-4 players each), picks one of the four supported games, configures any per-match settings, taps darts on a virtual dartboard, sees the scoreboard update live, has the app advance turns automatically, undoes a mis-tap, and watches the app declare and record a winner.

**Independent Test**: From a clean browser, complete Acceptance Scenarios 1-7 of User Story 1 from `spec.md` end-to-end with a 501 game (and spot-check Cricket and Around the Clock) — including team setup with 2 teams (one with 2 players, one with 1 player), dart allotment of 6 per team per turn, miss handling, single-undo, and on-win halt + history record.

**Exit criterion**: User Story 1 works end-to-end. The project runs (`npm run dev`) and is buildable for GitHub Pages (`npm run build` under a non-root `base`). This iteration absorbs all bootstrap.

### Implementation for User Story 1

#### Bootstrap

- [X] T001 Initialize npm project with React 18 + ReactDOM runtime deps and Vite/TypeScript/Vitest/RTL/jsdom devDeps; add scripts `dev`, `build`, `typecheck`, `test`, `test:run` in `/src/darts/package.json`
- [X] T002 [P] Configure TypeScript strict mode (`strict: true`, `noUncheckedIndexedAccess: true`, path alias `@/*` → `./src/*`) in `/src/darts/tsconfig.json`
- [X] T003 [P] Configure Vite with `@vitejs/plugin-react` and a `base` path placeholder for GitHub Pages (commented `base: '/<repo>/'` line for deploy) in `/src/darts/vite.config.ts`
- [X] T004 [P] Create root HTML entry referencing `/src/main.tsx` in `/src/darts/index.html`
- [X] T005 [P] Configure Vitest with `jsdom` environment and RTL matchers in `/src/darts/vitest.config.ts` and `/src/darts/tests/setup.ts`
- [X] T006 [P] Add `.gitignore` covering `node_modules/`, `dist/`, `.vite/`, `coverage/`, OS files in `/src/darts/.gitignore`

#### Foundational shared layer (delivered as part of the US1 slice)

- [X] T007 [P] [US1] Create core shared types (`Team`, `Player`, `ThrowRecord`, `GameTypeId`) per `data-model.md` in `/src/darts/src/shared/types/core.ts`
- [X] T008 [P] [US1] Create game-module contract types (`GameManifest`, `SettingDefinition`, `ResolvedSettings`, `ThrowEffect`, `ApplyThrowResult`, `InitContext`, `ScoreboardSummary`, `DartSegment`) per `contracts/game-module.md` in `/src/darts/src/shared/types/game-module.ts`
- [X] T009 [P] [US1] Create storage error classes (`StorageQuotaError`, `StorageCorruptError`, `StorageUnsupportedError`) per `contracts/storage.md` in `/src/darts/src/shared/storage/errors.ts`
- [X] T010 [P] [US1] Create storage envelope + namespace types (`VersionedRecord<T>`, `StorageNamespace`) in `/src/darts/src/shared/storage/types.ts`
- [X] T010a [P] [US1] Create `prefs` storage handler with `UserPrefs` type (`boardTheme: "traditional" | "desaturated"`), `schemaVersion = 1`, default-record getter, and `setBoardTheme()` writer per `data-model.md` `prefs` namespace and FR-028 in `/src/darts/src/shared/prefs/index.ts`
- [X] T011 [US1] Implement localStorage driver (read/readList/write/appendToList/replaceList/remove/isAvailable, mapping native errors to typed errors) in `/src/darts/src/shared/storage/localStorageDriver.ts`
- [X] T012 [US1] Implement public storage API surface in `/src/darts/src/shared/storage/index.ts`
- [X] T013 [P] [US1] Implement hash router (`<HashRouter>`, `<Route>`, `useNavigate`, `useParams`) and `href()` helper per `contracts/url-routes.md` in `/src/darts/src/shared/routing/router.tsx` and `/src/darts/src/shared/routing/href.ts`
- [X] T013a [P] [US1] Create team color palette + auto-assign helper (`TEAM_COLORS` ordered ids `["red","green","orange","purple","teal","pink","yellow","cyan"]`, `assignNextColor(existingTeams)` returning the first palette id not yet used) per FR-002b and research.md R15 in `/src/darts/src/shared/teams/colors.ts`
- [X] T014 [P] [US1] Implement dart-allotment formula helper (`teamAllotment`, `allotmentForPlayer`) per `data-model.md` "Derived rules" in `/src/darts/src/shared/dart-allotment.ts`
- [X] T015 [P] [US1] Implement throw-score validator (asserts `ThrowRecord.score` matches segment × multiplier with bull/miss special cases) in `/src/darts/src/shared/throw-score.ts`
- [X] T016 [P] [US1] Create global styles, design tokens, and reset — typography/spacing/radii/shadows, app accent (electric blue) + destructive red, 8-hue team-color custom properties, board-theme tokens (traditional default + desaturated overrides), `prefers-color-scheme: dark` block, and a ~20-line modern CSS reset (Andy Bell / Josh Comeau style) — split across `/src/darts/src/styles/tokens.css`, `/src/darts/src/styles/reset.css`, and `/src/darts/src/styles/global.css` per research.md R13/R17
- [X] T017 [P] [US1] Implement SVG dartboard component: 20 segments × 3 multiplier rings + outer/inner bull + accessible `<button>` per region; outer ring labelled "MISS" as a tap zone replacing a separate Miss button (FR-013); accepts `boardHints?: { highlight?: DartSegment[]; dim?: DartSegment[] }` prop driving generic highlight/dim treatments (R16); accepts a `data-board-theme="traditional"|"desaturated"` attribute that swaps token-driven palettes (R14, FR-028); renders persistent dot markers for the active player's current-turn throws (cleared on turn advance) plus a ~150 ms accent flash on tap (R14); sized via `min(100vw, 100vh - var(--play-chrome))` in `/src/darts/src/shared/dartboard/Dartboard.tsx`
- [X] T018 [US1] Add dartboard CSS module with container-query rules for foldable inner-display posture (~700-850 px) plus `[data-board-theme="…"]` palette overrides and `.hint-highlight` / `.hint-dim` segment treatments in `/src/darts/src/shared/dartboard/Dartboard.module.css`
- [X] T019 [P] [US1] Create generic `Button` and `Modal` primitives meeting 44×44 touch-target minimum in `/src/darts/src/shared/components/Button.tsx` and `/src/darts/src/shared/components/Modal.tsx`
- [X] T020 [P] [US1] Create `QuotaExceededModal` (non-dismissable-until-acknowledged, names cause + offers Clear-history) per FR-027a in `/src/darts/src/shared/components/QuotaExceededModal.tsx`
- [X] T020a [P] [US1] Implement `BoardSettingsMenu` — small gear-icon button on the play screen that opens a popover with a traditional/desaturated theme picker; reads/writes via the prefs handler (T010a) per FR-028 in `/src/darts/src/shell/components/BoardSettingsMenu.tsx`
- [X] T020b [P] [US1] Implement `BustBanner` — overlay surfaced for ~2.5 s when the active game's `applyThrow` returns a `bust` effect; states "BUST — score reverts to N" then auto-dismisses, per FR-030 in `/src/darts/src/shell/components/BustBanner.tsx`
- [X] T020c [P] [US1] Implement `TurnIndicatorCard` — card with the active team's color stripe + numeric badge ("Team N") + team display name + active player display name + filled/empty dart pips representing darts thrown vs remaining this turn, sized for legibility from across a room per FR-002a/FR-002b/FR-015 in `/src/darts/src/shell/components/TurnIndicatorCard.tsx`

#### Session state (US1)

- [X] T021 [P] [US1] Implement session reducer with actions `setTeams`, `setInProgressGame`, `appendThrow`, `popThrow`, `pushRedo`, `clearRedo`, `recordCompletedGame`, `discardInProgressGame` in `/src/darts/src/shell/session/sessionReducer.ts`
- [X] T022 [US1] Implement `SessionContext` provider that hydrates from storage on mount, persists on every change (with try/catch to surface `StorageQuotaError`), and restores in-progress game in <2s per SC-007. When `setInProgressGame` is dispatched (game-start), the reducer MUST snapshot `turnOrder` (team rotation, FR-017) and `playerRotation` (per-team player order, FR-010) from the current editor state and freeze them for the duration of the match — neither field is mutable thereafter. In `/src/darts/src/shell/session/SessionContext.tsx`
- [X] T023 [US1] Implement `useSession` hook + memoized selectors (currentTurn, currentPlayer, dartsRemainingThisTurn, scoreboardForGame) in `/src/darts/src/shell/session/useSession.ts`
- [X] T024 [US1] Wire `QuotaExceededModal` to render whenever session writes throw `StorageQuotaError` in `/src/darts/src/shell/session/SessionContext.tsx`

#### Game registry + four game modules (US1)

- [X] T025 [P] [US1] Create empty registry that exposes `getById(id)` and `listAll()` in `/src/darts/src/games/registry.ts`
- [X] T026 [P] [US1] Implement x01 engine (pure `init`, `applyThrow` with double-in/double-out + bust handling, `selectScoreboard`) in `/src/darts/src/games/x01/engine.ts`
- [X] T027 [US1] Implement x01 manifests for `x01.501` and `x01.301` (each declaring `doubleIn`/`doubleOut` toggle settings, default false) in `/src/darts/src/games/x01/manifest.ts`
- [X] T028 [P] [US1] Implement x01 scoreboard panel (per-team running score + per-player current-turn delta) and a small settings chip ("DO" if `doubleOut` on, "DI" if `doubleIn` on) for the active match per R16; checkout-hint chip is deferred to Final (T066-T068) in `/src/darts/src/games/x01/ui/ScoreboardPanel.tsx`
- [X] T029 [P] [US1] Add x01 unit tests covering normal-play-to-zero, bust on overshoot, double-out enforcement, double-in enforcement, and undo equivalence in `/src/darts/tests/unit/games/x01.test.ts`
- [X] T030 [P] [US1] Implement Cricket engine (closure tracking for 20/19/18/17/16/15/bull, scoring on closed-only-by-this-team numbers, all-closed-but-trailing continuation per spec FR-007 cricket clause) in `/src/darts/src/games/cricket/engine.ts`
- [X] T031 [US1] Implement Cricket manifest (no settings in v1) in `/src/darts/src/games/cricket/manifest.ts`
- [X] T032 [P] [US1] Implement Cricket UI panel — read-only 7-row closure grid (20/19/18/17/16/15/Bull × teams; cells show 0/1/2/3 marks; team scores in column headers) replacing the standard scoreboard for this game type per R16; optionally implement `getBoardHints(state)` returning numbers closed by every team as `dim` in `/src/darts/src/games/cricket/ui/ScoreboardPanel.tsx` and `/src/darts/src/games/cricket/manifest.ts`
- [X] T033 [P] [US1] Add Cricket unit tests covering normal play, the all-closed-but-trailing continuation case, and undo equivalence in `/src/darts/tests/unit/games/cricket.test.ts`
- [X] T034 [P] [US1] Implement Around the Clock engine (sequential progress 1→20→bull, multipliers count as a single hit) in `/src/darts/src/games/around-the-clock/engine.ts`
- [X] T035 [US1] Implement Around the Clock manifest (no settings in v1) in `/src/darts/src/games/around-the-clock/manifest.ts`
- [X] T036 [P] [US1] Implement Around the Clock UI panel (per-team current-target indicator + 1-20-Bull progress strip with completed segments filled) and implement `getBoardHints(state)` returning the active player's current target as `highlight` per R16 in `/src/darts/src/games/around-the-clock/ui/ScoreboardPanel.tsx` and `/src/darts/src/games/around-the-clock/manifest.ts`
- [X] T037 [P] [US1] Add Around the Clock unit tests covering progression, win on bull, and undo equivalence in `/src/darts/tests/unit/games/around-the-clock.test.ts`
- [X] T038 [US1] Wire all four game manifests (`x01.501`, `x01.301`, `cricket`, `around-the-clock`) into `/src/darts/src/games/registry.ts`

#### Pages (US1)

- [X] T039 [P] [US1] Implement `TeamSetupPage` with team add/remove/rename, player add/remove/rename/reorder, validation enforcing 2-8 teams and 1-4 players per FR-001..004 (FR-002 does NOT enforce display-name uniqueness), auto-assignment of each new team's `colorId` via `assignNextColor()` (T013a) and a per-team swatch picker for color override (FR-002b), plus a numeric "Team N" badge derived from creation order shown alongside the team display name in `/src/darts/src/shell/pages/TeamSetupPage.tsx`
- [X] T040 [P] [US1] Implement `GameSelectPage` rendering `registry.listAll()` per FR-005 in `/src/darts/src/shell/pages/GameSelectPage.tsx`
- [X] T041 [P] [US1] Implement `GameSettingsPage` that renders the chosen game type's `settingsSchema` populated with defaults and validates each value's `constraints` per FR-006a in `/src/darts/src/shell/pages/GameSettingsPage.tsx`
- [X] T042 [US1] Implement `PlayPage`: mounts `TurnIndicatorCard` (T020c) for the active turn (team-name disambiguator per FR-002a, color stripe per FR-002b, dart pips per FR-015); wires the shared `Dartboard` (T017) — passing the active team's color for dot markers, the `boardHints` from the active manifest's optional `getBoardHints(state)` (R16), and the `boardTheme` read from the prefs handler (T010a); records every tap (segments + the labelled MISS outer zone, FR-013) as a `ThrowRecord`, dispatches it through the active game's `applyThrow`, and reacts to **every** returned `ThrowEffect`: `scored` updates the visible per-team running score and decrements the player's remaining-darts pip (FR-014); `turnAdvance` updates the turn pointer to the supplied `nextTeamId`/`nextPlayerId` and clears the per-turn dot markers on the dartboard (FR-016); `bust` shows `BustBanner` (T020b) for ~2.5 s per FR-030 then awaits the engine's accompanying `turnAdvance`; `gameWon` halts further input (FR-021) and redirects to the game-end flow; renders the standard scoreboard via `selectScoreboard()` with the hybrid layout (active team's row auto-expanded with current-turn running total and dart pips, other teams collapsed); shows the active game's `view` panel alongside the dartboard at ≥700 px (Cricket grid, ATC progress strip); mounts `BoardSettingsMenu` (T020a) as a gear-icon affordance; provides single-step undo (FR-023 base case + US1 acceptance scenario 7) in `/src/darts/src/shell/pages/PlayPage.tsx`
- [X] T043 [US1] Implement `GameEndPage` halting throw input, displaying winning team prominently, and writing the `CompletedGameRecord` to history per FR-021 in `/src/darts/src/shell/pages/GameEndPage.tsx`
- [X] T044 [US1] Implement abandon-confirm modal triggered when navigating to a new-game route while an in-progress game exists (FR-022a; non-cancel discards in-progress with no history entry) in `/src/darts/src/shell/components/AbandonConfirmModal.tsx`

#### App shell + entry (US1)

- [X] T045 [US1] Implement `App.tsx` wiring router, routes (`#/`, `#/teams`, `#/game-select`, `#/game-settings/:id`, `#/play`, `#/end`), in-progress nav guard, and win-stops-input redirect per `contracts/url-routes.md` in `/src/darts/src/shell/App.tsx`
- [X] T046 [US1] Mount React app with `SessionContext` provider at `/src/darts/src/main.tsx`

#### End-of-iteration

- [X] T047 [US1] Provide a brief user-perspective summary of what the user can now do end-to-end. Do not run the project — the user drives verification.

**Checkpoint**: User Story 1 works end-to-end. The user exercises Iteration 1 (manual smoke test from `quickstart.md`) and decides whether to continue, adjust, or stop.

---

## Iteration 2: User Story 2 — Track wins across multiple games in a session (Priority: P2)

**Goal**: After a game ends, the host can choose "Keep teams" or "New Teams", play another game, and see a running session summary listing every completed game with team, game type, and timestamp. Session history persists across reloads (FR-027) until the user explicitly clears it.

**Independent Test**: Play two short games back-to-back. After game 1 ends, choose "Keep teams" and play a second game. Open the History page; confirm both completed games are listed with the correct winners, game types, and timestamps. Reload the browser — both entries persist.

**Exit criterion**: The project runs end-to-end with US2 exercisable on top of Iteration 1. US1 still works.

### Implementation for User Story 2

- [X] T048 [P] [US2] Implement `HistoryPage` listing `CompletedGameRecord` entries (winner team, game type display name, settings summary, timestamp) in reverse chronological order per FR-026/027 in `/src/darts/src/shell/pages/HistoryPage.tsx`
- [X] T049 [US2] Add "Clear history" action with double-confirm modal (per research R10 — irreversible) and `replaceList("history", [])` wiring in `/src/darts/src/shell/pages/HistoryPage.tsx`
- [X] T050 [US2] Add `#/history` route to `/src/darts/src/shell/App.tsx` (read-only access permitted even when an in-progress game exists, per `contracts/url-routes.md` rule 1)
- [X] T051 [US2] Add "Keep teams" / "New teams" / "View history" buttons to `GameEndPage` per FR-022 in `/src/darts/src/shell/pages/GameEndPage.tsx`
- [X] T052 [P] [US2] Implement `SessionTally` component showing per-team running win count for the current session, used on `GameEndPage` and `HistoryPage` in `/src/darts/src/shell/components/SessionTally.tsx`
- [X] T053 [US2] Provide a brief user-perspective summary of what the user can now do end-to-end. Do not run the project — the user drives verification.

**Checkpoint**: User Stories 1 and 2 are exercisable end-to-end. The user exercises Iteration 2 and decides whether to continue.

---

## Iteration 3: User Story 3 — Correct mistakes during play (Priority: P3)

**Goal**: Beyond the single-step undo delivered in US1, the player can undo multiple consecutive throws (walking back through history) and redo a previously undone throw as long as no new throw has been recorded in between (FR-023, FR-024).

**Independent Test**: Mid-game, throw three darts. Tap Undo three times; the scoreboard, dart count, and turn indicator MUST reach the exact pre-throw state. Tap Redo twice; the first two of those throws are reapplied. Throw a new dart; Redo button MUST be disabled (the redo stack is cleared).

**Exit criterion**: The project runs end-to-end with US3 exercisable on top of Iteration 2. US1 and US2 still work.

### Implementation for User Story 3

- [X] T054 [P] [US3] Add `redoStack` field to in-progress game state and reducer actions `pushRedo` / `popRedo` / `clearRedo` in `/src/darts/src/shell/session/sessionReducer.ts`
- [X] T055 [US3] Add Redo button to `PlayPage` (shown when `redoStack.length > 0`) that pops from `redoStack`, re-appends to throws, and replays through `applyThrow` in `/src/darts/src/shell/pages/PlayPage.tsx`
- [X] T056 [US3] Ensure recording a new throw clears `redoStack` per FR-024 in `/src/darts/src/shell/session/sessionReducer.ts`
- [X] T057 [P] [US3] Add integration test verifying multi-step undo walks back through history and redo correctly reapplies until cleared by a new throw in `/src/darts/tests/integration/undo-redo.test.tsx`
- [X] T058 [US3] Provide a brief user-perspective summary of what the user can now do end-to-end. Do not run the project — the user drives verification.

**Checkpoint**: All three user stories are exercisable end-to-end. The user exercises Iteration 3 and decides whether to continue.

---

## Final Iteration: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories. Run only after all user-story iterations are complete and the user has exercised them.

**Exit criterion**: All improvements applied; the project still runs end-to-end at every checked breakpoint.

- [X] T059 [P] Set up Playwright config + four-breakpoint smoke test (~360, ~430, ~700-850, ≥1200 px) on Chromium covering US1's golden path per Constitution Principle III in `/src/darts/playwright.config.ts` and `/src/darts/tests/e2e/breakpoints.spec.ts`
- [X] T060 [P] Add storage layer unit tests covering round-trip, `StorageQuotaError` simulation, `StorageCorruptError` on malformed payload, and unknown-`schemaVersion` handling in `/src/darts/tests/unit/storage.test.ts`
- [X] T061 [P] Add a "phantom game module" test that asserts adding a new module under `/src/darts/src/games/__phantom__/` plus a single line in `/src/darts/src/games/registry.ts` makes it appear on `GameSelectPage` without edits to other game modules (Principle I gate verification) in `/src/darts/tests/integration/game-module-extensibility.test.tsx`
- [X] T062 [P] Write `README.md` with one-line project description and a pointer to `/src/darts/specs/001-dart-game-tracker/quickstart.md` in `/src/darts/README.md`
- [X] T066 [P] Implement x01 checkout helper `computeCheckout(score: number, dartsRemaining: 1|2|3, doubleOut: boolean): Array<{ segment: number | "bull"; multiplier: 1|2|3 }> | null` — returns a valid one-turn finish when `score ≤ 170`, `doubleOut === true`, and the remaining darts can complete the score ending on a double; returns `null` otherwise (FR-029) in `/src/darts/src/games/x01/checkout.ts`
- [X] T067 [P] Extend the x01 scoreboard panel (T028) to render a "needs N: …" checkout-hint chip whenever `computeCheckout` returns a result for the active player; chip hides when the score > 170, when `doubleOut` is off, or when no valid finish exists per FR-029 in `/src/darts/src/games/x01/ui/ScoreboardPanel.tsx`
- [X] T068 [P] Add x01 checkout tests covering: 170 (T20 → T20 → DB) one-turn DO finish, scores requiring 1/2/3 darts, scores with no valid finish in the remaining darts, `doubleOut === false` returns `null`, and score > 170 returns `null` in `/src/darts/tests/unit/games/x01-checkout.test.ts`
- [X] T063 Audit for unused exports, dead code, and commented-out blocks; remove per Constitution Principle V in `/src/darts/src/`
- [X] T064 Run production build (`npm run build`) under a non-root `base` (`'/darts/'`) and serve `dist/` locally; smoke-test deep-link refresh on `#/play` and `#/history` per Constitution "Deployability gate"
- [X] T065 Provide a brief user-perspective summary of what the user can now do end-to-end. Do not run the project — the user drives verification.

---

## Dependencies & Execution Order

### Iteration Dependencies

- **Iteration 1 (P1 / MVP)**: No prior iteration dependencies. Absorbs all bootstrap. Must run end-to-end with User Story 1 exercisable.
- **Iteration 2 (P2)**: Depends on Iteration 1. Adds User Story 2. Project still runs end-to-end.
- **Iteration 3 (P3)**: Depends on Iteration 2. Adds User Story 3. Project still runs end-to-end.
- **Final Iteration (Polish)**: Depends on all desired user-story iterations being complete.

### Within Iteration 1 (intra-iteration ordering)

Layered build-up:

1. **Bootstrap** (T001-T006) — must complete before anything that depends on the toolchain.
2. **Foundational shared layer** (T007-T020c) — types, storage (incl. `prefs`), routing, dartboard (theme + hint aware), team color palette, design tokens / reset, generic primitives, and shell components (`BoardSettingsMenu`, `BustBanner`, `TurnIndicatorCard`). Game modules and pages depend on these.
3. **Session state** (T021-T024) — depends on storage (T012). Pages depend on this.
4. **Registry skeleton** (T025) — required before any module can register.
5. **Game modules** (T026-T037) — each module is independent of the others (Principle I); within a module, engine → manifest → UI panel → tests.
6. **Wire registry** (T038) — depends on all four manifests being present (T027, T031, T035, plus T026).
7. **Pages** (T039-T044) — depend on shared layer + session + registry.
8. **App shell + entry** (T045-T046) — depend on all pages and the router.
9. **Iteration summary** (T047) — last task.

Module-internal dependencies (key examples):
- T010a depends on T009, T010, T012 (uses storage layer + envelope types)
- T011 depends on T009, T010
- T012 depends on T011
- T013a depends on T007 (Team type)
- T018 depends on T017
- T020a depends on T010a, T019 (prefs handler + Modal primitive)
- T020b depends on T019 (Modal/overlay primitive)
- T020c depends on T007, T013a, T016 (Team type + color palette + tokens)
- T022 depends on T012, T021
- T023 depends on T022
- T024 depends on T019, T022
- T027 depends on T026
- T031 depends on T030
- T035 depends on T034
- T038 depends on T027, T031, T035
- T039 depends on T013a (color auto-assign)
- T042 depends on T017, T020a, T020b, T020c, T023, T038
- T044 used by T042 and T045
- T045 depends on T013, T039-T043
- T046 depends on T022, T045

### Within Iteration 2

- T048 first (HistoryPage skeleton). T049 depends on T048. T050 depends on T048. T051 and T052 are independent of each other and of T048-T050. T053 last.

### Within Iteration 3

- T054 first (state shape). T055 depends on T054. T056 depends on T054. T057 can run as soon as T055 + T056 exist. T058 last.

### Within Final Iteration

- T059, T060, T061, T062, T066, T068 are mutually independent and can run in parallel.
- T067 depends on T028 (existing x01 scoreboard panel) and T066 (checkout helper).
- T063 should run after all source-touching tasks (including T067) so dead-code removal sees the final state.
- T064 should run last among the verification tasks because it is the deploy-path gate.
- T065 last.

### Parallel Opportunities

Within Iteration 1 once bootstrap (T001-T006) is done, a single contributor (or coordinated agents) can run these clusters concurrently:

- **Cluster A — types & helpers** (no inter-dependencies): T007, T008, T009, T010, T013, T013a (after T007), T014, T015, T016
- **Cluster A2 — prefs storage** (after Cluster A's storage): T010a (after T009/T010/T012)
- **Cluster B — UI primitives & dartboard**: T017 (then T018), T019, T020
- **Cluster B2 — shell components** (after Cluster A & primitives): T020a (after T010a + T019), T020b (after T019), T020c (after T007 + T013a + T016)
- **Cluster C — game engines after types** (depends on T007, T008, T014, T015): T026, T030, T034
- **Cluster D — game UI panels after types**: T028, T032, T036
- **Cluster E — game tests after engines**: T029 (after T026), T033 (after T030), T037 (after T034)
- **Cluster F — pages after shared layer + session + registry**: T039 (after T013a), T040, T041 are mutually independent

Iterations themselves are sequential — do not parallelize across iterations (each iteration builds on the previous).

---

## Parallel Example: Iteration 1, post-bootstrap

Once T001-T006 are merged, a coordinator can fan these out concurrently:

```text
# Shared types (no inter-deps once T002 is in place):
Task: "Create core shared types in /src/darts/src/shared/types/core.ts"            (T007)
Task: "Create game-module contract types in /src/darts/src/shared/types/game-module.ts" (T008)
Task: "Create storage error classes in /src/darts/src/shared/storage/errors.ts"     (T009)
Task: "Create storage envelope types in /src/darts/src/shared/storage/types.ts"     (T010)

# UI primitives (independent of types):
Task: "Implement SVG dartboard in /src/darts/src/shared/dartboard/Dartboard.tsx"    (T017)
Task: "Create Button + Modal primitives in /src/darts/src/shared/components/"       (T019)
Task: "Create QuotaExceededModal in /src/darts/src/shared/components/QuotaExceededModal.tsx" (T020)

# After T007/T008/T014/T015 land, fan out the four game modules in parallel:
Task: "Implement x01 engine in /src/darts/src/games/x01/engine.ts"                  (T026)
Task: "Implement Cricket engine in /src/darts/src/games/cricket/engine.ts"          (T030)
Task: "Implement Around the Clock engine in /src/darts/src/games/around-the-clock/engine.ts" (T034)
```

---

## Implementation Strategy

### MVP First

1. Complete **Iteration 1** (T001-T047): all four games playable, history recorded on win, single-step undo, all routes wired, runs in dev and builds for non-root base path. This is the MVP.
2. **STOP and EXERCISE**: the user runs `npm run dev`, walks the manual smoke test from `quickstart.md`, and decides whether to continue, adjust, or stop.

### Incremental Delivery

1. Iteration 1 → user exercises (MVP). All four games playable with single-undo and on-win history record.
2. Iteration 2 → user exercises. Session history viewer + Keep/New teams flow.
3. Iteration 3 → user exercises. Multi-step undo + redo.
4. Final Iteration → polish (Playwright breakpoint smoke, README, dead-code audit, storage tests, deploy gate).

Each iteration adds a vertical slice without breaking the previous ones. Stop at any iteration and you still have a working product with one or more user stories exercisable.

---

## Notes

- `[P]` tasks operate on disjoint files and have no incomplete dependencies; they can be parallelized.
- `[Story]` label maps tasks to user stories for traceability. Setup and polish tasks have no story label by design.
- Every iteration ends with the project in a runnable state and a final summary task. The user, not the agent, runs and verifies the product between iterations.
- Per Constitution Principle V: do not introduce a state-management library, a UI kit, or a router runtime dependency unless one of these tasks specifically calls it out. None do.
- Per Constitution Principle I: cross-imports between game modules are forbidden. The phantom-module test (T061) is the architectural smoke test that catches accidental coupling.
- Per Constitution Principle IV: every persisted record carries a `schemaVersion`. Module-owned schemas live next to the module (e.g., `/src/darts/src/games/x01/storage.ts` if needed); the shell owns the envelopes for `session`, `inProgressGame`, and `history`.
- Avoid: vague tasks, same-file conflicts on `[P]` clusters (the file paths above are deliberately disjoint), and cross-iteration dependencies that would leave the project non-runnable.
