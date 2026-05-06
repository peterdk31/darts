import type { Team } from "./types/core";

/**
 * teamAllotment = dartsPerPlayer × maxTeamSize
 * Same total per team regardless of size (FR-008).
 */
export function teamAllotment(dartsPerPlayer: number, maxTeamSize: number): number {
  return dartsPerPlayer * maxTeamSize;
}

/**
 * Per-player allotment within a team:
 *   base = floor(teamAllotment / playerCount)
 *   remainder distributed to earliest players (FR-009).
 */
export function allotmentForPlayer(
  dartsPerPlayer: number,
  maxTeamSize: number,
  team: Team,
  playerIndex: number,
): number {
  const total = teamAllotment(dartsPerPlayer, maxTeamSize);
  const count = team.players.length;
  if (count <= 0) return 0;
  const base = Math.floor(total / count);
  const remainder = total - base * count;
  return base + (playerIndex < remainder ? 1 : 0);
}
