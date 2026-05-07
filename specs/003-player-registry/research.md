# Research: Player Registry & Team Composition

## R-001: Player Identity Model

**Decision**: Players are identified by a UUID-style ID (`player-<timestamp36>-<counter>`) generated at creation time. The ID is immutable and survives renames and soft-deletes.

**Rationale**: The existing codebase already uses this pattern (`uid("player")` in `TeamSetupPage.tsx`). Keeping the same format avoids breaking any code that compares player IDs across team snapshots and history records. Since this is a single-device app with at most 20 active players, collisions are not a practical concern.

**Alternatives considered**:
- Crypto UUID (`crypto.randomUUID()`): Stronger uniqueness guarantees but unavailable in some older mobile browsers; not needed at this scale.
- Incremental integer: Simpler but brittle if localStorage is cleared and IDs restart.

## R-002: Soft-Delete Strategy

**Decision**: A `deletedAt: string | null` field on the `RosterPlayer` type. Active players have `deletedAt === null`. Soft-deleted players are excluded from the "active roster" count (capped at 20) and from team assignment, but remain in storage and appear in a collapsible "Removed players" section on the Players page.

**Rationale**: This is the simplest approach that satisfies FR-004 (removal), FR-020 (restore), and FR-021 (20-player limit on active only). Historical game records reference player IDs, so the player record must outlive the active roster.

**Alternatives considered**:
- Separate "archived" storage namespace: More complex, requires cross-namespace lookups for stats.
- Boolean `isDeleted` flag: Slightly simpler but loses the timestamp, which could be useful for sorting the removed-players list.

## R-003: Team Persistence Model

**Decision**: Teams become persistent entities stored under a dedicated `teams` storage namespace, separate from both the session and game history. Each team has a stable ID, display name, color, and a list of assigned player IDs (references into the roster). Teams are loaded at app startup and survive across sessions.

**Rationale**: The spec explicitly requires persistent teams (FR-017). Currently, teams are ephemeral — created inline during setup and embedded directly into game records. Making teams persistent enables team-level statistics (FR-010/FR-019) and lets users reuse team compositions across sessions (US-2 acceptance scenario 5).

**Alternatives considered**:
- Keep teams session-scoped but derive history from game records: Wouldn't satisfy FR-017 or the reusability requirement.
- Store teams inside the session namespace: Possible, but conflates session state with entity state and makes the session namespace carry too many responsibilities.

## R-004: Team Composition Snapshots

**Decision**: When a game starts, the system snapshots the full `Team[]` (including expanded `Player` data for each team member) into the `InProgressGame` and `CompletedGameRecord`. This is already the current behavior — `teams: Team[]` in both types contains embedded player objects.

**Rationale**: The existing game engine (`InitContext.teams`) and win summary (`computeWinSummary`) already expect `Team[]` with embedded `Player[]`. The snapshot ensures that historical records accurately reflect who played, even after players are renamed or deleted. No change to the snapshot format is needed — the refactor changes *how* teams are composed before game start, not what gets recorded.

**Alternatives considered**:
- Store only player IDs in game records and resolve at display time: Breaks when players are deleted; also requires lookups on every history render.

## R-005: Storage Namespace Design

**Decision**: Add two new `StorageNamespace` values:
- `"players"` — stores a `VersionedRecord<RosterPlayer[]>` (the full roster including soft-deleted entries)
- `"teams"` — stores a `VersionedRecord<PersistedTeam[]>` (all persistent teams with player ID references)

Both use `schemaVersion: 1` initially.

**Rationale**: The existing `StorageNamespace` type is a union that can be extended. Using the `storage` abstraction (Principle IV) keeps all localStorage access centralized. A single record per namespace (array of entities) is consistent with how `history` is stored and avoids the complexity of per-entity keys.

**Alternatives considered**:
- Per-entity keys (e.g., `player:<id>`): More granular but adds complexity to listing and is overkill for ≤20 players.
- IndexedDB: Permitted by the constitution for large/structured data but unnecessary here — the payload is small (20 players + 8 teams).

## R-006: Clear-on-Upgrade Strategy

**Decision**: On first load after the refactor, detect the absence of the `players` namespace as the upgrade signal. When detected, clear all existing `session`, `inProgressGame`, and `history` data. Initialize empty player roster and empty teams list.

**Rationale**: The spec explicitly states "clear on upgrade — drop existing localStorage data" (Clarifications section). This eliminates backward-compatibility complexity. The detection mechanism (checking for the `players` key) is simple and doesn't require a separate migration version tracker.

**Alternatives considered**:
- Global app version in storage: More robust for future upgrades but YAGNI per Principle V — the spec says no backward compatibility is needed.
- Leave old data intact: Risks rendering errors if old team/player structures are encountered.

## R-007: Statistics Computation

**Decision**: Statistics are computed on-the-fly from the `history` array (already loaded into session state) rather than maintained as a separate aggregate. For per-player stats, iterate over `CompletedGameRecord[]`, match `playerId` from team snapshots, and aggregate games played / won / win rate / breakdown by team and game type. For per-team stats, iterate similarly, matching by team ID.

**Rationale**: With a target of 100+ games (SC-003) and at most 20 players, computing stats on render is O(games × teams × players) which is trivially fast (<1ms). The existing `computeWinSummary.ts` already demonstrates this pattern. Adding a separate stats cache would violate Principle V.

**Alternatives considered**:
- Pre-computed stats stored in their own namespace: More complex, requires cache invalidation, not needed at this scale.
- `useMemo` with dependency on `history`: Yes — use `useMemo` to avoid recomputing on every render, but don't persist the result.

## R-008: Navigation & Routing

**Decision**: Add a `/players` route to the `HashRouter` in `App.tsx`. The Players page is a top-level navigation destination alongside the existing team setup (`/`) and history (`/history`). Navigation from team setup to players (and vice versa) uses simple link/button navigation.

**Rationale**: FR-016 requires a dedicated top-level route. The existing `HashRouter` and `Route` components support this with zero new dependencies. The `NavGuard` in `App.tsx` needs a small update to allow `/players` when a game is in progress (players page is read-only during a game).

**Alternatives considered**:
- Tab bar component: Likely needed for mobile UX but is a UI implementation detail, not an architectural decision.
- Modal overlay for players: Doesn't satisfy the "dedicated route" requirement.
