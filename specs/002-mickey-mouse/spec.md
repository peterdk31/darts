# Feature 002 — Mickey Mouse

**Type**: Lightweight extension to feature 001-dart-game-tracker (a fourth registered game module).
**Source rules**: https://dart-regler.dk/mickey-mouse/
**Status**: Plan only — not implemented.

## 1. Game rules (as we will encode them)

Mickey Mouse is a race-to-close game. Each team must close nine targets:
the **numbers 15–20** (or **12–20** with a setting), plus three categorical
targets — **Double** (any double), **Triple** (any triple), and **Bull**.

A target closes after **3 marks**. The first team to close all targets wins.
There is no point-scoring variant (rules-page mentions one but we are not implementing it).

### 1.1 Per-throw mark application

Every throw produces zero, one, or two *candidate applications*. When two are
candidates, the player chooses one (mutually exclusive — never both).

| Throw                  | Candidates the chooser may offer*                                          |
|------------------------|----------------------------------------------------------------------------|
| Single N (N is a target row) | 1 mark on N                                                          |
| Double N (N is a target row, threshold met)       | 2 marks on N **or** 1 mark on Double      |
| Triple N (N is a target row, threshold met)       | 3 marks on N **or** 1 mark on Triple      |
| Double N (N **not** a target row, threshold met)  | 1 mark on Double                          |
| Triple N (N **not** a target row, threshold met)  | 1 mark on Triple                          |
| Outer-bull            | 1 mark on Bull                                                              |
| Inner-bull            | 1 mark on Bull (×2 if multiplier setting ON, else ×1) **or** 1 mark on Double |
| MISS / threshold not met / target not in scope | nothing                                            |

\* When the multiplier setting is OFF, "2 marks on N" becomes "1 mark on N" and
"3 marks on N" becomes "1 mark on N" — the chooser still appears (Number vs.
Double/Triple categorical) because the strategic choice still exists, even
though the marks-on-number value is reduced.

\* Options that would do nothing (target already closed) are removed. If only
one candidate remains, it is auto-applied with no modal.

\* Marks beyond 3 on any target are discarded (no overflow scoring).

### 1.2 Win condition

A team wins the moment its last open target reaches 3 marks. The current turn
ends immediately on that throw; remaining darts in the turn are not thrown.

Ties are not reachable in single-team-at-a-time play. We keep the
`winnerTeamIds: string[]` shape for type consistency with Cricket; in practice
it always contains exactly one id.

## 2. Settings

Three settings, all surfaced on the pre-game settings screen (Cricket has
none today; Mickey Mouse and x01 will both have settings chips on the
play screen).

| Key                     | Label                                                  | Type     | Default | Notes                                                                             |
|-------------------------|--------------------------------------------------------|----------|---------|-----------------------------------------------------------------------------------|
| `startingNumber`        | Starting number                                        | choice   | `"15"`  | Choices: `"15"`, `"12"`. Drives the number rows on the scoreboard.                |
| `multipliersScore`      | Multipliers count as 2×/3×                             | toggle   | `true`  | When OFF, doubles/triples on a number give 1 mark only; inner-bull as Bull → 1 mark. |
| `dtRequireTargetRange`  | Doubles/Triples count only at or above starting number | toggle   | `false` | When ON, doubles/triples on numbers below `startingNumber` produce no marks anywhere. |

## 3. Engine state

```ts
export type MickeyTarget =
  | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20
  | "double" | "triple" | "bull";

export interface MickeyEngineState {
  teams: Team[];
  turnOrder: string[];
  dartsPerPlayer: number;
  maxTeamSize: number;
  startingNumber: 12 | 15;
  multipliersScore: boolean;
  dtRequireTargetRange: boolean;
  /** Targets in scoreboard order, derived once at init from startingNumber. */
  targets: MickeyTarget[];
  /** marksByTeam[teamId][targetKey] = 0..3 (clamped at 3, beyond-3 discarded). */
  marksByTeam: Record<string, Record<string, number>>;
  pointer: TurnPointer;
  status: "in-progress" | "won";
  winnerTeamIds: string[] | null;
}
```

`targets` is computed deterministically from `startingNumber`:

