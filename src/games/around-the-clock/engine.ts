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
  /** Reverse order: 20, 19, ... 1, then bull. Optional for older saved states. */
  reverse?: boolean;
}

/** Number targeted at a numeric progress index (0..19). */
function numberAt(state: Pick<ATCEngineState, "reverse">, progress: number): number {
  return state.reverse ? 20 - progress : progress + 1;
}

/** Target at a progress index: a number for 0..19, bull for 20. */
export function targetAtATC(
  state: Pick<ATCEngineState, "reverse">,
  progress: number,
): number | "bull" {
  return progress < 20 ? numberAt(state, progress) : "bull";
}

/** Labels for each progress index, in play order (bull always last). */
export function targetLabelsATC(state: Pick<ATCEngineState, "reverse">): string[] {
  return [
    ...Array.from({ length: 20 }, (_, i) => String(numberAt(state, i))),
    "Bull",
  ];
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
    reverse: ctx.resolvedSettings["reverse"] === true,
  };
}

export function applyThrowATC(
  state: ATCEngineState,
  throw_: ThrowRecord,
): ApplyThrowResult<ATCEngineState> {
  if (state.status === "won") return { state, effects: [] };
  const teamId = state.turnOrder[state.pointer.teamIdx]!;
  const progress = state.progressByTeam[teamId] ?? 0;
  const target = targetAtATC(state, progress);
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
    const next = p < 20 ? String(numberAt(state, p)) : p === 20 ? "Bull" : "—";
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
  return { label: "Aim for", value: p < 20 ? String(numberAt(state, p)) : "Bull" };
}

export function getBoardHintsATC(state: ATCEngineState): BoardHints {
  const teamId = state.turnOrder[state.pointer.teamIdx]!;
  const p = state.progressByTeam[teamId] ?? 0;
  const target: DartSegment = p < 20 ? (numberAt(state, p) as DartSegment) : "bull";
  return { highlights: [{ segments: [target] }] };
}

export function getQuickInputsATC(state: ATCEngineState): QuickInputGroup[] | null {
  if (state.status !== "in-progress") return null;
  const teamId = state.turnOrder[state.pointer.teamIdx] ?? "";
  const p = state.progressByTeam[teamId] ?? 0;
  if (p < 20) {
    const n = numberAt(state, p);
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
