# Feature Specification: Player Registry & Team Composition

**Feature Branch**: `003-player-registry`  
**Created**: 2026-05-07  
**Status**: Draft  
**Input**: Refactor so players are first-class entities managed independently from teams, enabling per-player and per-team historical statistics.

## User Scenarios & Testing

### User Story 1 — Manage a Player Roster (Priority: P1)

A group of friends plays darts regularly. Before any game, they want to register each person as a player once, then reuse those players across many game sessions without re-entering names every time. They can add new players when someone joins the group and rename players if needed.

**Why this priority**: Players are the foundational entity — nothing else works without a player roster.

**Independent Test**: A user can open the app, navigate to a player management area, add several players by name, see them listed, rename one, and remove one. The roster persists after closing and reopening the app.

**Acceptance Scenarios**:

1. **Given** the app is freshly loaded with no players, **When** the user navigates to player management, **Then** the app shows an empty roster with a prompt to add the first player.
2. **Given** the roster has 0 players, **When** the user adds a player named "Alice", **Then** "Alice" appears in the roster and is persisted across app reloads.
3. **Given** the roster has a player "Alice", **When** the user renames her to "Ali", **Then** the roster shows "Ali" and historical game records still reference the same player.
4. **Given** the roster has a player "Bob" who is not assigned to any team, **When** the user removes "Bob", **Then** "Bob" is no longer available for team assignment but still appears in historical game records.
5. **Given** the roster has a player "Carol" who is currently assigned to a team, **When** the user attempts to remove "Carol", **Then** the system prevents removal and explains the player must be unassigned first.

---

### User Story 2 — Compose Teams from Existing Players (Priority: P1)

Before starting a game, the user creates teams and assigns players from the roster to each team. A player can only belong to one team at a time during team setup. Teams still have display names and colors.

**Why this priority**: Team composition is the bridge between the player roster and the game — it replaces the current inline player creation and is required before any game can start.

**Independent Test**: With players in the roster, the user can create two teams, assign players to each, and see the team composition reflected before starting a game.

**Acceptance Scenarios**:

1. **Given** the roster has players Alice, Bob, Carol, and Dave, **When** the user creates Team 1 and assigns Alice and Bob, **Then** Team 1 shows Alice and Bob as members.
2. **Given** Alice is assigned to Team 1, **When** the user tries to assign Alice to Team 2, **Then** the system prevents the duplicate assignment and indicates Alice is already on Team 1.
3. **Given** a team has 1 player, **When** the user removes that player, **Then** the team has 0 players and cannot start a game until at least 1 player is assigned.
4. **Given** the user has composed two valid teams (each with at least 1 player), **When** the user proceeds to game settings, **Then** the teams and their player assignments are passed to the game as they are today.
5. **Given** teams were set up for a previous session, **When** the user returns to team setup, **Then** the previous team compositions are preserved (teams and their assigned players are remembered).

---

### User Story 3 — View Per-Player Historical Statistics (Priority: P2)

After playing several games across different teams, a player wants to see their personal stats — how many games they played, how many they won, which teams they played on, and across which game types.

**Why this priority**: Per-player stats are the primary motivation for this refactor and deliver the most visible new user value, but they depend on the player roster and team composition being in place first.

**Independent Test**: After completing at least two games with overlapping players on different teams, the user can navigate to a player stats view and see aggregated statistics per player.

**Acceptance Scenarios**:

1. **Given** Alice has played 5 games across two different teams and won 3, **When** the user views Alice's stats, **Then** the view shows games played (5), games won (3), and a breakdown by team.
2. **Given** no games have been completed, **When** the user views the player stats area, **Then** the view shows an empty state indicating no game history yet.
3. **Given** multiple games have been completed under the new player-roster model, **When** the user views player stats, **Then** all games are included in the statistics by matching player IDs from the team snapshots.

---

### User Story 4 — View Per-Team Historical Statistics with Roster (Priority: P2)

After several games, the user wants to see a team's history — which games they played, whether they won, and crucially, which players were on the team at the time of each game.

**Why this priority**: Complements per-player stats and provides the team-level perspective. Builds on the same historical data.

**Independent Test**: After completing games where a team's roster changed between sessions, the user can see the team's game history with the correct player roster shown for each game.

**Acceptance Scenarios**:

1. **Given** Team Red played Game 1 with Alice and Bob, then Game 2 with Alice and Carol, **When** the user views Team Red's history, **Then** each game entry shows the roster at that time (Game 1: Alice, Bob; Game 2: Alice, Carol).
2. **Given** a team has never played a game, **When** the user views that team's history, **Then** the view shows an empty state.

---

### Edge Cases

- What happens when a player is deleted who has historical game records? The player is soft-deleted (removed from active roster for future team assignment) but their name and ID remain in historical records. Soft-deleted players can be restored to the active roster from a "removed players" list, retaining their original ID and accumulated statistics.
- What happens when all players are removed from a team? The team exists but cannot start a game — validation prevents proceeding until at least 1 player is assigned per team.
- What happens when the user tries to create a player with a duplicate name? Duplicate names are allowed (two people might share a name); uniqueness is by ID, not name.
- What happens when the roster is empty and the user tries to set up teams? The team setup area prompts the user to add players first and provides a shortcut to the player management area.
- What happens to the "quick add player inline" flow? During team setup, the user can still create a new player inline (which adds them to both the roster and the team simultaneously) for convenience.
- Maximum number of players in the roster? 20 players maximum to keep the UI manageable for a casual dart game tracker.

