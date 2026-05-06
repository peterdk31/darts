import type { GameManifest, InitContext, ThrowEffect } from "@/shared/types/game-module";
import type { Team, ThrowRecord } from "@/shared/types/core";
import type { CurrentTurn } from "./types";
import { allotmentForPlayer } from "@/shared/dart-allotment";

export interface ReplayResult {
  engineState: unknown;
  currentTurn: CurrentTurn;
  effects: ThrowEffect[][];
  /** Set when a gameWon effect was emitted during replay. */
  winnerTeamIds: string[] | null;
  winSummary?: unknown;
}

export function makeInitContext(
  teams: ReadonlyArray<Team>,
  resolvedSettings: InitContext["resolvedSettings"],
  dartsPerPlayer: number,
  maxTeamSize: number,
): InitContext {
  const teamById = new Map<string, Team>(teams.map((t) => [t.id, t]));
  return {
    teams,
    resolvedSettings,
    helpers: {
      teamAllotment: () => dartsPerPlayer * maxTeamSize,
      allotmentForPlayer: (teamId, playerIndexInTeam) => {
        const team = teamById.get(teamId);
        if (!team) return 0;
        return allotmentForPlayer(dartsPerPlayer, maxTeamSize, team, playerIndexInTeam);
      },
    },
  };
}

export function initialCurrentTurn(
  turnOrder: string[],
  playerRotation: Record<string, string[]>,
): CurrentTurn {
  const teamId = turnOrder[0]!;
  const players = playerRotation[teamId] ?? [];
  const playerId = players[0] ?? "";
  return { teamId, playerId, dartsThrownThisTurn: 0 };
}

/** Apply a single throw and update the (engineState, currentTurn) pair. */
export function applyOne(
  manifest: GameManifest,
  prevState: unknown,
  prevTurn: CurrentTurn,
  throw_: ThrowRecord,
): { state: unknown; turn: CurrentTurn; effects: ThrowEffect[] } {
  const result = manifest.applyThrow(prevState, throw_);
  let turn: CurrentTurn = {
    teamId: prevTurn.teamId,
    playerId: prevTurn.playerId,
    dartsThrownThisTurn: prevTurn.dartsThrownThisTurn + 1,
  };
  for (const eff of result.effects) {
    if (eff.kind === "turnAdvance") {
      turn = {
        teamId: eff.nextTeamId,
        playerId: eff.nextPlayerId,
        dartsThrownThisTurn: 0,
      };
    }
  }
  return { state: result.state, turn, effects: result.effects };
}

export function replayAll(
  manifest: GameManifest,
  initCtx: InitContext,
  turnOrder: string[],
  playerRotation: Record<string, string[]>,
  throws: ReadonlyArray<ThrowRecord>,
): ReplayResult {
  let state: unknown = manifest.init(initCtx);
  let turn: CurrentTurn = initialCurrentTurn(turnOrder, playerRotation);
  const effectsAll: ThrowEffect[][] = [];
  let winnerTeamIds: string[] | null = null;
  let winSummary: unknown;
  for (const t of throws) {
    const r = applyOne(manifest, state, turn, t);
    state = r.state;
    turn = r.turn;
    effectsAll.push(r.effects);
    for (const eff of r.effects) {
      if (eff.kind === "gameWon") {
        winnerTeamIds = eff.winnerTeamIds.slice();
        winSummary = eff.summary;
      }
    }
  }
  return {
    engineState: state,
    currentTurn: turn,
    effects: effectsAll,
    winnerTeamIds,
    winSummary,
  };
}
