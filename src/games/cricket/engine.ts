import type { Team, ThrowRecord } from "@/shared/types/core";
import type {
  ApplyThrowResult,
  InitContext,
  ScoreboardSummary,
  ThrowEffect,
} from "@/shared/types/game-module";
import {
  advance,
  initialPointer,
  maxTeamSize,
  type TurnPointer,
} from "@/shared/turn/turn-helpers";

export type CricketTarget = 15 | 16 | 17 | 18 | 19 | 20 | "bull";

export const CRICKET_TARGETS: CricketTarget[] = [20, 19, 18, 17, 16, 15, "bull"];

export interface CricketEngineState {
  teams: Team[];
  turnOrder: string[];
  dartsPerPlayer: number;
  maxTeamSize: number;
  /** marksByTeam[teamId][target] = number of marks accrued (clamps display at 3 but counts beyond 3 as scoring). */
  marksByTeam: Record<string, Record<string, number>>;
  /** scoreByTeam: scoring points (face value × marks beyond 3). */
  scoreByTeam: Record<string, number>;
  pointer: TurnPointer;
  status: "in-progress" | "won";
  winnerTeamIds: string[] | null;
}

function targetForThrow(t: ThrowRecord): CricketTarget | null {
  if (t.segment === "miss") return null;
  if (t.segment === "outer-bull" || t.segment === "inner-bull") return "bull";
  if (typeof t.segment === "number") {
    if ([15, 16, 17, 18, 19, 20].includes(t.segment)) return t.segment as CricketTarget;
  }
  return null;
}

function marksForThrow(t: ThrowRecord): number {
  if (t.segment === "miss") return 0;
  if (t.segment === "outer-bull") return 1;
  if (t.segment === "inner-bull") return 2;
  if (typeof t.segment === "number") return t.multiplier;
  return 0;
}

function isClosed(marks: number): boolean {
  return marks >= 3;
}

function pointsValue(target: CricketTarget): number {
  return target === "bull" ? 25 : (target as number);
}

export function initCricket(ctx: InitContext): CricketEngineState {
  const teams = [...ctx.teams];
  const turnOrder = teams.map((t) => t.id);
  const marksByTeam: Record<string, Record<string, number>> = {};
  const scoreByTeam: Record<string, number> = {};
  for (const t of teams) {
    const row: Record<string, number> = {};
    for (const tg of CRICKET_TARGETS) row[String(tg)] = 0;
    marksByTeam[t.id] = row;
    scoreByTeam[t.id] = 0;
  }
  return {
    teams,
    turnOrder,
    dartsPerPlayer: 3,
    maxTeamSize: maxTeamSize(teams),
    marksByTeam,
    scoreByTeam,
    pointer: initialPointer(),
    status: "in-progress",
    winnerTeamIds: null,
  };
}

function teamHasClosedAll(state: CricketEngineState, teamId: string): boolean {
  const row = state.marksByTeam[teamId]!;
  return CRICKET_TARGETS.every((tg) => isClosed(row[String(tg)] ?? 0));
}

function checkWin(state: CricketEngineState): { won: boolean; winnerIds: string[] } {
  // A team wins iff it has all closed AND its score >= every other team's score.
  // Otherwise play continues (FR-007 cricket clause).
  const closedTeams = state.teams.filter((t) => teamHasClosedAll(state, t.id));
  if (closedTeams.length === 0) return { won: false, winnerIds: [] };
  let leader: { id: string; score: number } | null = null;
  let tieIds: string[] = [];
  for (const t of closedTeams) {
    const s = state.scoreByTeam[t.id] ?? 0;
    if (leader === null || s > leader.score) {
      leader = { id: t.id, score: s };
      tieIds = [t.id];
    } else if (s === leader.score) {
      tieIds.push(t.id);
    }
  }
  if (!leader) return { won: false, winnerIds: [] };
  // leader must also have score ≥ every team (closed or not) — and no other team strictly higher.
  for (const t of state.teams) {
    if ((state.scoreByTeam[t.id] ?? 0) > leader.score) {
      return { won: false, winnerIds: [] };
    }
  }
  return { won: true, winnerIds: tieIds };
}

export function applyThrowCricket(
  state: CricketEngineState,
  throw_: ThrowRecord,
): ApplyThrowResult<CricketEngineState> {
  if (state.status === "won") return { state, effects: [] };

  const teamId = state.turnOrder[state.pointer.teamIdx]!;
  const target = targetForThrow(throw_);
  const marks = marksForThrow(throw_);

  let nextMarks = state.marksByTeam;
  let nextScore = state.scoreByTeam;
  let delta = 0;

  if (target !== null && marks > 0) {
    const teamRow = { ...state.marksByTeam[teamId]! };
    const before = teamRow[String(target)] ?? 0;
    const after = before + marks;
    teamRow[String(target)] = after;
    nextMarks = { ...state.marksByTeam, [teamId]: teamRow };

    const overflow = Math.max(0, after - 3) - Math.max(0, before - 3);
    // Score only when this team has closed AND not all opponents have closed.
    const meClosed = isClosed(after) || (before >= 3 && overflow > 0);
    const allOppClosed = state.teams
      .filter((t) => t.id !== teamId)
      .every((t) => isClosed(state.marksByTeam[t.id]?.[String(target)] ?? 0));
    if (meClosed && !allOppClosed && overflow > 0) {
      delta = overflow * pointsValue(target);
      nextScore = {
        ...state.scoreByTeam,
        [teamId]: (state.scoreByTeam[teamId] ?? 0) + delta,
      };
    }
  }

  const provisional: CricketEngineState = {
    ...state,
    marksByTeam: nextMarks,
    scoreByTeam: nextScore,
  };
  const winCheck = checkWin(provisional);

  // Cricket has no bust; advance based on darts allotment.
  const adv = advance(
    state.pointer,
    state.turnOrder,
    state.teams,
    state.dartsPerPlayer,
    state.maxTeamSize,
    false,
  );

  const effects: ThrowEffect[] = [];
  if (delta > 0 || target !== null) {
    effects.push({ kind: "scored", teamId, delta });
  } else {
    effects.push({ kind: "scored", teamId, delta: 0 });
  }

  if (winCheck.won) {
    effects.push({ kind: "gameWon", winnerTeamIds: winCheck.winnerIds });
    return {
      state: {
        ...provisional,
        pointer: state.pointer,
        status: "won",
        winnerTeamIds: winCheck.winnerIds,
      },
      effects,
    };
  }

  // Emit turnAdvance only if the pointer actually moved.
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

  return {
    state: { ...provisional, pointer: adv.pointer },
    effects,
  };
}

export function selectScoreboardCricket(state: CricketEngineState): ScoreboardSummary {
  const rows = state.teams.map((t) => {
    const row = state.marksByTeam[t.id] ?? {};
    const closed = CRICKET_TARGETS.filter((tg) => isClosed(row[String(tg)] ?? 0)).length;
    return {
      teamId: t.id,
      primary: `${state.scoreByTeam[t.id] ?? 0} pts • ${closed}/7 closed`,
      perPlayer: t.players.map((p) => ({ playerId: p.id, line: "" })),
    };
  });
  return { rows };
}

export function getBoardHintsCricket(state: CricketEngineState) {
  // Dim numbers closed by every team.
  const dim: (15 | 16 | 17 | 18 | 19 | 20 | "bull")[] = [];
  for (const tg of CRICKET_TARGETS) {
    const allClosed = state.teams.every(
      (t) => isClosed(state.marksByTeam[t.id]?.[String(tg)] ?? 0),
    );
    if (allClosed) dim.push(tg);
  }
  return { dim };
}
