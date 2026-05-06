# Feature Specification: Dart Game Tracker

**Feature Branch**: `001-dart-game-tracker`  
**Created**: 2026-05-06  
**Status**: Draft  
**Input**: User description: "A webapp for keeping track of different dart games. The player can setup teams of 1-4 players. Each player then has x amounts of darts to throw based on how many darts the game dictates and how many players are in the team. Ie. if the game states that each player has 3 darts, and we have two teams, one with 2 players and another with just 1 player, then the second teams player has 6 darts. The flow is: 1) Create the teams 2) Choose the game 3) Play the game on a real dartboard and mark on a virtual dartboard where each arrow hits 4) Keep track of which team/players turn it is 5) Keep track of the scoreboard 6) When a team wins, keep track of that 7) Select a new game"

## Clarifications

### Session 2026-05-06

- Q: In Cricket, what happens when a team closes all 7 numbers but trails on points? → A: Play continues; the all-closed team keeps scoring on numbers it has closed but at least one opponent has not, until some team has both closed all numbers AND is leading or tied on points.
- Q: What happens to an in-progress game when the user starts a new one? → A: Prompt the user to confirm abandoning it; on confirm, discard silently (no session-history entry); on cancel, return to the in-progress game.
- Q: How should session history be bounded given localStorage limits? → A: Unbounded — keep every completed game forever; if a localStorage write fails, surface a clear error to the user prompting them to manually clear history.
- Q: How should per-match game options (like double-out for 501/301) be handled in v1? → A: Each game type defines its own settings schema with sensible defaults; after picking a game and before starting it, the user is shown that game's settings and may edit them.
- Q: Must player display names be unique? → A: No uniqueness constraint; players are tracked by an internal id, and the UI shows the team name alongside the player name everywhere a player is identified to disambiguate.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Set up teams, play a game, and crown a winner (Priority: P1)

A group gathers around a physical dartboard with one device (phone, tablet, or laptop) running the webapp. The host names each team, adds 1-4 players to each team, picks a dart game, then for every dart actually thrown at the physical board taps the corresponding spot on the on-screen dartboard. The app advances turns automatically, updates the scoreboard live, and announces the winning team when game-end conditions are met.

**Why this priority**: This is the entire core loop the user described (steps 1-6). Without it the product has no value; with it alone the product is already useful at a real darts night.

**Independent Test**: Two people walk up to a dartboard with the app open. They create "Team A" (2 players) and "Team B" (1 player), pick a supported game, tap dart hits on the virtual board for several turns, and the app correctly tracks turns, totals, and ultimately declares a winner. No other feature is required for this to be a complete experience.

**Acceptance Scenarios**:

