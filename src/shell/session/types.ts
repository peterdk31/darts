import type {
  Team,
  ThrowRecord,
} from "@/shared/types/core";
import type { ResolvedSettings } from "@/shared/types/game-module";

export interface CurrentTurn {
  teamId: string;
  playerId: string;
  dartsThrownThisTurn: number;
}

export interface InProgressGame {
  id: string;
  gameTypeId: string;
  resolvedSettings: ResolvedSettings;
  teams: Team[];
  dartsPerPlayer: number;
  maxTeamSize: number;
  turnOrder: string[];
  playerRotation: Record<string, string[]>;
  throws: ThrowRecord[];
  redoStack: ThrowRecord[];
  engineState: unknown;
  engineSchemaVersion: number;
  currentTurn: CurrentTurn;
  status: "in-progress";
  startedAt: string;
}

export interface CompletedGameRecord {
  id: string;
  gameTypeId: string;
  resolvedSettings: ResolvedSettings;
  teams: Team[];
  winnerTeamIds: string[];
  completedAt: string;
  summary?: unknown;
}

export interface SessionState {
  teams: Team[];
  inProgressGame: InProgressGame | null;
  history: CompletedGameRecord[];
}

export const SESSION_SCHEMA_VERSION = 1;
export const IN_PROGRESS_SCHEMA_VERSION = 1;
export const HISTORY_RECORD_SCHEMA_VERSION = 1;
