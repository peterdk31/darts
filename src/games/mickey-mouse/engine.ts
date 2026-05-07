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

export type MickeyTarget =
  | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20
  | "double" | "triple" | "bull";

export const MICKEY_TARGETS_15: MickeyTarget[] = [
  15, 16, 17, 18, 19, 20, "double", "triple", "bull",
];

export const MICKEY_TARGETS_12: MickeyTarget[] = [
  12, 13, 14, 15, 16, 17, 18, 19, 20, "double", "triple", "bull",
];

export interface MickeyEngineState {
  teams: Team[];
  turnOrder: string[];
  dartsPerPlayer: number;
  maxTeamSize: number;
  startingNumber: 12 | 15;
  multipliersScore: boolean;
  dtRequireTargetRange: boolean;
  targets: MickeyTarget[];
  /** marksByTeam[teamId][targetKey] = 0..3 (clamped at 3). */
  marksByTeam: Record<string, Record<string, number>>;
  pointer: TurnPointer;
  status: "in-progress" | "won";
  winnerTeamIds: string[] | null;
}

interface InternalCandidate {
  intent: string;
  label: string;
  target: string;
  marks: number;
}

function isTargetNumber(targets: MickeyTarget[], n: number): boolean {
  return targets.includes(n as MickeyTarget);
}

function isClosed(teamMarks: Record<string, number>, key: string): boolean {
  return (teamMarks[key] ?? 0) >= 3;
}

function enumerateCandidates(
  state: MickeyEngineState,
  teamId: string,
  throw_: ThrowRecord,
): InternalCandidate[] {
  const teamMarks = state.marksByTeam[teamId]!;
  const closed = (key: string) => isClosed(teamMarks, key);

  if (throw_.segment === "miss") return [];

  if (throw_.segment === "outer-bull") {
    if (closed("bull")) return [];
    return [{ intent: "bull", label: "Bull ×1", target: "bull", marks: 1 }];
  }

  if (throw_.segment === "inner-bull") {
    const candidates: InternalCandidate[] = [];
    const bullMarks = state.multipliersScore ? 2 : 1;
    if (!closed("bull")) {
      candidates.push({ intent: "bull", label: `Bull ×${bullMarks}`, target: "bull", marks: bullMarks });
    }
    if (!closed("double")) {
      candidates.push({ intent: "double", label: "Double ×1", target: "double", marks: 1 });
    }
    return candidates;
  }

  const N = throw_.segment as number;
  const mult = throw_.multiplier;

  if (mult === 1) {
    if (isTargetNumber(state.targets, N) && !closed(String(N))) {
      return [{ intent: "number", label: `${N} ×1`, target: String(N), marks: 1 }];
    }
    return [];
  }

  // Double or Triple — check dtRequireTargetRange threshold
  if (state.dtRequireTargetRange && N < state.startingNumber) {
    return [];
  }

  const candidates: InternalCandidate[] = [];

  if (mult === 2) {
    if (isTargetNumber(state.targets, N) && !closed(String(N))) {
      const marksOnN = state.multipliersScore ? 2 : 1;
      candidates.push({ intent: "number", label: `${N} ×${marksOnN}`, target: String(N), marks: marksOnN });
    }
    if (!closed("double")) {
      candidates.push({ intent: "double", label: "Double ×1", target: "double", marks: 1 });
    }
  } else {
    if (isTargetNumber(state.targets, N) && !closed(String(N))) {
      const marksOnN = state.multipliersScore ? 3 : 1;
      candidates.push({ intent: "number", label: `${N} ×${marksOnN}`, target: String(N), marks: marksOnN });
    }
    if (!closed("triple")) {
      candidates.push({ intent: "triple", label: "Triple ×1", target: "triple", marks: 1 });
    }
  }

  return candidates;
}

export function getCandidatesForThrow(
  state: MickeyEngineState,
  throw_: ThrowRecord,
): Array<{ intent: string; label: string }> {
  const teamId = state.turnOrder[state.pointer.teamIdx]!;
  return enumerateCandidates(state, teamId, throw_).map(({ intent, label }) => ({ intent, label }));
}

export function initMickey(ctx: InitContext): MickeyEngineState {
  const teams = [...ctx.teams];
  const turnOrder = teams.map((t) => t.id);
  const startingNumber = ctx.resolvedSettings["startingNumber"] === "12" ? 12 as const : 15 as const;
  const multipliersScore = ctx.resolvedSettings["multipliersScore"] !== false;
  const dtRequireTargetRange = ctx.resolvedSettings["dtRequireTargetRange"] === true;
  const targets: MickeyTarget[] = startingNumber === 12
    ? [...MICKEY_TARGETS_12]
    : [...MICKEY_TARGETS_15];

  const marksByTeam: Record<string, Record<string, number>> = {};
  for (const t of teams) {
    const row: Record<string, number> = {};
    for (const tg of targets) row[String(tg)] = 0;
    marksByTeam[t.id] = row;
  }

  return {
    teams,
    turnOrder,
    dartsPerPlayer: 3,
    maxTeamSize: maxTeamSize(teams),
    startingNumber,
    multipliersScore,
    dtRequireTargetRange,
    targets,
    marksByTeam,
    pointer: initialPointer(),
    status: "in-progress",
    winnerTeamIds: null,
  };
}

export function applyThrowMickey(
  state: MickeyEngineState,
  throw_: ThrowRecord,
): ApplyThrowResult<MickeyEngineState> {
  if (state.status === "won") return { state, effects: [] };

  const teamId = state.turnOrder[state.pointer.teamIdx]!;
  const candidates = enumerateCandidates(state, teamId, throw_);

  let chosen: InternalCandidate | null = null;
  if (candidates.length === 1) {
    chosen = candidates[0]!;
  } else if (candidates.length === 2) {
    if (throw_.intent) {
      chosen = candidates.find((c) => c.intent === throw_.intent) ?? null;
    }
  }

  let nextMarks = state.marksByTeam;
  if (chosen) {
    const teamRow = { ...state.marksByTeam[teamId]! };
    const before = teamRow[chosen.target] ?? 0;
    teamRow[chosen.target] = Math.min(before + chosen.marks, 3);
    nextMarks = { ...state.marksByTeam, [teamId]: teamRow };
  }

  const allClosed = state.targets.every(
    (tg) => (nextMarks[teamId]![String(tg)] ?? 0) >= 3,
  );

  const effects: ThrowEffect[] = [];
  effects.push({ kind: "scored", teamId, delta: chosen ? chosen.marks : 0 });

  if (allClosed) {
    effects.push({ kind: "gameWon", winnerTeamIds: [teamId] });
    return {
      state: {
        ...state,
        marksByTeam: nextMarks,
        status: "won",
        winnerTeamIds: [teamId],
      },
      effects,
    };
  }

  const adv = advance(
    state.pointer,
    state.turnOrder,
    state.teams,
    state.dartsPerPlayer,
    state.maxTeamSize,
    false,
  );

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
    state: { ...state, marksByTeam: nextMarks, pointer: adv.pointer },
    effects,
  };
}

export function selectScoreboardMickey(state: MickeyEngineState): ScoreboardSummary {
  return {
    rows: state.teams.map((t) => {
      const row = state.marksByTeam[t.id] ?? {};
      const closed = state.targets.filter(
        (tg) => (row[String(tg)] ?? 0) >= 3,
      ).length;
      return {
        teamId: t.id,
        primary: `${closed} / ${state.targets.length} closed`,
      };
    }),
  };
}