1. **Given** the app is open on the team-setup screen, **When** the host adds Team A with 2 players and Team B with 1 player and continues, **Then** both teams appear with their players and the app proceeds to game selection.
2. **Given** a game is chosen that allots 3 darts per player per turn and the largest team has 2 players, **When** play begins, **Then** every team is allotted 6 darts per turn (Team A's 2 players throw 3 each; Team B's 1 player throws all 6).
3. **Given** it is Player 1 of Team A's turn with 3 darts remaining, **When** the user taps a triple-20 segment on the virtual board, **Then** the scoreboard updates by 60, the dart count decrements, and the indicator stays on Player 1 until all their darts are thrown.
4. **Given** Player 1 of Team A has thrown all their darts, **When** the user confirms end-of-player, **Then** the turn indicator advances to Player 2 of Team A (or to Team B if Team A's turn is complete).
5. **Given** a team meets the win condition for the chosen game, **When** the winning dart is recorded, **Then** the app halts further input, displays the winning team prominently, and records the result.
6. **Given** a dart misses the board entirely, **When** the user marks the throw as a miss, **Then** the dart counts as thrown but adds 0 to the score.
7. **Given** the user taps the wrong segment, **When** they undo the last recorded throw, **Then** the score, dart count, and turn indicator revert to the state before that throw.

---

### User Story 2 - Track wins across multiple games in a session (Priority: P2)

After a game ends the host taps "New Game", optionally keeps the same teams or edits them, picks a (possibly different) game, and plays again. The app remembers which team won previous games in this session so a running win tally is visible.

**Why this priority**: The user's flow ends with "Select a new game" and "When a team wins, keep track of that," implying multiple games per gathering and a running record. Useful but not required for a single game to work.

**Independent Test**: Play two short games back-to-back. After the first game ends, choose "New Game", reuse the same teams, play another game, and verify the wins screen shows both results with correct winners.

**Acceptance Scenarios**:

1. **Given** a game has just ended with Team B as winner, **When** the user chooses "New Game" and "Keep teams", **Then** the same teams and players are reused and game selection appears.
2. **Given** two games have completed (Team A won game 1, Team B won game 2), **When** the user opens the session summary, **Then** both results are listed with team name, game type, and date/time.
3. **Given** a new game is starting, **When** the user chooses "New Teams", **Then** all team and player data is cleared and the team-setup screen is shown.

---

### User Story 3 - Correct mistakes during play (Priority: P3)

Mis-taps are inevitable when scoring quickly. The user can undo the last recorded throw or several recent throws to fix mistakes without restarting the game.

**Why this priority**: Improves usability and trust in the score, but a strict-mode game could function without it. Lower priority than the core loop and history.

**Independent Test**: During an in-progress game, deliberately tap the wrong segment, press undo, then tap the correct segment, and verify the scoreboard, turn, and dart count are exactly what they would have been with no mistake.

**Acceptance Scenarios**:

1. **Given** the last throw recorded was a triple-20 (60), **When** the user taps "Undo", **Then** 60 is removed from the team's score and the player has one more dart to throw.
2. **Given** the user has undone two throws in a row, **When** they tap "Redo" once, **Then** the most recently undone throw is reapplied.

---

### Edge Cases

- **Single-player team vs. multi-player team**: Smaller teams get the same total darts per turn as the largest team; the per-player allocation in a smaller team is split as evenly as possible, with any remainder thrown by the earliest player in rotation. Example: max team size 4, this team has 3 players, game = 3 darts/player → team allotment 12; players throw 4-4-4. Max 4, this team has 3, game = 4 darts/player → 16 total; players throw 6-5-5.
- **Bust / invalid score** (e.g., 501 going below 0 or finishing on a non-double when game requires double-out): the throw is recorded as a dart used, the team's score reverts to what it was at the start of the turn, and the turn ends.
- **Tie at end of last turn**: handled per game rules — most score-down games have a single winner by definition; for games where a tie is possible, both teams are recorded as co-winners or play continues per the game's tie-break rule.
- **Dart misses the board**: recorded as a thrown dart with score 0.
- **User closes the browser mid-game**: in-progress game state is restored on next open from local storage; if storage is cleared, the game is lost.
- **Adding/removing a player after a game has started**: not allowed mid-game; teams are fixed once a game begins. Changes require finishing or abandoning the current game.
- **Less than 2 teams**: the app prevents starting a game with fewer than 2 teams.
- **More than 4 players in a team**: the app prevents adding a 5th player.

## Requirements *(mandatory)*

### Functional Requirements

#### Team and player setup

- **FR-001**: Users MUST be able to create between 2 and 8 teams before starting a game.
- **FR-002**: Each team MUST have between 1 and 4 players. Each player MUST have a display name and an internal identifier that is unique within the match. Display names are NOT required to be unique within a team or across teams; the internal identifier is what links throws and turn pointers to a specific player.
- **FR-002a**: Wherever a player is identified in the UI (turn indicator, scoreboard per-player breakdown, throw history, end-of-game summary), the player's team name MUST be shown alongside the player display name to disambiguate when display names are repeated.
- **FR-002b**: Each team MUST have a color identifier drawn from a predefined palette of 8 distinguishable hues (red, green, orange, purple, teal, pink, yellow, cyan). Colors MUST be auto-assigned at team-creation time as the first palette entry not currently held by another team; users MUST be able to override the assigned color via a swatch picker on the team setup screen. When a team is removed, its color is released back to the available pool and MAY be reassigned to the next team created. Team color MUST be displayed as a stripe on the turn indicator card, a small dot beside the team name in the scoreboard, and as the color of the team's dart-tap markers on the virtual board during their turn. A numeric team badge ("Team 1", "Team 2", …, in creation order) MUST also be shown alongside the team's display name everywhere the team is identified, for accessibility (color-blind users) and disambiguation when display names overlap.
- **FR-003**: Users MUST be able to rename, reorder, add, and remove teams and players freely until a game starts.
- **FR-004**: The app MUST prevent starting a game with fewer than 2 teams or with any team that has 0 players.

#### Game selection

- **FR-005**: Users MUST be able to choose a game from a list of supported game types before each game begins.
- **FR-006**: Each game type MUST declare its rules including: starting score (if any), darts-per-player-per-turn, win condition, bust rule (if any), and any double-in/double-out requirement. Each game type MUST also declare a (possibly empty) **settings schema** of per-match configurable options, each with a name, type (e.g., toggle, integer, choice), and a default value.
- **FR-006a**: After the user picks a game type and before play begins, the app MUST present that game type's settings schema with current defaults populated, and MUST allow the user to edit each setting within its declared constraints. The chosen settings MUST be locked in for the duration of that match and MUST be recorded with the match's history entry on completion.
- **FR-007**: Supported game types in v1 MUST include the following four games. Each game's per-match settings (if any) are listed; defaults are shown in parentheses:
  - **501** — each team starts at 501; throws subtract from the score; first team to reach exactly 0 wins. Going below 0 is a bust (turn ends, score reverts to start-of-turn). Per-match settings: **double-out** (default off — finishing dart need not be a double), **double-in** (default off — first scoring dart need not be a double).
  - **301** — identical to 501 except the starting score is 301. Per-match settings: same as 501 (double-out default off, double-in default off).
  - **Cricket** — teams attempt to "close" the numbers 20, 19, 18, 17, 16, 15, and bull (25/50). A number is closed when a team has hit it 3 times (singles=1, doubles=2, triples=3 toward closing). Once a team has closed a number that opponents have not, further hits on that number score points equal to the number's face value (50 for inner bull, 25 for outer bull). If a team closes all 7 numbers but trails another team on points, play continues: the all-closed team keeps throwing and may still score on any of its closed numbers that at least one opponent has not also closed. The game ends — and that team wins — only when some team has BOTH closed all numbers AND has a score greater than or equal to every other team. Per-match settings: none in v1.
  - **Around the Clock** — players/teams must hit each segment from 1 through 20 in order, then bull, using single-segment hits. The first team to hit bull (after completing 1-20) wins. Multipliers count as a single hit on that number. Per-match settings: none in v1.

#### Dart allotment per turn

- **FR-008**: For each turn, every team MUST be allotted the same total number of darts equal to `darts_per_player × max_team_size_in_this_match`.
- **FR-009**: Within a team, the per-turn dart allotment MUST be split as evenly as possible across that team's players; any remainder is thrown by players earliest in the team's rotation order.
- **FR-010**: Player rotation order within a team MUST be determined at team setup and remain fixed for the duration of the game.

#### Recording throws on the virtual dartboard

- **FR-011**: The app MUST display an interactive virtual dartboard that visually matches a standard 20-segment dartboard with single, double, triple, outer-bull (25), and inner-bull (50) regions.
- **FR-012**: Tapping/clicking a region MUST record one dart at that score (segment number × multiplier, or 25/50 for the bulls).
- **FR-013**: A clearly labelled "MISS" tap zone MUST be available to record a dart that hit no scoring region (counts as a thrown dart with score 0). The zone is the area immediately surrounding the dartboard SVG within the dartboard component's bounds, prominently labelled "MISS"; no separate Miss button is required.
- **FR-014**: After each recorded dart the app MUST update the team's running score, decrement the player's remaining darts, and visually indicate the next throw.

#### Turn management

- **FR-015**: The app MUST clearly show whose turn it is at all times (team name + player name + darts remaining this turn).
- **FR-016**: When a player's allotment of darts has been thrown, the app MUST advance to the next player in rotation; when the team's allotment is exhausted, it MUST advance to the next team.
- **FR-017**: Team turn order MUST be determined at game start and cycle in the same order for every round.

#### Scoreboard

- **FR-018**: The app MUST display a live scoreboard showing each team's current score (or whatever metric the game uses, e.g., closed numbers in Cricket) at all times during play.
- **FR-019**: The scoreboard MUST show per-player contributions (last throw, last turn total, or current turn running total — whichever is most relevant for the chosen game).

#### Win detection and recording

- **FR-020**: The app MUST detect when a team meets the chosen game's win condition immediately after the deciding dart is recorded.
- **FR-021**: On win detection, the app MUST stop accepting further throws for that game, prominently display the winning team, and record the outcome (winning team, game type, date/time) in session history.
- **FR-022**: After a game ends, users MUST be able to start a new game while keeping the same teams or resetting to fresh team setup.
- **FR-022a**: If the user attempts to start a new game while one is in-progress, the app MUST prompt for explicit confirmation that the in-progress game will be abandoned. On confirmation, the in-progress game MUST be discarded with no entry in session history; on cancel, the user MUST be returned to the in-progress game in its prior state.

#### Mistake correction

- **FR-023**: Users MUST be able to undo the most recent recorded throw, restoring score, dart count, and turn indicator to the prior state. Multiple consecutive undos MUST walk back through history.
- **FR-024**: Users MUST be able to redo an undone throw if no new throw has been recorded since the undo.

#### Persistence

- **FR-025**: In-progress game state (teams, current scores, turn position, throw history) MUST survive a page reload on the same device.
- **FR-026**: Completed-game results within a session MUST be viewable until the user explicitly clears history or starts fresh.
- **FR-027**: Completed-game results MUST persist on the same device/browser across reloads and reopenings via local browser storage, and MUST remain available until the user explicitly clears history. Session history is unbounded — no automatic eviction, time-based purge, or per-session reset. Cross-device sync, accounts, and cloud backup are out of scope for v1.
- **FR-027a**: If a write to local browser storage fails (e.g., quota exceeded), the app MUST surface a clear, non-dismissable-until-acknowledged error to the user identifying the cause and prompting them to clear history (or other stored data) to free space. The app MUST NOT silently drop or evict history entries to recover.

#### User interface preferences

- **FR-028**: The dartboard MUST support two visual themes — "traditional" (regulation black/cream/red/green palette) and "desaturated" (lower-contrast palette intended for low-light play environments). Traditional MUST be the default. The chosen theme MUST persist on the same device across reloads. A theme picker MUST be reachable from the play screen via a small settings affordance (e.g., a gear icon).
- **FR-029**: For x01-family games (501 and 301), when an active player's team score is ≤ 170 and the match's `doubleOut` setting is on, the play screen MUST display a suggested checkout combination for the active player (e.g., "needs 32: T8 → DB"). When the score is > 170, `doubleOut` is off, or no valid checkout exists, no hint is shown. Checkout hints are advisory only; the app does not validate the user's actual throws against the suggested combination.
- **FR-030**: When a player busts (e.g., 501 score going below 0, or finishing on a non-double when double-out is required), the app MUST display a clear visual indication that a bust has occurred and that the team's score has been reverted to its start-of-turn value, before advancing to the next turn.

### Key Entities

- **Team**: A named group of 1-4 players competing as a unit. Has display name, ordered list of players, rotation order, color identifier (one of 8 palette hues per FR-002b), current per-game score, and per-game win/loss record within the session.
- **Player**: A named individual belonging to exactly one team for the duration of a game. Has an internal identifier unique within the match, a display name (not required to be unique), and (optionally) a per-turn dart count distinct from teammates when team size is below the max. Throws and turn pointers reference players by their internal identifier.
- **Game Type**: A named ruleset specifying starting score, darts per player per turn, win condition, bust rule, and any in/out-modifier requirements (e.g., double-out). Each Game Type also declares a **settings schema** (zero or more per-match configurable options, each with name, type, allowed values, and default).
- **Game**: A single play-through. Has a chosen Game Type, the **resolved settings** chosen for this match (the values selected from the Game Type's settings schema), a list of competing Teams, a turn pointer (current team + current player + darts remaining), an ordered history of Throws, status (in-progress / completed), and a winner (once completed).
- **Throw**: A single recorded dart. Has the player who threw it, the segment hit (number 1-20, 25 for outer bull, 50 for inner bull, or "miss"), the multiplier (1, 2, or 3), the resulting score value, and a timestamp.
- **Session History**: An ordered list of completed Games within the current usage session, each with winning team, game type, and date/time.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A host can complete team setup (2 teams, 4 total players) and reach the "ready to throw" screen in under 60 seconds from opening the app.
- **SC-002**: 95% of dart taps on the virtual board correctly register the intended segment on the first attempt, as judged by a test panel of 10 users playing on a typical phone screen.
- **SC-003**: From the moment a real dart lands to the moment its score is recorded on screen, the average user can complete the tap in under 3 seconds.
- **SC-004**: Across an entire game, the displayed scoreboard matches an independently kept paper scoresheet 100% of the time when no undo is used.
- **SC-005**: After a game ends, a user can start the next game (same teams) in under 10 seconds.
- **SC-006**: 90% of new users can complete an entire game from setup to declared winner without consulting outside help.
- **SC-007**: An in-progress game that is interrupted by a page reload is restored to the exact pre-reload state in under 2 seconds.

## Assumptions

- **Single shared device**: The app runs on one device (phone, tablet, or laptop) shared by all players around the dartboard. There is no real-time multi-device sync in v1.
- **No accounts or sign-in**: Anyone can open the app and use it. There is no per-user login, no friend lists, no cloud profile in v1.
- **Modern browser**: Users are on a current evergreen browser with local storage available; offline-first behaviour after first load is desirable but not strictly required.
- **Manual scoring**: Users tap each dart's location themselves; the app does not connect to electronic dartboards or use camera-based detection in v1.
- **Standard 20-segment board**: The virtual board reflects a regulation 20-segment dartboard with double/triple rings and bulls. Soft-tip / electronic / non-standard layouts are out of scope for v1.
- **Equal team-darts allotment**: Each team throws the same total number of darts per turn (`darts_per_player × max_team_size`), with smaller teams splitting their allotment as evenly as possible across players (remainder to earliest in rotation).
- **One game at a time**: Only one in-progress game exists per device at any moment. Starting a new game ends the previous in-progress game.
- **English-only display in v1**: Localization is out of scope for v1.
- **Persistence is local-only**: Game state and history live in the device's browser storage. Clearing browser data erases history; there is no cloud backup.
