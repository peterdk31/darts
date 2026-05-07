# Tasks: Player Registry & Team Composition

**Input**: Design documents from `specs/003-player-registry/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Exact file paths included in descriptions

---

## Iteration 1: User Story 1 — Manage a Player Roster (Priority: P1) 🎯 MVP

**Goal**: Players are first-class persistent entities. A user can open the app, navigate to a Players page, add/rename/remove/restore players, and the roster persists across reloads.

**Independent Test**: Navigate to `/players`, add several players by name, rename one, remove one, see the "Removed players" section, restore one. Reload the app — roster persists.

**Exit criterion**: User Story 1 works end-to-end. The app runs with the new `/players` route and a fully functional player roster. Clear-on-upgrade wipes old data on first load.

### Implementation for User Story 1

- [x] T001 [US1] Extend `StorageNamespace` union with `"players"` and `"teams"` in `src/shared/storage/types.ts`
- [x] T002 [P] [US1] Add `RosterPlayer` interface to `src/shared/types/core.ts` (id, displayName, createdAt, deletedAt)
- [x] T003 [P] [US1] Add `PersistedTeam` interface to `src/shared/types/core.ts` (id, displayName, colorId, playerIds)
- [x] T004 [US1] Create `playerStore.ts` at `src/shell/players/playerStore.ts` — CRUD operations (getAll, getActive, getDeleted, add, rename, remove, restore, getById) per contract `contracts/player-store.ts`
- [x] T005 [US1] Add clear-on-upgrade logic in `src/shell/session/SessionContext.tsx` — detect absence of `"players"` namespace, clear `session`/`inProgressGame`/`history`, initialize empty `players` and `teams`
- [x] T006 [US1] Create `PlayersPage.tsx` at `src/shell/players/PlayersPage.tsx` — active roster list, add player form, rename/remove controls, collapsible "Removed players" section with restore, empty state prompt, 20-player limit enforcement
- [x] T007 [US1] Create `PlayersPage.module.css` at `src/shell/players/PlayersPage.module.css`
- [x] T008 [US1] Add `/players` route in `src/shell/App.tsx` — register route in HashRouter, update NavGuard to allow `/players` during in-progress games
- [x] T009 [US1] Add "Players" navigation link/tab to header or main navigation area so users can reach `/players` from the home page
- [x] T010 [US1] Provide a brief user-perspective summary of what the user can now do end-to-end. Do not run the project — the user drives verification.

**Checkpoint**: User Story 1 works end-to-end. The user can manage a player roster from a dedicated page. The user exercises Iteration 1 and decides whether to continue, adjust, or stop.

---

## Iteration 2: User Story 2 — Compose Teams from Existing Players (Priority: P1)

**Goal**: Teams are persistent entities that reference roster players by ID. The team setup page draws players from the roster instead of creating them inline. A player can only be on one team at a time. Teams persist across sessions. Inline "quick add" lets the user create a player and assign in one step.

**Independent Test**: With players in the roster, create two teams on the team setup page, assign players to each (no duplicates allowed), start a game — game engine receives the same `Team[]` shape as before. Return to team setup — compositions are preserved.

**Exit criterion**: The project runs end-to-end with team composition from the roster. All existing game flows (x01, cricket, around-the-clock, mickey-mouse) still work.

### Implementation for User Story 2

- [x] T011 [US2] Create `teamStore.ts` at `src/shell/teams/teamStore.ts` — CRUD operations (getAll, add, rename, setColor, assignPlayer, unassignPlayer, remove, resolve, isPlayerAssigned, getById) per contract `contracts/team-store.ts`
- [x] T012 [US2] Refactor `src/shell/pages/TeamSetupPage.tsx` — replace inline player creation with roster-based player selection, reference `PersistedTeam` entities, enforce single-assignment constraint, show "add players first" prompt when roster is empty
- [x] T013 [US2] Add inline "quick add player" flow in `TeamSetupPage.tsx` — creates a roster entry via `playerStore.add()` and immediately assigns to the current team via `teamStore.assignPlayer()`
- [x] T014 [US2] Implement team-to-snapshot resolution at game start — resolve `PersistedTeam` → `Team` (with expanded `Player[]`) when creating `InProgressGame` in `src/shell/session/sessionReducer.ts` or `SessionContext.tsx`
- [x] T015 [US2] Validate that each team has at least 1 assigned player before allowing game start in `TeamSetupPage.tsx`
- [x] T016 [US2] Ensure navigation between `/players` and team setup (links/buttons in both directions)
- [x] T017 [US2] Provide a brief user-perspective summary of what the user can now do end-to-end. Do not run the project — the user drives verification.

**Checkpoint**: User Stories 1 and 2 are exercisable end-to-end. Players are managed on the roster, composed into teams, and games run as before. The user exercises Iteration 2 and decides whether to continue.

---

## Iteration 3: User Story 3 — View Per-Player Historical Statistics (Priority: P2)

**Goal**: After playing games, a user can tap a player on the Players page and see their personal stats inline — games played, games won, win rate, breakdown by team and game type.

**Independent Test**: Complete at least two games with overlapping players on different teams. Navigate to Players page, tap a player — see aggregated statistics. Tap a player with no games — see empty state.

**Exit criterion**: Per-player stats are viewable inline on the Players page, computed from game history.

### Implementation for User Story 3

- [ ] T018 [US3] Create `computePlayerStats` function at `src/shell/stats/computePlayerStats.ts` — iterate `CompletedGameRecord[]`, match player ID in team snapshots, aggregate gamesPlayed/gamesWon/winRate/byTeam/byGameType per contract `contracts/stats.ts`
- [ ] T019 [US3] Create `PlayerStatsView.tsx` at `src/shell/players/PlayerStatsView.tsx` — inline stats display (games played, won, win rate, team breakdown, game type breakdown), empty state when no games
- [ ] T020 [US3] Create `PlayerStatsView.module.css` at `src/shell/players/PlayerStatsView.module.css`
- [ ] T021 [US3] Integrate `PlayerStatsView` into `PlayersPage.tsx` — tapping a player expands/toggles the inline stats view (FR-018)
- [ ] T022 [US3] Provide a brief user-perspective summary of what the user can now do end-to-end. Do not run the project — the user drives verification.

**Checkpoint**: User Stories 1–3 are exercisable end-to-end. The user can see per-player stats after playing games. The user exercises Iteration 3 and decides whether to continue.

---

## Iteration 4: User Story 4 — View Per-Team Historical Statistics (Priority: P2)

**Goal**: A user can tap a team in the team setup area and see the team's history — games played, games won, and the player roster at the time of each game.

**Independent Test**: After completing games where a team's roster changed between sessions, view the team's history — each game shows the correct player lineup at that time. View a team with no games — see empty state.

**Exit criterion**: Per-team stats are viewable inline on the team setup page, showing historical rosters per game.

### Implementation for User Story 4

- [ ] T023 [US4] Create `computeTeamStats` function at `src/shell/stats/computeTeamStats.ts` — iterate `CompletedGameRecord[]`, match team ID, collect game history with roster snapshots per contract `contracts/stats.ts`
- [ ] T024 [US4] Create `TeamStatsView.tsx` at `src/shell/teams/TeamStatsView.tsx` — inline stats display (games played, won, win rate, game history with player roster per game), empty state
- [ ] T025 [US4] Create `TeamStatsView.module.css` at `src/shell/teams/TeamStatsView.module.css`
- [ ] T026 [US4] Integrate `TeamStatsView` into `TeamSetupPage.tsx` — tapping a team expands/toggles the inline stats view (FR-019)
- [ ] T027 [US4] Provide a brief user-perspective summary of what the user can now do end-to-end. Do not run the project — the user drives verification.

**Checkpoint**: All four user stories are exercisable end-to-end. The user exercises Iteration 4 and decides whether to continue to polish.

---

## Final Iteration: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories. Only run after all user-story iterations are done.

**Exit criterion**: All improvements applied; the project still runs end-to-end.

- [ ] T028 [P] Responsive testing and CSS adjustments at 360px, 430px, 700px, and 1200px breakpoints across PlayersPage, TeamSetupPage, PlayerStatsView, and TeamStatsView
- [ ] T029 [P] Verify all four existing game flows (x01, cricket, around-the-clock, mickey-mouse) work end-to-end with the new team composition flow
- [ ] T030 Run `npm run typecheck`, `npm run test:run`, and `npm run build` — fix any issues
- [ ] T031 Provide a brief user-perspective summary of what the user can now do end-to-end. Do not run the project — the user drives verification.

---

## Dependencies & Execution Order

### Iteration Dependencies

- **Iteration 1 (US1 / MVP)**: No prior dependencies. Absorbs bootstrap (storage types, clear-on-upgrade, routing). Must run end-to-end with player roster management exercisable.
- **Iteration 2 (US2)**: Depends on Iteration 1. Adds team composition from roster. All game flows must still work.
- **Iteration 3 (US3)**: Depends on Iterations 1+2. Adds per-player stats. Requires game history to exist for meaningful stats.
- **Iteration 4 (US4)**: Depends on Iterations 1+2. Adds per-team stats. Can run in parallel with Iteration 3 (independent views).
- **Final Iteration (Polish)**: Depends on all user-story iterations being complete.

### Within Each Iteration

- Types/models before stores
- Stores before UI components
- UI components before route integration
- The final task of every iteration is a user-perspective summary
- The user, not the agent, runs and verifies the product between iterations
- Do not move to the next iteration until the user has exercised the current one

### Parallel Opportunities

Within Iteration 1:
- T002 (RosterPlayer type) and T003 (PersistedTeam type) can run in parallel — different sections of same file, no dependency between them

Within Final Iteration:
- T028 (responsive testing) and T029 (game flow verification) can run in parallel

Cross-iteration:
- Iterations 3 and 4 could theoretically run in parallel (independent stats views), but sequential is safer since they share the stats computation pattern

---

## Parallel Example: Iteration 1

```text
# After T001 (storage namespace), launch type definitions in parallel:
T002: Add RosterPlayer interface to src/shared/types/core.ts
T003: Add PersistedTeam interface to src/shared/types/core.ts

