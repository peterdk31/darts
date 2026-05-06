# Contract: Game Module

**Feature**: 001-dart-game-tracker
**Audience**: anyone implementing a new game (501, 301, Cricket, Around the Clock, or any future game) under `src/games/<game>/`.
**Authority**: Constitution Principle I (Module-First Game Architecture).

This is the only surface the shell uses to drive a game. The shell does not import anything else from a game module.

---

## File layout (per module)

```text
src/games/<gameId>/
├── manifest.ts        # exports GameManifest (or GameManifest[] — see "Multiple registered types")
├── engine.ts          # pure logic: init, applyThrow, selectScoreboard
├── ui/                # React components for game-specific panels
│   ├── ScoreboardPanel.tsx
│   └── (optional)     # other panels
├── storage.ts         # module-owned schema version + migrations (if any module-private state exists)
└── (tests/)           # module-local tests are encouraged
```

The single registry entry point is `src/games/registry.ts`, which imports each module's manifest and exposes them by id. Adding a new module is **one new directory + one new line in `registry.ts`** (Gate I.b).

---

## TypeScript contract

```ts
// Defined in src/shared/types/game-module.ts and imported by every module.

import type { ReactNode } from "react";
import type { Team, Player, ThrowRecord } from "@/shared/types/core";

/** Stable identifier for a registered game type. Globally unique within the registry. */
export type GameTypeId = string;

/** Per-match configurable option, declared by the module's manifest. */
export type SettingDefinition =
  | { key: string; label: string; type: "toggle";  default: boolean; }
  | { key: string; label: string; type: "integer"; default: number;  constraints: { min: number; max: number; step?: number; }; }
  | { key: string; label: string; type: "choice";  default: string;  constraints: { choices: ReadonlyArray<{ value: string; label: string }>; }; };

/** Values chosen by the user for a specific match, keyed by SettingDefinition.key. */
export type ResolvedSettings = Readonly<Record<string, boolean | number | string>>;

/** Effects emitted by applyThrow that the shell must react to. The shell does not interpret module-private state. */
export type ThrowEffect =
  | { kind: "scored"; teamId: string; delta: number /* may be 0 */ }
  | { kind: "bust";   teamId: string;                      /* turn ends; shell discards in-turn throws per FR bust rule */ }
  | { kind: "turnAdvance"; nextTeamId: string; nextPlayerId: string; }
  | { kind: "gameWon"; winnerTeamIds: string[]; summary?: unknown };

/** What applyThrow returns. New state is the new opaque engine state; effects drive shell behaviour. */
export interface ApplyThrowResult<EngineState> {
  state: EngineState;
  effects: ThrowEffect[];
}

/** Init context the shell provides to a game when starting a match. */
export interface InitContext {
  teams: ReadonlyArray<Team>;
  resolvedSettings: ResolvedSettings;
  /** Shell-derived helpers a module may use; modules MUST NOT mutate or extend them. */
  helpers: {
    /** Per-player allotment for a given team (see data-model.md "Derived rules"). */
    allotmentForPlayer(teamId: string, playerIndexInTeam: number): number;
    /** Total team allotment per turn. */
    teamAllotment(teamId: string): number;
  };
}

/** What the scoreboard renderer needs from the module to draw the live scoreboard. */
export interface ScoreboardSummary {
  /** One row per team in turn order. */
  rows: ReadonlyArray<{
    teamId: string;
    /** The headline metric the game wants displayed (e.g., "score: 421" for x01, "closed: 4 / 7  •  pts: 60" for cricket). */
    primary: string;
    /** Optional per-player line (FR-019) — last throw, last turn total, or current-turn running total. */
    perPlayer?: ReadonlyArray<{ playerId: string; line: string }>;
  }>;
}

/** The manifest each game module exports. */
export interface GameManifest<EngineState = unknown> {
  /** Unique id, e.g. "x01.501", "x01.301", "cricket", "around-the-clock". MUST be stable forever — it is what history records reference. */
  id: GameTypeId;
  displayName: string;

  /** Base rules surfaced to the shell. */
  dartsPerPlayer: number;
  settingsSchema: ReadonlyArray<SettingDefinition>;

  /** Module's persisted-state schema version; bump on shape change. */
  schemaVersion: number;

  /** Init engine state for a new match. MUST be pure. */
  init(ctx: InitContext): EngineState;

  /** Apply one dart. MUST be pure (state in → state out + effects). The shell relies on purity for undo via replay. */
  applyThrow(state: EngineState, throw_: ThrowRecord): ApplyThrowResult<EngineState>;

  /** Project engine state into the shared scoreboard rendering. MUST be pure. */
  selectScoreboard(state: EngineState): ScoreboardSummary;

  /** Optional game-specific panel rendered alongside the dartboard (e.g., Cricket's number grid). */
  view?: (props: { state: EngineState; resolvedSettings: ResolvedSettings; teams: ReadonlyArray<Team> }) => ReactNode;

  /**
   * Optional declarative hints for the shared dartboard renderer. The shell reads this on every
   * state change and passes the result as a prop to the dartboard. The board renders highlight /
   * dim treatments generically; modules MUST NOT compute these in terms of CSS, DOM, or styling.
   * Used by Around the Clock to highlight the active player's target segment, and by Cricket
   * (optionally) to dim numbers closed by every team. Modules that don't implement it get a plain board.
   */
  getBoardHints?(state: EngineState): {
    highlight?: ReadonlyArray<DartSegment>;
    dim?: ReadonlyArray<DartSegment>;
  };

  /** Migrate a previously persisted engine state from an older schemaVersion to the current one. */
  migrate?(prior: { schemaVersion: number; state: unknown }): EngineState;
}

/** Segments addressable by board hints. 1..20 plus the bull (treated as a single hint target — modules don't distinguish outer vs inner bull at hint level). */
export type DartSegment =
  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10
  | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20
  | "bull";
```

