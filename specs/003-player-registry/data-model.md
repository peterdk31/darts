# Data Model: Player Registry & Team Composition

## Entities

### RosterPlayer

A player registered in the roster. Extends the existing `Player` type with lifecycle metadata.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique identifier, format: `player-<timestamp36>-<counter>`. Immutable after creation. |
| `displayName` | `string` | User-visible name. Mutable via rename. Max 30 characters. |
| `createdAt` | `string` | ISO 8601 timestamp of when the player was added to the roster. |
| `deletedAt` | `string \| null` | ISO 8601 timestamp of soft-delete, or `null` if active. |

**Validation rules**:
- `displayName` must be non-empty after trimming.
- Duplicate display names are allowed (uniqueness is by `id`).
- Maximum 20 active players (`deletedAt === null`).

**Storage**: `StorageNamespace = "players"` as `VersionedRecord<RosterPlayer[]>`, `schemaVersion: 1`.

### PersistedTeam

A persistent team entity stored independently of game sessions.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique identifier, format: `team-<timestamp36>-<counter>`. Immutable. |
| `displayName` | `string` | User-visible team name. Mutable via rename. Max 40 characters. |
| `colorId` | `TeamColorId` | One of the 8 team colors. |
| `playerIds` | `string[]` | Ordered list of player IDs from the roster assigned to this team. |

**Validation rules**:
- `displayName` must be non-empty after trimming.
- `playerIds` references must point to active (non-deleted) roster players.
- A player ID may appear in at most one team's `playerIds` at a time.
- Maximum 4 players per team, maximum 8 teams.
- Each team must have at least 1 player to start a game.

**Storage**: `StorageNamespace = "teams"` as `VersionedRecord<PersistedTeam[]>`, `schemaVersion: 1`.

### Player (existing, unchanged)

Used at game time and in snapshots. This is the shape that game engines receive.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Matches `RosterPlayer.id` |
| `displayName` | `string` | Snapshot of the name at game start time |

### Team (existing, unchanged)

Used at game time and stored in game record snapshots. Game engines continue to receive this shape.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Matches `PersistedTeam.id` |
| `displayName` | `string` | Snapshot of team name at game start |
| `colorId` | `TeamColorId` | Snapshot of color at game start |
| `players` | `Player[]` | Snapshot of resolved players at game start |

### CompletedGameRecord (existing, unchanged)

Already stores the team snapshot with embedded players. No structural changes needed.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Game ID |
| `gameTypeId` | `string` | Which game type was played |
| `resolvedSettings` | `ResolvedSettings` | Game settings snapshot |
| `teams` | `Team[]` | **Team composition snapshot at game start** |
| `winnerTeamIds` | `string[]` | IDs of winning teams |
| `completedAt` | `string` | ISO 8601 completion timestamp |
| `summary` | `unknown` | Optional game-specific summary |

## Relationships

```text
RosterPlayer (roster)
  │
  │  id ────referenced-by────► PersistedTeam.playerIds[]
  │                                   │
  │                                   │  resolved at game start
  │                                   ▼
  │                             Team (snapshot)
  │                               ├── players: Player[] (expanded from roster)
  │                               └── stored in CompletedGameRecord.teams[]
  │
  └── id ──matches──► CompletedGameRecord.teams[].players[].id
                        (for historical stats lookups)
```

## State Transitions

### Player Lifecycle

```text
                      ┌─────────────┐
          add()       │   ACTIVE    │     rename()
      ──────────────► │ deletedAt:  │ ◄──────────────
                      │    null     │   (stays active)
                      └──────┬──────┘
                             │
                    remove() │ (only if not assigned to any team)
                             │ sets deletedAt = ISO timestamp
                             ▼
                      ┌─────────────┐
                      │  SOFT-DEL   │
                      │ deletedAt:  │
                      │  <string>   │
                      └──────┬──────┘
                             │
                   restore() │ (sets deletedAt = null)
                             │ (only if active count < 20)
                             ▼
                      ┌─────────────┐
                      │   ACTIVE    │
                      └─────────────┘
```

### Team Composition Flow

```text
  Roster ──select players──► PersistedTeam.playerIds[]
                                       │
                              game start│  snapshot / resolve
                                       ▼
                              Team { players: Player[] }
                                       │
                              game ends │
                                       ▼
                              CompletedGameRecord.teams[]
                              (frozen, never mutated)
```

## Storage Namespaces (complete list after refactor)

| Namespace | Type | Schema Version | Description |
|-----------|------|---------------|-------------|
| `"players"` | `VersionedRecord<RosterPlayer[]>` | 1 | **NEW** — Player roster |
| `"teams"` | `VersionedRecord<PersistedTeam[]>` | 1 | **NEW** — Persistent teams |
| `"session"` | `VersionedRecord<{ teams: Team[] }>` | 1 | Existing — team setup working state (will reference persisted teams) |
| `"inProgressGame"` | `VersionedRecord<InProgressGame>` | 1 | Existing — active game state |
| `"history"` | `VersionedRecord<CompletedGameRecord>[]` | 1 | Existing — completed games list |
| `"prefs"` | `VersionedRecord<UserPrefs>` | 1 | Existing — user preferences |
| `"game:*"` | varies | varies | Existing — per-game-module storage |

## Computed Views (not persisted)

### PlayerStats

Computed on-the-fly from `CompletedGameRecord[]` for a given player ID.

| Field | Type | Description |
|-------|------|-------------|
| `playerId` | `string` | The player being summarized |
| `gamesPlayed` | `number` | Count of games where this player appears in any team snapshot |
| `gamesWon` | `number` | Count of games where this player was on a winning team |
| `winRate` | `number` | `gamesWon / gamesPlayed` (0 if no games) |
| `byTeam` | `Map<teamId, { gamesPlayed, gamesWon }>` | Breakdown by team ID |
| `byGameType` | `Map<gameTypeId, { gamesPlayed, gamesWon }>` | Breakdown by game type |

### TeamStats

Computed on-the-fly from `CompletedGameRecord[]` for a given team ID.

| Field | Type | Description |
|-------|------|-------------|
| `teamId` | `string` | The team being summarized |
| `gamesPlayed` | `number` | Count of games where this team participated |
| `gamesWon` | `number` | Count of games where this team won |
| `gameHistory` | `Array<{ record, rosterAtTime: Player[] }>` | Each game with the team's player snapshot |
