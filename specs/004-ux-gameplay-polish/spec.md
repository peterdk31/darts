# Feature Specification: UX & Gameplay Polish

**Feature Branch**: `004-ux-gameplay-polish`
**Created**: 2026-05-08
**Status**: Draft
**Input**: User feedback — 11 items covering in-game usability, visual correctness, and new gameplay features

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Always Know Whose Turn It Is (Priority: P1)

During a game, the player should always be able to see whose turn it is without scrolling. The turn indicator sticks to the top of the screen, and when a turn switches to a new team/player, a prominent full-screen overlay briefly announces the next player's name and team color before play resumes.

**Why this priority**: Players physically share a device. Knowing whose turn it is at all times is the single most important piece of in-game information. Missed turns or confusion about whose throw it is disrupts the flow.

**Independent Test**: Start a multi-team game, scroll the page, and confirm the turn indicator remains visible. Throw three darts to trigger a turn switch and confirm the overlay appears with the next player's name.

**Acceptance Scenarios**:

1. **Given** a game is in progress, **When** the page is scrolled, **Then** the turn indicator remains fixed at the top of the viewport.
2. **Given** a team just finished their darts, **When** the turn advances to the next team, **Then** a full-screen overlay appears showing the next player's name and team color.
3. **Given** the player switch overlay is showing, **When** the user taps the overlay or 2 seconds elapse, **Then** the overlay dismisses and play resumes.
4. **Given** a bust occurs, **When** the bust banner is dismissed, **Then** the player switch overlay appears for the next player before play resumes.

---

### User Story 2 - Easily Record a Miss (Priority: P1)

The "Miss" button should be immediately visible and accessible during gameplay, not hidden below the dartboard. A player should be able to record a miss with a single, obvious tap.

**Why this priority**: Miss is the most common non-scoring action. If it's hard to find, every miss slows the game down.

**Independent Test**: Open a game and confirm the Miss button is visible without scrolling, positioned prominently near or on the dartboard area.

**Acceptance Scenarios**:

1. **Given** a game is in progress, **When** the player looks at the play screen, **Then** the Miss button is prominently visible without scrolling.
2. **Given** the Miss button is visible, **When** the player taps it, **Then** a miss is recorded for the current player's turn.

---

### User Story 3 - Correct Dartboard Colors (Priority: P1)

The dartboard's segment colors should match a real dartboard. Segment 20 (top of the board) should be black, not cream/white.

**Why this priority**: Incorrect colors make the board look wrong to any dart player. This is a visual correctness bug.

**Independent Test**: Open a game with the classic dartboard and verify that the segment at the top (20) is black and the segment to its right (1) is cream/white.

**Acceptance Scenarios**:

1. **Given** the classic dartboard is displayed, **When** the user looks at segment 20, **Then** it is rendered in the dark (black) color.
2. **Given** the classic dartboard is displayed, **When** the user looks at segment 1, **Then** it is rendered in the light (cream) color.

---

### User Story 4 - Clear Hit Marks After Bust (Priority: P1)

When a player busts, the dart hit marks (dots) from that turn should be removed from the board immediately. Leaving them visible is misleading since the busted turn's throws are reverted.

**Why this priority**: Stale dots after a bust create confusion about what actually counted.

**Independent Test**: In a game that supports busting (e.g., x01), throw darts that cause a bust and confirm the dots are cleared when the bust banner appears.

**Acceptance Scenarios**:

1. **Given** a player has thrown darts this turn, **When** a bust occurs, **Then** all dart dots from that turn are immediately removed from the board.
2. **Given** a bust banner is showing, **When** the user looks at the dartboard, **Then** no dots from the busted turn are visible.

---

### User Story 5 - Mickey Mouse Globally Closed Cells (Priority: P2)

In Mickey Mouse, when all teams have 3 marks on a target, that row should look clearly "done" — visually distinct from rows where only the current team has completed it but others haven't.

**Why this priority**: Players need to quickly scan the board to see what targets are still in play for anyone. The current styling only reflects the active team's state.

**Independent Test**: Play a Mickey Mouse game with 2 teams. Close a target for both teams (3 marks each) and verify the row has a distinct "globally closed" appearance compared to a row where only one team has 3 marks.

**Acceptance Scenarios**:

1. **Given** all teams have 3 marks on a target, **When** the scoreboard renders, **Then** the entire row for that target has a distinct "globally closed" visual treatment (e.g., muted background, full strikethrough on target label).
2. **Given** only the current team has 3 marks on a target but other teams do not, **When** the scoreboard renders, **Then** the row is styled as "disabled for current team" but not globally closed.
3. **Given** a target becomes globally closed mid-game, **When** the last team's third mark is recorded, **Then** the row immediately transitions to the globally closed style.

