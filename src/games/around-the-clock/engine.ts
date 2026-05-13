import type { Team, ThrowRecord } from "@/shared/types/core";
import type {
  ApplyThrowResult,
  BoardHints,
  DartSegment,
  InitContext,
  QuickInputGroup,
  ScoreboardSummary,
  ThrowEffect,
} from "@/shared/types/game-module";
import {
  advance,
  initialPointer,
  maxTeamSize,
  type TurnPointer,
} from "@/shared/turn/turn-helpers";

/** Targets in order: 1, 2, ... 20, then bull. Index 0..19 = number 1..20, index 20 = bull. */
export const ATC_TARGETS_COUNT = 21;

export interface ATCEngineState {
  teams: Team[];
  turnOrder: string[];
  dartsPerPlayer: number;
  maxTeamSize: number;
  /** Per-team progress index (0..21). 21 means won. */
  progressByTeam: Record<string, number>;
  pointer: TurnPointer;
  status: "in-progress" | "won";
  winnerTeamIds: string[] | null;
}

function hits(throw_: ThrowRecord): { num: number | "bull" } | null {
  if (throw_.segment === "miss") return null;
  if (throw_.segment === "outer-bull" || throw_.segment === "inner-bull") {
    return { num: "bull" };
  }
  if (typeof throw_.segment === "number") return { num: throw_.segment };
  return null;
}

export function initATC(ctx: InitContext): ATCEngineState {
  const teams = [...ctx.teams];
  const turnOrder = teams.map((t) => t.id);
  const progressByTeam: Record<string, number> = {};
  for (const t of teams) progressByTeam[t.id] = 0;
  return {
    teams,
    turnOrder,
    dartsPerPlayer: 3,
    maxTeamSize: maxTeamSize(teams),
    progressByTeam,
    pointer: initialPointer(),
    status: "in-progress",
    winnerTeamIds: null,
  };
}

export function applyThrowATC(
  state: ATCEngineState,
  throw_: ThrowRecord,
): ApplyThrowResult<ATCEngineState> {
  if (state.status === "won") return { state, effects: [] };
  const teamId = state.turnOrder[state.pointer.teamIdx]!;
  const progress = state.progressByTeam[teamId] ?? 0;
  const target: number | "bull" = progress < 20 ? progress + 1 : "bull";
  const h = hits(throw_);
  let nextProgress = progress;
  let won = false;
  if (h && h.num === target) {
    if (target === "bull") {
      // Bull stage: any bull hit wins.
      nextProgress = ATC_TARGETS_COUNT;
      won = true;
    } else {
      // Numeric target: advance by multiplier, but cap at 20 so the bull cannot be skipped.
      nextProgress = Math.min(20, progress + throw_.multiplier);
    }
  }

  const nextProgressByTeam =
    nextProgress !== progress
      ? { ...state.progressByTeam, [teamId]: nextProgress }
      : state.progressByTeam;

  const adv = advance(
    state.pointer,
    state.turnOrder,
    state.teams,
    state.dartsPerPlayer,
    state.maxTeamSize,
    false,
  );

  const effects: ThrowEffect[] = [];
  effects.push({
    kind: "scored",
    teamId,
    delta: nextProgress - progress,
  });

  if (won) {
    effects.push({ kind: "gameWon", winnerTeamIds: [teamId] });
    return {
      state: {
        ...state,
        progressByTeam: nextProgressByTeam,
        pointer: state.pointer,
        status: "won",
        winnerTeamIds: [teamId],
      },
      effects,
    };
  }

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
    state: {
      ...state,
      progressByTeam: nextProgressByTeam,
      pointer: adv.pointer,
    },
    effects,
  };
}

export function selectScoreboardATC(state: ATCEngineState): ScoreboardSummary {
  const rows = state.teams.map((t) => {
    const p = state.progressByTeam[t.id] ?? 0;
    const next = p < 20 ? `${p + 1}` : p === 20 ? "Bull" : "—";
    return {
      teamId: t.id,
      primary: `next: ${next} (${p}/21)`,
      perPlayer: t.players.map((pl) => ({ playerId: pl.id, line: "" })),
    };
  });
  return { rows };
}

export function getTurnHintATC(state: ATCEngineState, teamId: string): { label: string; value: string } | null {
  const p = state.progressByTeam[teamId] ?? 0;
  if (p >= ATC_TARGETS_COUNT) return null;
  return { label: "Aim for", value: p < 20 ? String(p + 1) : "Bull" };
}

export function getBoardHintsATC(state: ATCEngineState): BoardHints {
  const teamId = state.turnOrder[state.pointer.teamIdx]!;
  const p = state.progressByTeam[teamId] ?? 0;
  const target: DartSegment = p < 20 ? ((p + 1) as DartSegment) : "bull";
  return { highlights: [{ segments: [target] }] };
}

export function getQuickInputsATC(state: ATCEngineState): QuickInputGroup[] | null {
  if (state.status !== "in-progress") return null;
  const teamId = state.turnOrder[state.pointer.teamIdx] ?? "";
  const p = state.progressByTeam[teamId] ?? 0;
  if (p < 20) {
    const n = p + 1;
    return [{
      label: `Target: ${n}  (${p}/${ATC_TARGETS_COUNT})`,
      actions: [
        { label: String(n), segment: n, multiplier: 1, score: n },
        { label: `D${n}`, segment: n, multiplier: 2, score: n * 2 },
        { label: `T${n}`, segment: n, multiplier: 3, score: n * 3 },
        { label: "Miss", segment: "miss", multiplier: 1, score: 0, variant: "miss" },
      ],
    }];
  }
  return [{
    label: `Target: Bull  (${p}/${ATC_TARGETS_COUNT})`,
    actions: [
      { label: "Bull", segment: "outer-bull", multiplier: 1, score: 25 },
      { label: "D-Bull", segment: "inner-bull", multiplier: 2, score: 50 },
      { label: "Miss", segment: "miss", multiplier: 1, score: 0, variant: "miss" },
    ],
  }];
}
