# Quickstart: Player Registry & Team Composition

## Prerequisites

- Node.js 18+ and npm
- The existing darts app builds and runs (`npm run dev`)
- Familiarity with the [spec](spec.md) and [plan](plan.md)

## Development Setup

```bash
git checkout -b 003-player-registry
npm install   # no new dependencies expected
npm run dev   # starts Vite dev server at localhost:5173/darts/
```

## Implementation Order

### Phase 1: Storage & Data Layer

1. **Extend `StorageNamespace`** — Add `"players"` and `"teams"` to the union in `src/shared/storage/types.ts`.

2. **Create `RosterPlayer` type** — Add to `src/shared/types/core.ts`:
   ```ts
   export interface RosterPlayer {
     id: string;
     displayName: string;
     createdAt: string;
     deletedAt: string | null;
   }
   ```

3. **Create `PersistedTeam` type** — Add to `src/shared/types/core.ts`:
   ```ts
   export interface PersistedTeam {
     id: string;
     displayName: string;
     colorId: TeamColorId;
     playerIds: string[];
   }
   ```

4. **Build `playerStore.ts`** — CRUD module at `src/shell/players/playerStore.ts`. Uses `storage.read/write("players")`. See [contract](contracts/player-store.ts).

5. **Build `teamStore.ts`** — CRUD module at `src/shell/teams/teamStore.ts`. Uses `storage.read/write("teams")`. See [contract](contracts/team-store.ts).

6. **Write unit tests** for both stores.

### Phase 2: Clear-on-Upgrade

7. **Add upgrade detection** in `SessionContext.tsx` — On hydration, check if `"players"` namespace exists. If not, clear `session`, `inProgressGame`, and `history` namespaces, then initialize empty `players` and `teams`.

### Phase 3: Players Page

8. **Create `PlayersPage.tsx`** at `src/shell/players/` — Shows active roster, add/rename/remove controls, collapsible "Removed players" section.

9. **Add `/players` route** in `App.tsx` — Register the route and update `NavGuard` to allow it during in-progress games.

10. **Add navigation** — Add a "Players" link/tab to the header area on TeamSetupPage (and vice versa).

### Phase 4: Team Setup Refactor

11. **Refactor `TeamSetupPage.tsx`** — Replace inline player creation with player selection from roster. Teams reference `PersistedTeam` entities. Add inline "quick add player" that creates a roster entry and assigns in one step.

12. **Snapshot at game start** — Resolve `PersistedTeam` → `Team` (with expanded `Player[]`) when creating `InProgressGame`.

### Phase 5: Statistics Views

13. **Build stats computation** — Pure functions in `src/shell/stats/` to compute `PlayerStats` and `TeamStats` from history.

14. **Build `PlayerStatsView.tsx`** — Shown inline when tapping a player on PlayersPage.

15. **Build `TeamStatsView.tsx`** — Shown inline when tapping a team in TeamSetupPage.

### Phase 6: Integration & Polish

16. **Integration tests** — Full flow tests for player roster management and team composition.

17. **Responsive testing** — Verify at 360px, 430px, 700px, and 1200px breakpoints.

18. **End-to-end** — Playwright tests for the complete new-player → compose-team → play-game → view-stats flow.

## Key Files to Modify

| File | Change |
|------|--------|
| `src/shared/storage/types.ts` | Add `"players"` and `"teams"` to `StorageNamespace` |
| `src/shared/types/core.ts` | Add `RosterPlayer`, `PersistedTeam` types |
| `src/shell/App.tsx` | Add `/players` route, update NavGuard |
| `src/shell/pages/TeamSetupPage.tsx` | Major refactor — persistent teams + roster selection |
| `src/shell/session/SessionContext.tsx` | Clear-on-upgrade logic, persist new namespaces |
| `src/shell/session/types.ts` | No structural changes needed (snapshots already work) |

## Key Files to Create

| File | Purpose |
|------|---------|
| `src/shell/players/playerStore.ts` | Player roster CRUD |
| `src/shell/players/PlayersPage.tsx` | Players route UI |
| `src/shell/players/PlayerStatsView.tsx` | Per-player stats inline view |
| `src/shell/teams/teamStore.ts` | Persistent team CRUD |
| `src/shell/teams/TeamStatsView.tsx` | Per-team stats inline view |

## Verification Checklist

- [ ] `npm run typecheck` passes
- [ ] `npm run test:run` passes (all existing + new tests)
- [ ] `npm run build` produces a working static bundle
- [ ] New player can be added, renamed, removed, and restored
- [ ] Teams draw players from the roster (no inline creation except "quick add")
- [ ] Game engine receives the same `Team[]` shape as before
- [ ] Game records show correct player snapshots in history
- [ ] Per-player and per-team stats display correctly
- [ ] Existing game flows (x01, cricket, around-the-clock, mickey-mouse) still work
- [ ] App works at 360px, 430px, 700px, and 1200px breakpoints
- [ ] Clear-on-upgrade works when loading with pre-refactor data