---

### User Story 6 - Long Names Display Gracefully (Priority: P2)

Player and team names that exceed available space should be truncated with an ellipsis rather than breaking layouts. This applies to the turn indicator, scoreboard headers, game end results, and history page.

**Why this priority**: Long names breaking layouts degrades the experience for everyone in the session.

**Independent Test**: Create a player with a 30-character name, start a game, and verify all screens truncate the name gracefully.

**Acceptance Scenarios**:

1. **Given** a player has a long name (e.g., 25+ characters), **When** the turn indicator card renders, **Then** the name is truncated with ellipsis and the card layout is not broken.
2. **Given** a team has a long name, **When** any scoreboard header renders, **Then** the name fits within its column with ellipsis if needed.
3. **Given** long names exist, **When** the game end page and history page render, **Then** names are truncated gracefully and layouts remain intact.

---

### User Story 7 - Lumberjack Settings Chip Accuracy (Priority: P2)

The settings chip in Lumberjack should always display the current double/triple setting value, not only when one option is active. Players should see "D/T any" or "D/T 16+" at all times.

**Why this priority**: Consistent settings display helps players remember what rules are in effect.

**Independent Test**: Start a Lumberjack game with dtAbove15Only off, and verify the chip shows "D/T any". Start another with it on and verify "D/T 16+".

**Acceptance Scenarios**:

1. **Given** a Lumberjack game with dtAbove15Only set to false, **When** the scoreboard renders, **Then** the settings chip displays "D/T any".
2. **Given** a Lumberjack game with dtAbove15Only set to true, **When** the scoreboard renders, **Then** the settings chip displays "D/T 16+".

---

### User Story 8 - Remove Quick Add Player (Priority: P2)

The "Quick add player" inline form on the team setup page should be removed entirely. Players should be added only through the main player management flow.

**Why this priority**: The quick-add feature adds UI clutter and a redundant workflow that confuses the setup flow.

**Independent Test**: Open the team setup page and confirm there is no "Quick add player" button or inline form on any team card.

**Acceptance Scenarios**:

1. **Given** the team setup page is displayed, **When** the user views a team card, **Then** there is no "Quick add player" button or inline form.
2. **Given** the quick-add code is removed, **When** the app builds, **Then** no build errors or dead references remain.

---

### User Story 9 - View Final Scoreboard in History (Priority: P3)

After a game ends, the full final scoreboard should be viewable later from the history page. Each completed game entry should be expandable to show the detailed scoreboard (same data as during the game).

**Why this priority**: Players want to review past results in detail, not just see who won. This is a "nice to have" that adds depth to the history feature.

**Independent Test**: Complete a game, navigate to history, expand the completed game entry, and verify the full scoreboard is displayed with all team/player data.

**Acceptance Scenarios**:

1. **Given** a game has been completed, **When** the history page renders, **Then** each game entry has an expand/collapse control.
2. **Given** a completed game entry is expanded, **When** the user views it, **Then** the full final scoreboard is displayed (same layout as during the game).
3. **Given** an older game was completed before this feature was added, **When** the user expands it, **Then** a graceful fallback message is shown instead of the scoreboard.

---

### User Story 10 - Shanghai Instant Win Rule (Priority: P3)

An optional setting (default off) called "Shanghai" can be enabled for any game. If a player hits a single, double, and triple of the same number across their three darts in one turn, that team immediately wins.

**Why this priority**: Shanghai is an exciting optional rule that adds drama. It's lower priority because it's a new gameplay mechanic that requires cross-game changes.

**Independent Test**: Enable Shanghai in game settings, start a game, and throw single 20, double 20, triple 20 in one turn. Verify the game ends immediately with that team as the winner.

**Acceptance Scenarios**:

1. **Given** Shanghai is enabled, **When** a player throws single N, double N, and triple N of the same number in one turn (in any order), **Then** that team wins immediately.
2. **Given** Shanghai is disabled (default), **When** a player throws single, double, and triple of the same number, **Then** the game continues normally.
3. **Given** Shanghai is enabled, **When** a player throws single 20 and double 20 but misses the third dart, **Then** no Shanghai is triggered.
4. **Given** Shanghai is enabled, **When** a player hits single 20, double 20, and triple 19 (different numbers), **Then** no Shanghai is triggered.
5. **Given** Shanghai is enabled in the game settings page, **When** the user views the settings, **Then** there is a toggle for "Shanghai" with a brief description, defaulting to off.

---

### Edge Cases

