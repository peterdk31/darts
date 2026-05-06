import type { Team, ThrowRecord } from "@/shared/types/core";
import type {
  ApplyThrowResult,
  InitContext,
  ScoreboardSummary,
  ThrowEffect,
} from "@/shared/types/game-module";
import {
  advance,
  getTeamAt,
  initialPointer,
  maxTeamSize,
  type TurnPointer,
} from "@/shared/turn/turn-helpers";

export interface X01EngineState {
  startingScore: number;
  doubleIn: boolean;
  doubleOut: boolean;
  teams: Team[];
  turnOrder: string[];
  dartsPerPlayer: number;
  maxTeamSize: number;
  /** Per-team current score. */
  scoreByTeam: Record<string, number>;
  /** Score for the active team at start of its current turn (for bust revert). */
  teamScoreAtTurnStart: Record<string, number>;
  /** Per-team double-in achieved flag. */
  doubleInAchieved: Record<string, boolean>;
  /** Per-player last-turn score (for scoreboard). */
  lastTurnScoreByPlayer: Record<string, number>;
  /** Running per-player current-turn delta (resets when player advances). */
  currentTurnScoreByPlayer: Record<string, number>;
  pointer: TurnPointer;
  status: "in-progress" | "won";
  winnerTeamIds: string[] | null;
}

export interface X01InitParams {
  startingScore: number; // 501 or 301
}

function isDouble(throw_: ThrowRecord): boolean {
  if (throw_.segment === "inner-bull") return true; // double-bull
  if (typeof throw_.segment === "number" && throw_.multiplier === 2) return true;
  return false;
}

export function initX01(
  ctx: InitContext,
  params: X01InitParams,
): X01EngineState {
  const teams = [...ctx.teams];
  const turnOrder = teams.map((t) => t.id);
  const mts = maxTeamSize(teams);
  const dartsPerPlayer = 3; // x01 base
  const scoreByTeam: Record<string, number> = {};
  const teamScoreAtTurnStart: Record<string, number> = {};
  const doubleInAchieved: Record<string, boolean> = {};
  const lastTurnScoreByPlayer: Record<string, number> = {};
  const currentTurnScoreByPlayer: Record<string, number> = {};
  for (const t of teams) {
    scoreByTeam[t.id] = params.startingScore;
    teamScoreAtTurnStart[t.id] = params.startingScore;
    doubleInAchieved[t.id] =
      ctx.resolvedSettings["doubleIn"] === true ? false : true;
    for (const p of t.players) {
      lastTurnScoreByPlayer[p.id] = 0;
      currentTurnScoreByPlayer[p.id] = 0;
    }
  }
  return {
    startingScore: params.startingScore,
    doubleIn: ctx.resolvedSettings["doubleIn"] === true,
    doubleOut: ctx.resolvedSettings["doubleOut"] === true,
    teams,
    turnOrder,
    dartsPerPlayer,
    maxTeamSize: mts,
    scoreByTeam,
    teamScoreAtTurnStart,
    doubleInAchieved,
    lastTurnScoreByPlayer,
    currentTurnScoreByPlayer,
    pointer: initialPointer(),
    status: "in-progress",
    winnerTeamIds: null,
  };
}