# Then sequential: T004 (playerStore) → T005 (clear-on-upgrade) → T006+T007 (PlayersPage) → T008+T009 (routing/nav) → T010 (summary)
```

---

## Implementation Strategy

### MVP First

1. Complete Iteration 1: player roster management with dedicated page, storage, and routing → runs end-to-end (MVP!)
2. **STOP and EXERCISE**: user runs Iteration 1, confirms roster CRUD works, decides whether to continue

### Incremental Delivery

1. Iteration 1 → user exercises player roster (MVP)
2. Iteration 2 → user exercises team composition from roster + game play
3. Iteration 3 → user exercises per-player stats
4. Iteration 4 → user exercises per-team stats
5. Final → polish, responsive, verification

Each iteration adds a vertical slice without breaking previous ones. Stop at any iteration and you still have a working product.

---

## Notes

- No new npm dependencies required
- All storage goes through existing `storage` abstraction — no direct `localStorage` calls
- Game engine interfaces (`InitContext`, `ThrowRecord`, `GameManifest`) are unchanged
- `CompletedGameRecord` structure is unchanged — it already stores team snapshots with embedded players
- Clear-on-upgrade drops all existing localStorage data (per spec clarification)
- Duplicate player names allowed — uniqueness is by ID
- Max 20 active players, max 8 teams, max 4 players per team
