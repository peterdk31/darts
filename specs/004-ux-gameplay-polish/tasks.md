# Tasks: UX & Gameplay Polish

**Input**: Design documents from `specs/004-ux-gameplay-polish/`
**Prerequisites**: spec.md

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Iteration 1: Sticky Header + Player Switch Overlay (Priority: P1) — MVP

**Goal**: The turn indicator sticks to the top while scrolling, and a full-screen overlay announces the next player when the turn switches. Bust banner and overlay are choreographed.

**Independent Test**: Start a 2-team game. Scroll the page — turn indicator stays visible. Throw 3 darts to trigger a turn switch — overlay shows next player's name and team color. Tap overlay or wait 2s — overlay dismisses, play resumes. Cause a bust — bust banner shows first, then after dismissal the overlay appears for the next player.

**Exit criterion**: Turn indicator is always visible. Player switch overlay appears on every turn change, coordinates with bust banner, blocks interaction while shown.

### Implementation

- [ ] T001 [US1] Make .topRow sticky: add `position: sticky; top: 0; z-index: 20; background: var(--color-bg);` to `.topRow` in `src/shell/pages/PlayPage.module.css`
- [ ] T002 [US1] Create PlayerSwitchOverlay component in `src/shell/components/PlayerSwitchOverlay.tsx` — full-screen overlay showing player name and team color, auto-dismisses after 2s or on tap, blocks interaction
- [ ] T003 [US1] Create styles for PlayerSwitchOverlay in `src/shell/components/PlayerSwitchOverlay.module.css`
- [ ] T004 [US1] Integrate PlayerSwitchOverlay into PlayPage in `src/shell/pages/PlayPage.tsx` — detect turn changes (team ID changed after appendThrow), show overlay after bust banner dismissal if bust occurred, otherwise show immediately; pass overlay state to Dartboard/GridBoard disabled prop
- [ ] T005 [US1] Provide a brief user-perspective summary: the turn indicator is always visible at the top of the screen regardless of scroll position, and a prominent overlay announces the next player on every turn change (including after busts).

**Checkpoint**: Sticky header and player switch overlay work end-to-end.

---

## Iteration 2: Miss Button Prominence (Priority: P1)

**Goal**: The Miss button is immediately visible and accessible without scrolling, positioned prominently near the dartboard.

**Independent Test**: Open a game — Miss button is visible on screen without scrolling. Tap it — miss is recorded.

**Exit criterion**: Miss button is prominently placed and functional.

### Implementation

- [ ] T006 [US2] Reposition Miss button in `src/shell/pages/PlayPage.tsx` — move from below the board to a floating or inline-prominent position within `.boardSlot`, above or beside the undo controls
- [ ] T007 [US2] Update `.missBtn` styles in `src/shell/pages/PlayPage.module.css` — make it visually prominent (larger tap target, distinct color/styling) and ensure it doesn't overlap the dartboard on mobile
- [ ] T008 [US2] Provide a brief user-perspective summary: the Miss button is now immediately visible on the play screen without scrolling.

**Checkpoint**: Miss button is prominent and accessible.

---

## Iteration 3: Correct Dartboard Colors (Priority: P1)

**Goal**: Dartboard segment colors match a real dartboard — segment 20 (top) is black, segment 1 is cream.

**Independent Test**: Open a game with the classic dartboard. Segment 20 at the top is black/dark. Segment 1 to its right is cream/light.

**Exit criterion**: Dartboard colors match real-world coloring.

### Implementation

- [ ] T009 [US3] Fix `isLightWedge` function in `src/shared/dartboard/Dartboard.tsx` — change `return idx % 2 === 0` to `return idx % 2 === 1` so that even indices (starting with 20 at index 0) are dark
- [ ] T010 [US3] Verify GridBoard colors in `src/shared/dartboard/GridBoard.tsx` — check if the grid board has a similar color mapping and fix if needed
- [ ] T011 [US3] Provide a brief user-perspective summary: the dartboard now shows correct real-world segment colors — 20 is black, 1 is cream.

**Checkpoint**: Dartboard colors are correct.

---

## Iteration 4: Clear Hit Marks After Bust (Priority: P1)

**Goal**: When a bust occurs, dart dots from that turn are immediately cleared from the board.

**Independent Test**: In x01, throw darts that cause a bust — dots disappear immediately when the bust banner appears.

**Exit criterion**: No stale dots remain visible after a bust.

### Implementation