- What happens when the player switch overlay and bust banner need to appear back-to-back? The bust banner shows first; after dismissal, the player switch overlay appears.
- What happens when a Shanghai is scored simultaneously with a bust condition? Shanghai win takes precedence — the team wins.
- What happens when a turn switch overlay appears but the user immediately taps the dartboard? The overlay blocks interaction until dismissed.
- What happens when all targets in Mickey Mouse are globally closed? The game should already be won at that point per existing game logic.
- What happens if a completed game record from before this update has no stored engine state? The history detail view shows a fallback ("Detailed scoreboard not available for this game").

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The turn indicator MUST remain fixed at the top of the viewport during gameplay (sticky positioning).
- **FR-002**: A full-screen player switch overlay MUST appear when the turn advances to a new team, displaying the next player's name and team color.
- **FR-003**: The player switch overlay MUST dismiss on tap or after 2 seconds, whichever comes first.
- **FR-004**: When a bust banner is active, the player switch overlay MUST appear only after the bust banner is dismissed.
- **FR-005**: The player switch overlay MUST block dartboard interaction while visible.
- **FR-006**: The Miss button MUST be prominently positioned and visible without scrolling during gameplay.
- **FR-007**: On the classic dartboard, segment 20 (index 0) MUST be rendered in the dark color, and segment 1 (index 1) in the light color, matching a real dartboard.
- **FR-008**: When a bust occurs, all dart hit marks (dots) from the current turn MUST be cleared immediately from the dartboard.
- **FR-009**: In Mickey Mouse, rows where all teams have 3 marks MUST have a distinct "globally closed" visual style, different from rows where only the current team has 3 marks.
- **FR-010**: Player and team names MUST be truncated with ellipsis when they exceed their container's available width, across all screens (turn indicator, scoreboards, game end, history).
- **FR-011**: The Lumberjack scoreboard settings chip MUST always display the D/T setting value ("D/T any" when off, "D/T 16+" when on).
- **FR-012**: The "Quick add player" feature MUST be removed from the team setup page with no dead code remaining.
- **FR-013**: Completed game records MUST persist the final engine state so full scoreboards can be rendered later.
- **FR-014**: The history page MUST provide an expandable detail view per completed game showing the full final scoreboard.
- **FR-015**: History entries from before this update that lack engine state MUST show a graceful fallback.
- **FR-016**: All game types MUST include an optional "Shanghai" setting (default off) in their settings schema.
- **FR-017**: When Shanghai is enabled, the system MUST detect when a player hits single, double, and triple of the same number in one turn (any order) and trigger an immediate win.
- **FR-018**: Shanghai detection MUST only consider numeric segments (1-20), not bull.

### Key Entities

- **Player Switch Overlay**: A transient full-screen element displaying the next player's name and team color during turn transitions. Coordinates with the bust banner.
- **Shanghai Detection**: A per-turn check that examines all three darts thrown by a player to determine if they form a single+double+triple of the same number.
- **Completed Game Record (extended)**: The existing history record, extended to include the final engine state for scoreboard replay.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The active player's identity is visible at all times during gameplay — 0% of game states where the turn indicator is scrolled out of view.
- **SC-002**: The Miss button can be tapped within 1 second of deciding to record a miss, without scrolling.
- **SC-003**: Dartboard segment colors match real-world dartboard coloring (verifiable by visual comparison).
- **SC-004**: After a bust, 0 stale dart dots remain visible on the board.
- **SC-005**: In Mickey Mouse, globally closed targets are visually distinguishable from partially closed targets with 100% accuracy on inspection.
- **SC-006**: Names up to 30 characters do not break any layout on any screen.
- **SC-007**: All game settings chips accurately reflect the active setting values.
- **SC-008**: 100% of completed games post-update have viewable scoreboards in history.
- **SC-009**: Shanghai detection correctly identifies all valid single+double+triple combinations (any order) with 0 false positives.
- **SC-010**: All 11 feedback items are addressed with no regressions in existing game functionality.

## Assumptions

- The app is used on mobile devices where screen space is limited; the sticky header and Miss button placement prioritize mobile viewports.
- The player switch overlay should be lightweight (CSS/React state only) — no audio or complex animations.
- Shanghai applies only to numeric segments 1-20 (not bull, which has no single/double/triple distinction).
- The existing `dartsPerPlayer` allotment is 3 for all current games, which is the assumed dart count for Shanghai detection.
- History entries created before the engine state persistence feature will gracefully degrade with a fallback message.
- The "Quick add player" removal is permanent — there is no replacement inline-add feature planned.
- The globally closed styling in Mickey Mouse should be clearly distinct from the "disabled for current team" styling, using a different visual treatment (e.g., muted/grayed background for the entire row vs. just strikethrough text).