- Starting 15 → `[15, 16, 17, 18, 19, 20, "double", "triple", "bull"]` (9 rows)
- Starting 12 → `[12, 13, 14, 15, 16, 17, 18, 19, 20, "double", "triple", "bull"]` (12 rows)

## 4. Choice intent — how the chooser feeds the engine

A new optional field on `ThrowRecord`:

```ts
// shared/types/core.ts
export interface ThrowRecord {
  // … existing fields
  /** Game-specific resolution hint set by the UI before applyThrow. Opaque to other games. */
  intent?: string;
}
```

For Mickey Mouse, the UI sets `intent` to one of:

- `"number"` — apply marks to the number row only.
- `"double"` — apply 1 mark to the Double categorical.
- `"triple"` — apply 1 mark to the Triple categorical.
- `"bull"` — apply marks to Bull only (relevant for inner-bull where Double is the alternative).
- *unset* — engine applies the deterministic default (used when no chooser was needed).

`applyThrowMickey` enumerates the candidates for the throw, filters out closed
targets, and:

- 0 candidates → no marks, advance turn.
- 1 candidate → apply it, ignore `intent` if set.
- 2 candidates → require `intent`. If absent, throw is ignored (defensive — this should never happen because the UI always shows the chooser when there are 2 candidates).

Existing games (x01, Cricket, ATC) ignore `intent` and remain unchanged.

## 5. UI

### 5.1 Chooser modal

Triggered from the play-screen tap handler when the most recent throw has 2
candidates. Renders inside the play screen (not a global modal) so it scrolls
with content on small viewports.

- Two large buttons, one per candidate, labelled with the resulting marks
  (e.g. *"18 ×2"* and *"Double ×1"*).
- Tapping a button records the throw with the chosen `intent` and dismisses.
- No "cancel" — the throw is already physical reality. To take it back the
  user uses the existing single-undo.

### 5.2 Scoreboard

Same structure as Cricket's `ScoreboardPanel.tsx`, with three changes:

- **Rows order**: ascending numbers first (`12..20` or `15..20`), then `D`,
  `T`, `B`. Header labels: the number, then `D` / `T` / `B`.
- **Mark glyph**: render `n` literal `x` characters. At `n = 3`, wrap in an
  element with a `text-decoration: line-through` style (or an SVG diagonal
  if the strikethrough doesn't render thick enough on small displays — TBD
  during implementation, but plain `<s>xxx</s>` is the first attempt).
- **No score column** (race-to-close has no points).

### 5.3 Settings chip on play screen

Mirrors x01's settings chip pattern. Shows "15 • mult • +D/T any" or similar
condensed string so the player can verify configuration without leaving play.
Tap → opens read-only summary (settings are immutable mid-game).

### 5.4 Game selection card

New entry in the game-select grid: title "Mickey Mouse", same card affordance
as the others.

## 6. Acceptance / smoke

Run after implementation, in addition to the existing 44 vitest specs:

1. Start a 2-team Mickey Mouse game with defaults.
2. Throw S20 → 1 mark on 20, no chooser.
3. Throw T20 → chooser appears with "20 ×3" and "Triple ×1". Pick "20 ×3" → 20 closes (xxx struck through).
4. Throw T20 again → chooser shows only "Triple ×1" (20 is closed) → auto-applies.
5. Throw inner-bull → chooser "Bull ×2" / "Double ×1". Pick Bull → 2 marks on Bull row.
6. Hit MISS → no marks, turn advances normally.
7. Toggle `dtRequireTargetRange` ON, restart with starting=15. Throw D14 → no marks, no chooser.
8. Toggle `multipliersScore` OFF. Throw T18 → chooser "18 ×1" / "Triple ×1" (note ×1 not ×3).
9. Close all 9 targets on team A; the closing throw triggers the win banner immediately and the current turn ends even if darts remain.
10. Single-undo reverts the closing throw and resumes play.

## 7. Out of scope (intentional)

- Points-after-close win mode (rules variant — not implemented).
- Fewest-darts win mode.
- Ordered closing (must close 15 before 16, …) — rules variant, not implemented.
- "Inner-bull only counts as bull" mode — not implemented.
- Multi-step undo of choice + throw together — existing single-undo is sufficient; redo from feature 001 iteration 3 covers the rest.