- [ ] T012 [US4] Clear turnDots on bust in `src/shell/pages/PlayPage.tsx` — in the `proceedWithThrow` function, when a bust is detected, call `setTurnDots([])` and `setDotsFading(false)` immediately (cancel any pending fade timer) before showing the bust banner
- [ ] T013 [US4] Provide a brief user-perspective summary: dart dots are now cleared from the board immediately when a bust occurs.

**Checkpoint**: Bust clears dots immediately.

---

## Iteration 5: Mickey Mouse Globally Closed Cells (Priority: P2)

**Goal**: In Mickey Mouse, rows where ALL teams have 3 marks are visually distinct ("globally closed") from rows where only the current team has 3 marks.

**Independent Test**: Play a 2-team Mickey Mouse game. Get 3 marks on a target for both teams — the row looks clearly "done" (muted/grayed). Get 3 marks on a different target for only one team — that row looks "disabled for you" but not globally closed.

**Exit criterion**: Globally closed rows are visually distinguishable from partially closed rows.

### Implementation

- [ ] T014 [US5] Add globally-closed detection logic in `src/games/mickey-mouse/ui/ScoreboardPanel.tsx` — for each target row, check if ALL teams have >= 3 marks (not just the current team); add a `globallyClosed` CSS class to the row when true
- [ ] T015 [US5] Add `.globallyClosed` styles in `src/games/mickey-mouse/ui/ScoreboardPanel.module.css` — muted background, reduced opacity, and strikethrough on the target label; visually distinct from the existing `.disabled` class
- [ ] T016 [US5] Provide a brief user-perspective summary: in Mickey Mouse, targets closed by all teams are now clearly grayed out and visually distinct from targets only closed by the current team.

**Checkpoint**: Globally closed cells are clearly distinguishable.

---

## Iteration 6: Long Names Display Gracefully (Priority: P2)

**Goal**: Long player/team names are truncated with ellipsis instead of breaking layouts.

**Independent Test**: Create a player with a 30-character name, play a game, and check all screens — turn indicator, scoreboards, game end, history — names truncate with ellipsis.

**Exit criterion**: No layout breakage from long names on any screen.

### Implementation

- [ ] T017 [P] [US6] Add text truncation styles to TurnIndicatorCard in `src/shell/components/TurnIndicatorCard.tsx` and its CSS module — apply `overflow: hidden; text-overflow: ellipsis; white-space: nowrap;` with appropriate `max-width` or `min-width: 0` on the name element
- [ ] T018 [P] [US6] Add text truncation to Mickey Mouse scoreboard headers in `src/games/mickey-mouse/ui/ScoreboardPanel.module.css` — team name spans in `<th>` cells
- [ ] T019 [P] [US6] Add text truncation to Lumberjack scoreboard headers in `src/games/lumberjack/ui/ScoreboardPanel.module.css` — team name spans in `<th>` cells
- [ ] T020 [P] [US6] Add text truncation to default scoreboard `.scoreName` in `src/shell/pages/PlayPage.module.css`
- [ ] T021 [P] [US6] Add text truncation to GameEndPage names in `src/shell/pages/GameEndPage.module.css` — `.teamName` and `.playerName` classes
- [ ] T022 [P] [US6] Add text truncation to HistoryPage names in `src/shell/pages/HistoryPage.module.css` — `.winnerName` class
- [ ] T023 [US6] Provide a brief user-perspective summary: long player and team names now truncate with ellipsis across all screens instead of breaking layouts.

**Checkpoint**: Long names handled gracefully everywhere.

---

## Iteration 7: Lumberjack Settings Chip Accuracy (Priority: P2)

**Goal**: The Lumberjack settings chip always displays the D/T setting value, not just when one option is active.

**Independent Test**: Start Lumberjack with dtAbove15Only off — chip shows "D/T any". Start with it on — chip shows "D/T 16+".

**Exit criterion**: Settings chip always reflects the actual value.

### Implementation

- [ ] T024 [US7] Update settings chip rendering in `src/games/lumberjack/ui/ScoreboardPanel.tsx` — replace the conditional `{state.dtAbove15Only && <span className={styles.chip}>D/T 16+</span>}` with an always-rendered chip: `<span className={styles.chip}>{state.dtAbove15Only ? "D/T 16+" : "D/T any"}</span>`
- [ ] T025 [US7] Provide a brief user-perspective summary: the Lumberjack settings chip now always shows the D/T setting ("D/T any" or "D/T 16+").

**Checkpoint**: Lumberjack chip always accurate.

---

