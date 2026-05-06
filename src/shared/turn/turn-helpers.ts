import type { Team } from "@/shared/types/core";
import { allotmentForPlayer } from "@/shared/dart-allotment";

export interface TurnPointer {
  teamIdx: number;
  playerIdxInTeam: number;
  dartsThrownThisStretch: number;
}

export interface TurnAdvanceResult {
  pointer: TurnPointer;
  /** True if advanced to a new team. */
  teamChanged: boolean;
  /** Resolved next teamId / playerId (for emitting effects). */
  nextTeamId: string;
  nextPlayerId: string;
}

export function initialPointer(): TurnPointer {
  return { teamIdx: 0, playerIdxInTeam: 0, dartsThrownThisStretch: 0 };
}

export function getTeamAt(turnOrder: ReadonlyArray<string>, teams: ReadonlyArray<Team>, teamIdx: number): Team {
  const teamId = turnOrder[teamIdx % turnOrder.length]!;
  const team = teams.find((t) => t.id === teamId);
  if (!team) throw new Error(`Team not found: ${teamId}`);
  return team;
}

export function getPlayerAt(team: Team, playerIdx: number): { id: string; index: number } {
  const p = team.players[playerIdx];
  if (!p) throw new Error(`Player not found at index ${playerIdx} in team ${team.id}`);
  return { id: p.id, index: playerIdx };
}

/**
 * Advance the turn pointer after a throw.
 * @param bust true if this throw caused a bust → end team's turn entirely.
 * @returns the new pointer + whether the team changed + the resolved next team/player ids.
 */
export function advance(
  pointer: TurnPointer,
  turnOrder: ReadonlyArray<string>,
  teams: ReadonlyArray<Team>,
  dartsPerPlayer: number,
  maxTeamSize: number,
  bust: boolean,
): TurnAdvanceResult {
  const currentTeam = getTeamAt(turnOrder, teams, pointer.teamIdx);
  const allotmentForCurrent = allotmentForPlayer(
    dartsPerPlayer,
    maxTeamSize,
    currentTeam,
    pointer.playerIdxInTeam,
  );

  const incrementedThisStretch = pointer.dartsThrownThisStretch + 1;

  let nextTeamIdx = pointer.teamIdx;
  let nextPlayerIdxInTeam = pointer.playerIdxInTeam;
  let teamChanged = false;

  if (bust) {
    nextTeamIdx = (pointer.teamIdx + 1) % turnOrder.length;
    nextPlayerIdxInTeam = 0;
    teamChanged = true;
  } else if (incrementedThisStretch >= allotmentForCurrent) {
    // Player's stretch is done. Move to next player in team, or next team.
    if (pointer.playerIdxInTeam + 1 < currentTeam.players.length) {
      nextPlayerIdxInTeam = pointer.playerIdxInTeam + 1;
    } else {
      nextTeamIdx = (pointer.teamIdx + 1) % turnOrder.length;
      nextPlayerIdxInTeam = 0;
      teamChanged = true;
    }
  } else {
    // Same player keeps throwing.
    return {
      pointer: { ...pointer, dartsThrownThisStretch: incrementedThisStretch },
      teamChanged: false,
      nextTeamId: turnOrder[pointer.teamIdx]!,
      nextPlayerId: currentTeam.players[pointer.playerIdxInTeam]!.id,
    };
  }

  const nextTeam = getTeamAt(turnOrder, teams, nextTeamIdx);
  const nextPlayer = getPlayerAt(nextTeam, nextPlayerIdxInTeam);

  return {
    pointer: {
      teamIdx: nextTeamIdx,
      playerIdxInTeam: nextPlayerIdxInTeam,
      dartsThrownThisStretch: 0,
    },
    teamChanged,
    nextTeamId: nextTeam.id,
    nextPlayerId: nextPlayer.id,
  };
}

export function maxTeamSize(teams: ReadonlyArray<Team>): number {
  return teams.reduce((m, t) => Math.max(m, t.players.length), 0);
}