## Clarifications

### Session 2026-05-07

- Q: How should existing game history be handled during the refactor (FR-011 contradicts the "clear on upgrade" assumption)? → A: Clear on upgrade — drop existing localStorage data; remove FR-011 backward-compatibility requirement.
- Q: Where should the player management area be accessible from? → A: Dedicated route/tab — a top-level "Players" page alongside existing game/history navigation.
- Q: Are teams persistent first-class entities like players, or session-scoped constructs? → A: Persistent entities — teams are stored independently, have their own IDs, and exist across sessions (reusable, renamable, viewable in stats).
- Q: Where should statistics views be accessible from? → A: Inline — tap a player on the Players page to see their stats; tap a team in team setup to see team stats.
- Q: Can soft-deleted players be reactivated? → A: Yes — soft-deleted players can be restored to the active roster from a "removed players" list.

## Requirements

### Functional Requirements

- **FR-001**: System MUST maintain a persistent player roster independent of teams, stored in its own storage namespace.
- **FR-002**: Users MUST be able to add players to the roster by providing a display name.
- **FR-003**: Users MUST be able to rename players in the roster; the rename propagates to the current team setup but does not alter historical game records (which are snapshots).
- **FR-004**: Users MUST be able to remove players from the roster, provided the player is not currently assigned to a team.
- **FR-005**: System MUST enforce a maximum of 20 players in the roster.
- **FR-006**: System MUST prevent assigning the same player to more than one team simultaneously during team setup.
- **FR-007**: Teams MUST reference players by ID from the roster rather than embedding player data directly.
- **FR-008**: When a game starts, the system MUST snapshot the current team compositions (team + player details) into the game record, preserving the roster at that point in time.
- **FR-009**: System MUST provide a per-player statistics view showing: games played, games won, win rate, and breakdown by team and game type.
- **FR-010**: System MUST provide a per-team statistics view showing: games played, games won, and the player roster for each historical game.
- ~~**FR-011**: Removed — superseded by clarification: existing localStorage data is cleared on upgrade; no backward-compatibility with pre-refactor records required.~~
- **FR-014**: During team setup, users MUST be able to create a new player inline (added to both roster and team simultaneously) for convenience.
- **FR-015**: System MUST validate that each team has at least 1 assigned player before allowing a game to start.
- **FR-016**: The player roster MUST be accessible via a dedicated top-level "Players" route/tab in the app's main navigation, alongside existing game and history navigation.
- **FR-017**: Teams MUST be persistent first-class entities stored in their own storage namespace, each with a unique ID, surviving across sessions independently of game records.
- **FR-018**: Per-player statistics (FR-009) MUST be accessible by tapping/clicking a player on the Players page, displaying stats inline or in a detail view.
- **FR-019**: Per-team statistics (FR-010) MUST be accessible by tapping/clicking a team in the team setup area, displaying stats inline or in a detail view.
- **FR-020**: Users MUST be able to view soft-deleted players in a "removed players" list and restore them to the active roster, preserving their original ID and accumulated statistics.
- **FR-021**: The 20-player roster limit (FR-005) applies only to active (non-deleted) players.

### Key Entities

- **Player**: A person who plays darts. Has a unique ID and display name. Exists independently of any team. Can be assigned to one team at a time for a game session. Accumulates historical statistics across all games and teams.
- **Team**: A persistent, first-class entity with a unique ID, display name, and color. Contains one or more players for a game session. References players by ID. Stored independently in its own storage namespace and exists across sessions — can be reused, renamed, and viewed in statistics.
- **Player Roster**: The top-level collection of all registered players. Source of truth for player identity.
- **Team Composition Snapshot**: A frozen record of which players were on which team at the time a game was played. Stored within each completed game record.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can register a new player in under 5 seconds (name entry + confirmation).
- **SC-002**: Users can compose a 2-team game with 4 total players from an existing roster in under 30 seconds.
- **SC-003**: Per-player statistics are viewable within 1 second of navigation, even with 100+ historical games.
- **SC-004**: All existing game flows (x01, cricket, around-the-clock, mickey-mouse) continue to function identically after the refactor.
- **SC-005**: After upgrade, the app starts with a clean slate — no legacy data corruption or rendering errors.

## Assumptions

- The app remains a single-user, single-device application — no multi-device sync or multi-user accounts are needed.
- Player identity is local to the device — there is no online account system or cross-device identity.
- The existing game engine interfaces (GameManifest, ThrowRecord, InitContext) will continue to receive team + player data in the same shape at game time; the refactor primarily affects how that data is composed before game start.
- The 20-player roster limit is sufficient for a casual dart game tracker used by a friend group.
- Soft-delete for players with history is preferred over hard-delete to preserve statistical integrity.
- The existing 8-team color system and 4-player-per-team limit remain unchanged.
- Data migration from the old embedded-player format is out of scope — existing localStorage data is cleared on upgrade. No backward-compatibility with pre-refactor game records is required.