export function applyThrowX01(
  state: X01EngineState,
  throw_: ThrowRecord,
): ApplyThrowResult<X01EngineState> {
  if (state.status === "won") {
    return { state, effects: [] };
  }

  const team = getTeamAt(state.turnOrder, state.teams, state.pointer.teamIdx);
  let bust = false;
  let won = false;
  let delta = 0;
  let nextScore = state.scoreByTeam[team.id]!;
  const newDoubleInAchieved = { ...state.doubleInAchieved };
  const newCurrentTurnScoreByPlayer = { ...state.currentTurnScoreByPlayer };
  const newLastTurnScoreByPlayer = { ...state.lastTurnScoreByPlayer };
  const newScoreByTeam = { ...state.scoreByTeam };
  const newTeamScoreAtTurnStart = { ...state.teamScoreAtTurnStart };

  // Double-in gate: until achieved, throws score 0 unless they are a double.
  let scoringHit = throw_.score;
  if (!state.doubleInAchieved[team.id]) {
    if (isDouble(throw_) && throw_.score > 0) {
      newDoubleInAchieved[team.id] = true;
    } else {
      scoringHit = 0;
    }
  }

  const tentative = nextScore - scoringHit;

  if (tentative < 0) {
    bust = true;
  } else if (tentative === 0) {
    if (state.doubleOut) {
      if (isDouble(throw_) && scoringHit > 0) {
        won = true;
        delta = scoringHit;
        nextScore = 0;
      } else {
        bust = true;
      }
    } else {
      won = true;
      delta = scoringHit;
      nextScore = 0;
    }
  } else if (tentative === 1 && state.doubleOut) {
    // Cannot finish on a double from 1.
    bust = true;
  } else {
    delta = scoringHit;
    nextScore = tentative;
  }

  const playerId = throw_.playerId;
  if (bust) {
    // Revert team score to start-of-turn.
    nextScore = state.teamScoreAtTurnStart[team.id]!;
    newScoreByTeam[team.id] = nextScore;
    // Reset current-turn deltas for all players in this team (their turn ended).
    for (const p of team.players) {
      newCurrentTurnScoreByPlayer[p.id] = 0;
    }
    delta = 0;
  } else {
    newScoreByTeam[team.id] = nextScore;
    newCurrentTurnScoreByPlayer[playerId] =
      (state.currentTurnScoreByPlayer[playerId] ?? 0) + delta;
  }

  // Advance pointer. Bust ends entire team's turn.
  const adv = advance(
    state.pointer,
    state.turnOrder,
    state.teams,
    state.dartsPerPlayer,
    state.maxTeamSize,
    bust,
  );

  const teamAdvanced = adv.teamChanged;
  // If we are leaving the current player's stretch (and not bust), record their last-turn score.
  if (
    !bust &&
    adv.pointer.dartsThrownThisStretch === 0 &&
    (adv.pointer.teamIdx !== state.pointer.teamIdx ||
      adv.pointer.playerIdxInTeam !== state.pointer.playerIdxInTeam)
  ) {
    newLastTurnScoreByPlayer[playerId] =
      newCurrentTurnScoreByPlayer[playerId] ?? 0;
    if (!teamAdvanced) {
      // Within same team; reset current-turn for the player who just finished.
      newCurrentTurnScoreByPlayer[playerId] = 0;
    }
  }

  // When team advances, reset all players' current-turn for the team that JUST finished
  // and snapshot the new active team's start-of-turn score.
  if (teamAdvanced) {
    for (const p of team.players) {
      // Save last-turn for each player who threw this turn (best-effort).
      if (newCurrentTurnScoreByPlayer[p.id] && newCurrentTurnScoreByPlayer[p.id]! > 0) {
        newLastTurnScoreByPlayer[p.id] = newCurrentTurnScoreByPlayer[p.id]!;
      }
      newCurrentTurnScoreByPlayer[p.id] = 0;
    }
    const newActiveTeamId = adv.nextTeamId;
    newTeamScoreAtTurnStart[newActiveTeamId] = newScoreByTeam[newActiveTeamId]!;
  }

  const effects: ThrowEffect[] = [];
  if (won) {
    effects.push({ kind: "scored", teamId: team.id, delta });
    effects.push({ kind: "gameWon", winnerTeamIds: [team.id] });
  } else if (bust) {
    effects.push({ kind: "bust", teamId: team.id });
    effects.push({
      kind: "turnAdvance",
      nextTeamId: adv.nextTeamId,
      nextPlayerId: adv.nextPlayerId,
    });
  } else {
    effects.push({ kind: "scored", teamId: team.id, delta });
    if (
      adv.pointer.teamIdx !== state.pointer.teamIdx ||
      adv.pointer.playerIdxInTeam !== state.pointer.playerIdxInTeam
    ) {
      effects.push({
        kind: "turnAdvance",
        nextTeamId: adv.nextTeamId,
        nextPlayerId: adv.nextPlayerId,
      });
    }
  }

  const next: X01EngineState = {
    ...state,
    scoreByTeam: newScoreByTeam,
    teamScoreAtTurnStart: newTeamScoreAtTurnStart,
    doubleInAchieved: newDoubleInAchieved,
    lastTurnScoreByPlayer: newLastTurnScoreByPlayer,
    currentTurnScoreByPlayer: newCurrentTurnScoreByPlayer,
    pointer: won ? state.pointer : adv.pointer,
    status: won ? "won" : "in-progress",
    winnerTeamIds: won ? [team.id] : state.winnerTeamIds,
  };

  return { state: next, effects };
}

export function selectScoreboardX01(state: X01EngineState): ScoreboardSummary {
  const rows = state.teams.map((t) => ({
    teamId: t.id,
    primary: `${state.scoreByTeam[t.id] ?? 0}`,
    perPlayer: t.players.map((p) => {
      const cur = state.currentTurnScoreByPlayer[p.id] ?? 0;
      const last = state.lastTurnScoreByPlayer[p.id] ?? 0;
      const line = cur > 0 ? `+${cur} this turn` : last > 0 ? `last turn: ${last}` : "—";
      return { playerId: p.id, line };
    }),
  }));
  return { rows };
}
