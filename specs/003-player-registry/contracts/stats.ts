/**
 * Contract: Statistics Computation
 *
 * Pure functions to compute per-player and per-team statistics
 * from the completed game history. Not persisted — computed on render.
 * Implementation lives at src/shell/stats/.
 * Consumed by: PlayerStatsView, TeamStatsView.
 */

import type { CompletedGameRecord } from "../../../src/shell/session/types";

export interface PlayerStats {
  playerId: string;
  gamesPlayed: number;
  gamesWon: number;
  winRate: number;
  byTeam: Record<string, { teamName: string; gamesPlayed: number; gamesWon: number }>;
  byGameType: Record<string, { gameTypeName: string; gamesPlayed: number; gamesWon: number }>;
}

export interface TeamStats {
  teamId: string;
  gamesPlayed: number;
  gamesWon: number;
  winRate: number;
  gameHistory: Array<{
    record: CompletedGameRecord;
    rosterAtTime: Array<{ playerId: string; displayName: string }>;
  }>;
}

export interface StatsComputation {
  /** Compute stats for a single player across all history. */
  computePlayerStats(playerId: string, history: CompletedGameRecord[]): PlayerStats;

  /** Compute stats for a single team across all history. */
  computeTeamStats(teamId: string, history: CompletedGameRecord[]): TeamStats;
}