---

## Required behaviour

1. **Purity.** `init`, `applyThrow`, `selectScoreboard`, and `getBoardHints` MUST be pure functions of their inputs. They MUST NOT touch storage, the DOM, `Date.now()`, `Math.random()`, or any global. Timestamps come from the `ThrowRecord` the shell passes in. Randomness is not used in v1.
2. **Determinism.** Replaying the same throw log through `init` + a fold of `applyThrow` MUST produce the same state and the same sequence of effects every time. The shell relies on this for undo/redo (R6).
3. **Effect declarativity.** A game communicates with the shell only through `ThrowEffect`s and engine state. It MUST NOT call shell APIs, navigate, persist, or render outside its `view`.
4. **No cross-module imports.** A game module MUST NOT import from `src/games/<other>/`. Shared logic (general utilities, types, the dartboard component, the storage abstraction) lives under `src/shared/` and is the only allowed import surface besides the module's own files (Gate I.c).
5. **Settings.** A module MUST honour every value in `resolvedSettings` for keys it declared. It MUST NOT consult shell-level state for behaviour decisions.
6. **Schema ownership.** The `schemaVersion` declared in the manifest is the version of `EngineState`. On any breaking change, bump the version and provide `migrate`. The shell will hand `migrate` the prior persisted blob.

---

## Multiple registered types from one module

A module MAY register more than one `GameTypeId` from a single directory when the underlying engine is the same and the variants differ only in declarative parameters (e.g. `x01.501` vs `x01.301` differ only in starting score — see research.md R9).

Two acceptable patterns:

- **Manifest array**: `manifest.ts` exports `const manifests: GameManifest[] = [x501Manifest, x301Manifest]` and `registry.ts` spreads it.
- **Two manifest exports**: `manifest.ts` exports two manifests; `registry.ts` imports both names.

Either way, the rule from Gate I.b (one new module = one new directory + one new registry import) still holds — the registry edit is a single line.

---

## What the shell guarantees in return

The shell will:

1. Resolve the game type by id and look up its manifest.
2. Show the `settingsSchema` editor before play and validate each value against its declared type/constraints (FR-006a).
3. Pass a frozen `ResolvedSettings` and `teams` to `init`.
4. Drive the dartboard, capture each `ThrowRecord`, call `applyThrow`, and react to `ThrowEffect`s:
   - On `scored` / `turnAdvance` — update visible state.
   - On `bust` — discard the in-turn `ThrowRecord`s **conceptually** (see note below) and advance the turn pointer per FR-bust.
   - On `gameWon` — stop accepting throws (FR-021), show the win screen, append a `CompletedGameRecord` to history, clear the in-progress game.
5. Persist the throw log + cached engine state via the storage abstraction. Reload re-replays the throw log through `applyThrow`.
6. Implement undo (FR-023) by slicing the throw log and replaying. Implement redo (FR-024) by re-pushing from the redo stack.
7. Render the scoreboard from `selectScoreboard(state)` and the game-specific panel by mounting `view` if present.

> **Note on bust handling**: the shell does NOT physically delete throws from the log on bust — they are kept (each dart counts as a thrown dart per spec edge case "Bust / invalid score: the throw is recorded as a dart used"). What `applyThrow` returns inside engine state is what determines score reversion. Modules SHOULD return state with the team's score restored to start-of-turn and emit `bust` + `turnAdvance` effects. The throws stay in the log for replay determinism.

---

## Test obligations for a module

Each module SHOULD ship unit tests covering at minimum:

- A normal-play sequence ending in a win.
- A bust path (where applicable).
- An undo equivalence: applying throws T1..Tn, then undoing back to T0, MUST produce a state equal (deep-equal of `selectScoreboard` output is sufficient) to `init` alone.
- For modules with settings: each setting flips at least one observable behaviour.