## Iteration 8: Remove Quick Add Player (Priority: P2)

**Goal**: The "Quick add player" inline form is removed from the team setup page.

**Independent Test**: Open the team setup page — no "Quick add player" button or inline form on any team card.

**Exit criterion**: Feature completely removed, no dead code, app builds cleanly.

### Implementation

- [ ] T026 [US8] Remove quick-add state, handlers, and JSX from `src/shell/pages/TeamSetupPage.tsx` — delete `quickAddTeamId`/`quickAddName` state, `startQuickAdd`/`commitQuickAdd` functions, the quick-add form JSX, and the quick-add button
- [ ] T027 [US8] Remove quick-add CSS classes from `src/shell/pages/TeamSetupPage.module.css` — delete `.quickAddForm`, `.quickAddInput`, and any related styles
- [ ] T028 [US8] Update help text in `src/shell/pages/TeamSetupPage.tsx` — remove references to "quick-add" in the instructional text
- [ ] T029 [US8] Verify build passes — run `npm run build` to confirm no dead references
- [ ] T030 [US8] Provide a brief user-perspective summary: the "Quick add player" feature has been removed from team setup.

**Checkpoint**: Quick-add fully removed, clean build.

---

## Iteration 9: View Final Scoreboard in History (Priority: P3)

**Goal**: Completed game records include the final engine state, and the history page shows expandable scoreboard detail per game.

**Independent Test**: Complete a game, go to history, expand the entry — full scoreboard is shown. Old entries without engine state show a graceful fallback.

**Exit criterion**: All post-update games have viewable scoreboards in history; older entries degrade gracefully.

### Implementation

- [ ] T031 [US9] Extend `CompletedGameRecord` type in `src/shell/session/types.ts` — add optional `finalEngineState?: unknown` field
- [ ] T032 [US9] Persist final engine state when recording completed games in `src/shell/pages/PlayPage.tsx` — set `finalEngineState` on the `CompletedGameRecord` in `proceedWithThrow` (win path), `handleRedo` (win path), and the safety-net `useEffect`
- [ ] T033 [US9] Add expandable detail view to HistoryRow in `src/shell/pages/HistoryPage.tsx` — add expand/collapse toggle state; when expanded, render the game's scoreboard panel (look up manifest.view or use DefaultScoreboard) using the stored `finalEngineState`
- [ ] T034 [US9] Add expand/collapse styles in `src/shell/pages/HistoryPage.module.css`
- [ ] T035 [US9] Handle graceful fallback in `src/shell/pages/HistoryPage.tsx` — if `finalEngineState` is undefined (old records), show "Detailed scoreboard not available for this game"
- [ ] T036 [US9] Provide a brief user-perspective summary: completed games now show a full scoreboard in the history page when expanded; older games show a fallback message.

**Checkpoint**: History page shows expandable scoreboards.

---

## Iteration 10: Shanghai Instant Win Rule (Priority: P3)

**Goal**: An optional "Shanghai" toggle (default off) is available in all game settings. When enabled, hitting single + double + triple of the same number in one turn wins the game instantly.

**Independent Test**: Enable Shanghai in settings, start a game, throw single 20, double 20, triple 20 in one turn — game ends immediately. With Shanghai off, the same throws continue the game normally.

**Exit criterion**: Shanghai detection works across all games with zero false positives.

### Implementation

- [ ] T037 [US10] Create Shanghai detection utility in `src/shared/shanghai.ts` — a pure function `detectShanghai(throws: ThrowRecord[]): boolean` that checks if the last 3 throws by the same player hit single, double, and triple of the same numeric segment (1-20, any order); also export a `shanghaiSetting: SettingDefinition` for reuse
- [ ] T038 [P] [US10] Add Shanghai toggle to x01 manifest in `src/games/x01/manifest.ts` — import `shanghaiSetting` and append to `settingsSchema`
- [ ] T039 [P] [US10] Add Shanghai toggle to Mickey Mouse manifest in `src/games/mickey-mouse/manifest.ts` — import `shanghaiSetting` and append to `settingsSchema`
- [ ] T040 [P] [US10] Add Shanghai toggle to Lumberjack manifest in `src/games/lumberjack/manifest.ts` — import `shanghaiSetting` and append to `settingsSchema`
- [ ] T041 [P] [US10] Add Shanghai toggle to Cricket manifest in `src/games/cricket/manifest.ts` — import `shanghaiSetting` and append to `settingsSchema`
- [ ] T042 [P] [US10] Add Shanghai toggle to Around the Clock manifest in `src/games/around-the-clock/manifest.ts` — import `shanghaiSetting` and append to `settingsSchema`
- [ ] T043 [US10] Integrate Shanghai detection into PlayPage throw processing in `src/shell/pages/PlayPage.tsx` — after `proceedWithThrow` appends a throw, if Shanghai is enabled in `game.resolvedSettings` and the player just threw their 3rd dart, run `detectShanghai` on the last 3 throws; if true, emit a gameWon effect for the current team (same pattern as existing win handling)
- [ ] T044 [US10] Provide a brief user-perspective summary: all games now have an optional "Shanghai" setting. When enabled, hitting single + double + triple of the same number in one turn wins the game instantly.

