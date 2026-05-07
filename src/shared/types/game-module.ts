import type { ReactNode } from "react";
import type { Team, ThrowRecord, ThrowSegment, GameTypeId } from "./core";

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
  | { kind: "bust"; teamId: string }
  | { kind: "turnAdvance"; nextTeamId: string; nextPlayerId: string }
  | { kind: "gameWon"; winnerTeamIds: string[]; summary?: unknown };

export interface ApplyThrowResult<EngineState> {
  state: EngineState;
  effects: ThrowEffect[];
}

export interface InitContext {
  teams: ReadonlyArray<Team>;
  resolvedSettings: ResolvedSettings;
  helpers: {
    allotmentForPlayer(teamId: string, playerIndexInTeam: number): number;
    teamAllotment(teamId: string): number;
  };
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

export interface BoardHints {
  highlight?: ReadonlyArray<DartSegment>;
  dim?: ReadonlyArray<DartSegment>;
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

  init(ctx: InitContext): EngineState;
  applyThrow(state: EngineState, throw_: ThrowRecord): ApplyThrowResult<EngineState>;
  selectScoreboard(state: EngineState): ScoreboardSummary;
  view?: (props: {
    state: EngineState;
    resolvedSettings: ResolvedSettings;
    teams: ReadonlyArray<Team>;
    onScoreboardHit?: (hit: ScoreboardHit) => void;
  }) => ReactNode;
  getBoardHints?(state: EngineState): BoardHints;
  getCandidatesForThrow?(
    state: EngineState,
    throw_: ThrowRecord,
  ): ReadonlyArray<{ intent: string; label: string }>;
  migrate?(prior: { schemaVersion: number; state: unknown }): EngineState;
}
