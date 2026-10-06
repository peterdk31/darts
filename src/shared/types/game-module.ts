import type { ReactNode } from "react";
import type { Team, ThrowRecord, ThrowSegment, GameTypeId } from "./core";
import type { RandomFn } from "../random";

export type SettingDefinition =
  | { key: string; label: string; type: "toggle"; default: boolean }
  | {
      key: string;
      label: string;
      type: "integer";
      default: number;
      constraints: { min: number; max: number; step?: number };
    }
  | {
      key: string;
      label: string;
      type: "choice";
      default: string;
      constraints: { choices: ReadonlyArray<{ value: string; label: string }> };
    };

export type ResolvedSettings = Readonly<Record<string, boolean | number | string>>;

export type ThrowEffect =
  | { kind: "scored"; teamId: string; delta: number }
  | { kind: "bust"; teamId: string; label?: string; detail?: string }
  | { kind: "turnAdvance"; nextTeamId: string; nextPlayerId: string }
  | { kind: "gameWon"; winnerTeamIds: string[]; summary?: unknown };

export interface ApplyThrowResult<EngineState> {
  state: EngineState;
  effects: ThrowEffect[];
}

export interface InitContext {
  teams: ReadonlyArray<Team>;
  resolvedSettings: ResolvedSettings;
  /** Seeded randomness — engines must use this, never `Math.random()`. */
  random: RandomFn;
  helpers: {
    allotmentForPlayer(teamId: string, playerIndexInTeam: number): number;
    teamAllotment(teamId: string): number;
  };
}

export interface ThrowContext {
  /**
   * Seeded randomness for this throw — engines must use this, never
   * `Math.random()`, so that replaying the same throws (undo/redo, restore)
   * yields the same state.
   */
  random: RandomFn;
}

export interface ScoreboardSummary {
  rows: ReadonlyArray<{
    teamId: string;
    primary: string;
    perPlayer?: ReadonlyArray<{ playerId: string; line: string }>;
  }>;
}

export type DartSegment =
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | 11
  | 12
  | 13
  | 14
  | 15
  | 16
  | 17
  | 18
  | 19
  | 20
  | "bull";

export type SegmentRing = "single" | "double" | "triple";

export interface HighlightRule {
  segments: ReadonlyArray<DartSegment>;
  rings?: ReadonlyArray<SegmentRing>;
  bullInner?: boolean;
}

export interface SegmentColorRule {
  segments: ReadonlyArray<DartSegment>;
  color: string;
  opacity?: number;
  rings?: ReadonlyArray<SegmentRing>;
  bullInner?: boolean;
}

export interface BoardHints {
  highlights?: ReadonlyArray<HighlightRule>;
  segmentColors?: ReadonlyArray<SegmentColorRule>;
  dim?: ReadonlyArray<DartSegment>;
}

export interface QuickInputAction {
  label: string;
  segment: ThrowSegment;
  multiplier: 1 | 2 | 3;
  score: number;
  intent?: string;
  variant?: "meta" | "miss";
  marks?: { current: number; max: number };
}

export interface QuickInputGroup {
  label?: string;
  /**
   * "tile": a compact number tile — the first action is the single (shown as
   * the tile's main button), the rest render as small D/T buttons below it.
   * Consecutive tile groups share one grid, headed by the first one's label.
   * Defaults to a row of buttons.
   */
  layout?: "row" | "tile";
  actions: QuickInputAction[];
}

export interface ScoreboardHit {
  segment: ThrowSegment;
  multiplier: 1 | 2 | 3;
  intent?: string;
}

export interface GameManifest<EngineState = unknown> {
  id: GameTypeId;
  displayName: string;
  dartsPerPlayer: number;
  settingsSchema: ReadonlyArray<SettingDefinition>;
  schemaVersion: number;

  /**
   * Engines MUST be pure: the same (ctx, throws) must always produce the same
   * state, and `applyThrow` must not mutate `state`. Undo/redo and session
   * restore rely on this — they rebuild the game by replaying its throws.
   */
  init(ctx: InitContext): EngineState;
  applyThrow(
    state: EngineState,
    throw_: ThrowRecord,
    ctx: ThrowContext,
  ): ApplyThrowResult<EngineState>;
  selectScoreboard(state: EngineState): ScoreboardSummary;
  view?: (props: {
    state: EngineState;
    resolvedSettings: ResolvedSettings;
    teams: ReadonlyArray<Team>;
    onScoreboardHit?: (hit: ScoreboardHit) => void;
    scoreboardExpanded?: boolean;
  }) => ReactNode;
  /** Extra game-specific content shown on the end-of-game results page. */
  resultsView?: (props: {
    state: EngineState;
    teams: ReadonlyArray<Team>;
  }) => ReactNode;
  getTurnHint(state: EngineState, teamId: string): { label: string; value: string } | null;
  getBoardHints(state: EngineState): BoardHints;
  getCandidatesForThrow?(
    state: EngineState,
    throw_: ThrowRecord,
  ): ReadonlyArray<{ intent: string; label: string }>;
  getQuickInputs?(state: EngineState): QuickInputGroup[] | null;
  migrate?(prior: { schemaVersion: number; state: unknown }): EngineState;
}