**Checkpoint**: Shanghai rule works across all games.

---

## Final Iteration: Polish & Cross-Cutting Concerns

**Purpose**: Final verification that all 11 feedback items are addressed with no regressions.

**Exit criterion**: All improvements applied; the project builds and runs end-to-end with no regressions.

- [ ] T045 Run full build verification — `npm run build` passes with no errors or warnings
- [ ] T046 Run existing test suite — `npm test` passes with no regressions
- [ ] T047 Provide a brief user-perspective summary of all 11 feedback items addressed: sticky header, prominent miss button, correct dartboard colors, bust dot clearing, Mickey Mouse globally-closed cells, long name truncation, Lumberjack chip accuracy, quick-add removal, history scoreboards, and Shanghai rule.

---

## Dependencies & Execution Order

### Iteration Dependencies

- **Iteration 1 (US1 — Sticky header + player switch overlay)**: No dependencies. MVP.
- **Iteration 2 (US2 — Miss button)**: Independent of Iteration 1. Can run in parallel.
- **Iteration 3 (US3 — Dartboard colors)**: Independent. Can run in parallel with Iterations 1-2.
- **Iteration 4 (US4 — Bust dot clearing)**: Should run after Iteration 1 (player switch overlay interacts with bust flow).
- **Iteration 5 (US5 — Mickey Mouse closed cells)**: Independent.
- **Iteration 6 (US6 — Long names)**: Independent. All tasks within are parallelizable.
- **Iteration 7 (US7 — Lumberjack chip)**: Independent.
- **Iteration 8 (US8 — Remove quick-add)**: Independent.
- **Iteration 9 (US9 — History scoreboards)**: Independent but modifies PlayPage (same file as Iterations 1, 2, 4); sequence after those.
- **Iteration 10 (US10 — Shanghai)**: Depends on no other iteration but modifies PlayPage and all manifests; run last among implementations.
- **Final Iteration**: Depends on all iterations complete.

### Parallel Opportunities Within Iterations

- **Iteration 6**: T017–T022 can all run in parallel (different CSS/component files)
- **Iteration 10**: T038–T042 can all run in parallel (different manifest files)

### Recommended Execution Order

Since Iterations 1–4 are all P1 and several touch `PlayPage.tsx`, the recommended order minimizes merge conflicts:

1. Iteration 3 (dartboard colors — isolated file, 1-line fix)
2. Iteration 7 (lumberjack chip — isolated file, 1-line fix)
3. Iteration 8 (remove quick-add — isolated file)
4. Iteration 5 (Mickey Mouse closed cells — isolated file)
5. Iteration 6 (long names — all parallel, CSS-only changes)
6. Iteration 2 (Miss button — PlayPage changes)
7. Iteration 4 (bust dot clearing — PlayPage changes)
8. Iteration 1 (sticky header + overlay — PlayPage + new component)
9. Iteration 9 (history scoreboards — types + PlayPage + HistoryPage)
10. Iteration 10 (Shanghai — shared utility + all manifests + PlayPage)

---

## Implementation Strategy

### MVP First

1. Complete Iteration 1 (sticky header + player switch overlay) — the single most impactful UX improvement.
2. **STOP and EXERCISE**: user tests the sticky header and overlay behavior.

### Incremental Delivery

Quick wins (Iterations 3, 7, 8) can be shipped in minutes. The recommended execution order front-loads isolated changes to minimize conflicts. Each iteration leaves the app fully functional.

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Tests are NOT included since the spec did not request TDD approach
- Total: 47 tasks across 10 user story iterations + 1 polish iteration
- PlayPage.tsx is the most-modified file (touched by US1, US2, US4, US9, US10) — sequence those iterations carefully
- The recommended execution order differs from the iteration numbering to minimize conflicts
