export type TeamColorId =
  | "red"
  | "green"
  | "orange"
  | "purple"
  | "teal"
  | "pink"
  | "yellow"
  | "cyan";

export interface Player {
  id: string;
  displayName: string;
}

export interface Team {
  id: string;
  displayName: string;
  colorId: TeamColorId;
  players: Player[];
}

export interface RosterPlayer {
  id: string;
  displayName: string;
  createdAt: string;
  deletedAt: string | null;
}

export interface PersistedTeam {
  id: string;
  displayName: string;
  colorId: TeamColorId;
  playerIds: string[];
}

export type ThrowSegment = number | "outer-bull" | "inner-bull" | "miss";

export interface ThrowRecord {
  playerId: string;
  teamId: string;
  segment: ThrowSegment;
  multiplier: 1 | 2 | 3;
  score: number;
  timestamp: string;
  /** Game-specific resolution hint set by the UI before applyThrow. Opaque to other games. */
  intent?: string;
}

export type GameTypeId = string;
