import type { Team, ThrowRecord } from "@/shared/types/core";
import type {
  ApplyThrowResult,
  BoardHints,
  DartSegment,
  InitContext,
  QuickInputAction,
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

export interface LumberjackRound {
  label: string;
  type: "number" | "double" | "triple" | "exact41" | "bull";
  target?: number;
}

export const LUMBERJACK_ROUNDS: readonly LumberjackRound[] = [
  { label: "15", type: "number", target: 15 },
  { label: "16", type: "number", target: 16 },
  { label: "Double", type: "double" },
  { label: "17", type: "number", target: 17 },
  { label: "Triple", type: "triple" },
  { label: "18", type: "number", target: 18 },
  { label: "41", type: "exact41" },
  { label: "19", type: "number", target: 19 },
  { label: "20", type: "number", target: 20 },
  { label: "Bull", type: "bull" },
];

export interface RoundLogEntry {
  scored: number;
  halved: boolean;
}

export interface LumberjackEngineState {
  teams: Team[];
  turnOrder: string[];
  dartsPerPlayer: number;
  maxTeamSize: number;
  currentRound: number;
  scoreByTeam: Record<string, number>;
  roundHitByTeam: Record<string, boolean>;
  roundPointsByTeam: Record<string, number>;
  dtAbove15Only: boolean;
  reverseOrder: boolean;
  roundLog: Record<string, RoundLogEntry[]>;
  /** Round 7 (exact-41): darts thrown in the current 3-dart chance (0-2). */
  r41DartsInChance: Record<string, number>;
  /** Round 7 (exact-41): running total for the current 3-dart chance. */
  r41ChanceTotal: Record<string, number>;
  /** Round 7 (exact-41): how many chances hit exactly 41 this round. */
  r41HitCount: Record<string, number>;
  pointer: TurnPointer;
  status: "in-progress" | "won";
  winnerTeamIds: string[] | null;
}

function getRounds(state: LumberjackEngineState): readonly LumberjackRound[] {
  return state.reverseOrder ? [...LUMBERJACK_ROUNDS].reverse() : LUMBERJACK_ROUNDS;
}

export function computeRoundPoints(
  throw_: ThrowRecord,
  round: LumberjackRound,
  dtAbove15Only: boolean,
): { points: number; hit: boolean } {
  if (throw_.segment === "miss") return { points: 0, hit: false };

  switch (round.type) {
    case "number": {
      if (typeof throw_.segment === "number" && throw_.segment === round.target) {
        return { points: throw_.segment * throw_.multiplier, hit: true };
      }
      return { points: 0, hit: false };
    }
    case "double": {
      if (throw_.multiplier === 2) {
        if (
          dtAbove15Only &&
          typeof throw_.segment === "number" &&
          throw_.segment <= 14
        ) {
          return { points: 0, hit: false };
        }
        return { points: throw_.score, hit: true };
      }
      if (throw_.segment === "inner-bull") {
        return { points: 50, hit: true };
      }
      return { points: 0, hit: false };
    }
    case "triple": {
      if (throw_.multiplier === 3) {
        if (
          dtAbove15Only &&
          typeof throw_.segment === "number" &&
          throw_.segment <= 14
        ) {
          return { points: 0, hit: false };
        }
        return { points: throw_.score, hit: true };
      }
      return { points: 0, hit: false };
    }
    case "exact41":
      return { points: throw_.score, hit: false };
    case "bull": {
      if (throw_.segment === "outer-bull") return { points: 25, hit: true };
      if (throw_.segment === "inner-bull") return { points: 50, hit: true };
      return { points: 0, hit: false };
    }
  }
}

export function initLumberjack(ctx: InitContext): LumberjackEngineState {
  const teams = [...ctx.teams];
  const turnOrder = teams.map((t) => t.id);
  const scoreByTeam: Record<string, number> = {};
  const roundHitByTeam: Record<string, boolean> = {};
  const roundPointsByTeam: Record<string, number> = {};
  const roundLog: Record<string, RoundLogEntry[]> = {};
  const r41DartsInChance: Record<string, number> = {};
  const r41ChanceTotal: Record<string, number> = {};
  const r41HitCount: Record<string, number> = {};
  for (const t of teams) {
    scoreByTeam[t.id] = 0;
    roundHitByTeam[t.id] = false;
    roundPointsByTeam[t.id] = 0;
    roundLog[t.id] = [];
    r41DartsInChance[t.id] = 0;
    r41ChanceTotal[t.id] = 0;
    r41HitCount[t.id] = 0;
  }
  const dtAbove15Only = ctx.resolvedSettings["dtAbove15Only"] === true;
  const reverseOrder = ctx.resolvedSettings["reverseOrder"] === true;
  return {
    teams,
    turnOrder,
    dartsPerPlayer: 3,
    maxTeamSize: maxTeamSize(teams),
    currentRound: 0,
    scoreByTeam,
    roundHitByTeam,
    roundPointsByTeam,
    dtAbove15Only,
    reverseOrder,
    roundLog,
    r41DartsInChance,
    r41ChanceTotal,
    r41HitCount,
    pointer: initialPointer(),
    status: "in-progress",
    winnerTeamIds: null,
  };
}

export function applyThrowLumberjack(
  state: LumberjackEngineState,
  throw_: ThrowRecord,
): ApplyThrowResult<LumberjackEngineState> {
  if (state.status === "won") return { state, effects: [] };

  const rounds = getRounds(state);
  const round = rounds[state.currentRound];
  if (!round) return { state, effects: [] };

  const teamId = state.turnOrder[state.pointer.teamIdx]!;
  const { points, hit } = computeRoundPoints(throw_, round, state.dtAbove15Only);

  let nextScoreByTeam = { ...state.scoreByTeam };
  let nextRoundHit = { ...state.roundHitByTeam };
  let nextRoundPoints = { ...state.roundPointsByTeam };
  let nextRoundLog = state.roundLog;
  let nextCurrentRound = state.currentRound;
  let nextR41Darts = { ...state.r41DartsInChance };
  let nextR41Total = { ...state.r41ChanceTotal };
  let nextR41Hits = { ...state.r41HitCount };

  const effects: ThrowEffect[] = [];
  let pointerForAdvance = state.pointer;

  if (round.type === "exact41") {
    nextR41Total[teamId] = (nextR41Total[teamId] ?? 0) + points;
    nextR41Darts[teamId] = (nextR41Darts[teamId] ?? 0) + 1;

    const dartsInChance = nextR41Darts[teamId]!;
    // Bust if miss (all darts must score) or total can no longer reach 41.
    // After N darts each remaining dart scores >= 1, so total must be <= 38+N.
    const r41Bust =
      dartsInChance < 3 &&
      (points === 0 || nextR41Total[teamId]! > 38 + dartsInChance);

    let chanceHit = false;
    if (r41Bust) {
      const dartsToSkip = 3 - dartsInChance;
      nextR41Darts[teamId] = 0;
      nextR41Total[teamId] = 0;
      pointerForAdvance = {
        ...state.pointer,
        dartsThrownThisStretch:
          state.pointer.dartsThrownThisStretch + dartsToSkip,
      };
      effects.push({ kind: "scored", teamId, delta: 0 });
      effects.push({
        kind: "bust",
        teamId,
        label: "BUST",
        detail: points === 0 ? "miss — all darts must score" : "over 41",
      });
    } else if (dartsInChance === 3) {
      if (nextR41Total[teamId] === 41) {
        nextScoreByTeam[teamId] = (nextScoreByTeam[teamId] ?? 0) + 41;
        nextR41Hits[teamId] = (nextR41Hits[teamId] ?? 0) + 1;
        chanceHit = true;
      }
      nextR41Darts[teamId] = 0;
      nextR41Total[teamId] = 0;
      effects.push({ kind: "scored", teamId, delta: chanceHit ? 41 : 0 });
    } else {
      effects.push({ kind: "scored", teamId, delta: 0 });
    }
  } else {
    if (points > 0) {
      nextScoreByTeam[teamId] = (nextScoreByTeam[teamId] ?? 0) + points;
      nextRoundPoints[teamId] = (nextRoundPoints[teamId] ?? 0) + points;
    }
    if (hit) {
      nextRoundHit[teamId] = true;
    }
    effects.push({ kind: "scored", teamId, delta: points });
  }

  const adv = advance(
    pointerForAdvance,
    state.turnOrder,
    state.teams,
    state.dartsPerPlayer,
    state.maxTeamSize,
    false,
  );

  if (adv.teamChanged) {
    let halved = false;
    let roundScored = 0;

    if (round.type === "exact41") {
      const hitCount = nextR41Hits[teamId] ?? 0;
      if (hitCount === 0) {
        nextScoreByTeam[teamId] = Math.floor(
          (nextScoreByTeam[teamId] ?? 0) / 2,
        );
        halved = true;
        effects.push({
          kind: "bust",
          teamId,
          label: "HALVED",
          detail: `score halved to ${nextScoreByTeam[teamId]}`,
        });
      } else {
        roundScored = hitCount * 41;
      }
    } else if (!nextRoundHit[teamId]) {
      nextScoreByTeam[teamId] = Math.floor(
        (nextScoreByTeam[teamId] ?? 0) / 2,
      );
      halved = true;
      effects.push({
        kind: "bust",
        teamId,
        label: "HALVED",
        detail: `score halved to ${nextScoreByTeam[teamId]}`,
      });
    } else {
      roundScored = nextRoundPoints[teamId] ?? 0;
    }

    nextRoundLog = { ...nextRoundLog };
    nextRoundLog[teamId] = [
      ...(nextRoundLog[teamId] ?? []),
      { scored: roundScored, halved },
    ];

    const roundComplete = adv.pointer.teamIdx <= state.pointer.teamIdx;
    if (roundComplete) {
      nextCurrentRound = state.currentRound + 1;
      nextRoundHit = {};
      nextRoundPoints = {};
      nextR41Darts = {};
      nextR41Total = {};
      nextR41Hits = {};
      for (const t of state.teams) {
        nextRoundHit[t.id] = false;
        nextRoundPoints[t.id] = 0;
        nextR41Darts[t.id] = 0;
        nextR41Total[t.id] = 0;
        nextR41Hits[t.id] = 0;
      }
    }

    if (nextCurrentRound >= rounds.length) {
      let maxScore = -1;
      for (const t of state.teams) {
        const score = nextScoreByTeam[t.id] ?? 0;
        if (score > maxScore) maxScore = score;
      }
      const winners = state.teams
        .filter((t) => (nextScoreByTeam[t.id] ?? 0) === maxScore)
        .map((t) => t.id);

      effects.push({ kind: "gameWon", winnerTeamIds: winners });
      return {
        state: {
          ...state,
          scoreByTeam: nextScoreByTeam,
          roundHitByTeam: nextRoundHit,
          roundPointsByTeam: nextRoundPoints,
          roundLog: nextRoundLog,
          r41DartsInChance: nextR41Darts,
          r41ChanceTotal: nextR41Total,
          r41HitCount: nextR41Hits,
          currentRound: nextCurrentRound,
          pointer: adv.pointer,
          status: "won",
          winnerTeamIds: winners,
        },
        effects,
      };
    }
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
      scoreByTeam: nextScoreByTeam,
      roundHitByTeam: nextRoundHit,
      roundPointsByTeam: nextRoundPoints,
      roundLog: nextRoundLog,
      r41DartsInChance: nextR41Darts,
      r41ChanceTotal: nextR41Total,
      r41HitCount: nextR41Hits,
      currentRound: nextCurrentRound,
      pointer: adv.pointer,
    },
    effects,
  };
}

export function getTurnHintLumberjack(state: LumberjackEngineState, _teamId: string): { label: string; value: string } | null {
  const rounds = getRounds(state);
  if (state.currentRound >= rounds.length) return null;
  const round = rounds[state.currentRound]!;
  return { label: "Aim for", value: round.label };
}

export function selectScoreboardLumberjack(
  state: LumberjackEngineState,
): ScoreboardSummary {
  return {
    rows: state.teams.map((t) => ({
      teamId: t.id,
      primary: String(state.scoreByTeam[t.id] ?? 0),
    })),
  };
}

const ALL_SEGMENTS: DartSegment[] = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
];
const SEGMENTS_15_PLUS: DartSegment[] = [15, 16, 17, 18, 19, 20];

export function getBoardHintsLumberjack(
  state: LumberjackEngineState,
): BoardHints {
  const rounds = getRounds(state);
  if (state.currentRound >= rounds.length) return {};
  const round = rounds[state.currentRound]!;
  if (round.type === "number") {
    return { highlights: [{ segments: [round.target as DartSegment] }] };
  }
  if (round.type === "bull") {
    return { highlights: [{ segments: ["bull" as DartSegment] }] };
  }
  if (round.type === "double") {
    const segs = state.dtAbove15Only ? SEGMENTS_15_PLUS : ALL_SEGMENTS;
    return { highlights: [{ segments: segs, rings: ["double"], bullInner: true }] };
  }
  if (round.type === "triple") {
    const segs = state.dtAbove15Only ? SEGMENTS_15_PLUS : ALL_SEGMENTS;
    return { highlights: [{ segments: segs, rings: ["triple"] }] };
  }
  return {};
}

export function getQuickInputsLumberjack(
  state: LumberjackEngineState,
): QuickInputGroup[] | null {
  if (state.status !== "in-progress") return null;
  const rounds = getRounds(state);
  if (state.currentRound >= rounds.length) return null;
  const round = rounds[state.currentRound]!;
  const miss: QuickInputAction = { label: "Miss", segment: "miss", multiplier: 1, score: 0, variant: "miss" };
  const roundLabel = `Round ${state.currentRound + 1}/${rounds.length}: ${round.label}`;

  if (round.type === "number") {
    const n = round.target!;
    return [{
      label: roundLabel,
      actions: [
        { label: String(n), segment: n, multiplier: 1, score: n },
        { label: `D${n}`, segment: n, multiplier: 2, score: n * 2 },
        { label: `T${n}`, segment: n, multiplier: 3, score: n * 3 },
        miss,
      ],
    }];
  }

  if (round.type === "bull") {
    return [{
      label: roundLabel,
      actions: [
        { label: "Bull", segment: "outer-bull", multiplier: 1, score: 25 },
        { label: "D-Bull", segment: "inner-bull", multiplier: 2, score: 50 },
        miss,
      ],
    }];
  }

  if (round.type === "double") {
    const segs = state.dtAbove15Only ? SEGMENTS_15_PLUS : ALL_SEGMENTS;
    const groups: QuickInputGroup[] = [];
    const high = segs.filter((s) => (s as number) >= 15);
    const low = segs.filter((s) => (s as number) < 15);

    const highActions: QuickInputAction[] = high.map((s) => ({
      label: `D${s}`, segment: s as number, multiplier: 2 as const, score: (s as number) * 2,
    }));
    highActions.push({ label: "D-Bull", segment: "inner-bull", multiplier: 2, score: 50 });
    groups.push({ label: roundLabel, actions: highActions });

    if (low.length > 0) {
      groups.push({
        label: "More doubles",
        actions: low.map((s) => ({
          label: `D${s}`, segment: s as number, multiplier: 2 as const, score: (s as number) * 2,
        })),
      });
    }

    groups.push({ actions: [miss] });
    return groups;
  }

  if (round.type === "triple") {
    const segs = state.dtAbove15Only ? SEGMENTS_15_PLUS : ALL_SEGMENTS;
    const groups: QuickInputGroup[] = [];
    const high = segs.filter((s) => (s as number) >= 15);
    const low = segs.filter((s) => (s as number) < 15);

    groups.push({
      label: roundLabel,
      actions: high.map((s) => ({
        label: `T${s}`, segment: s as number, multiplier: 3 as const, score: (s as number) * 3,
      })),
    });

    if (low.length > 0) {
      groups.push({
        label: "More triples",
        actions: low.map((s) => ({
          label: `T${s}`, segment: s as number, multiplier: 3 as const, score: (s as number) * 3,
        })),
      });
    }

    groups.push({ actions: [miss] });
    return groups;
  }

  if (round.type === "exact41") {
    const teamId = state.turnOrder[state.pointer.teamIdx] ?? "";
    const chanceTotal = state.r41ChanceTotal[teamId] ?? 0;
    const dartsInChance = state.r41DartsInChance[teamId] ?? 0;
    const remaining = 41 - chanceTotal;
    const chanceLabel = dartsInChance > 0
      ? `${roundLabel}  (need ${remaining} in ${3 - dartsInChance})`
      : roundLabel;

    return [{
      label: chanceLabel,
      actions: [
        ...ALL_SEGMENTS.map((s) => ({
          label: String(s), segment: s as number, multiplier: 1 as const, score: s as number,
        })),
        { label: "Bull", segment: "outer-bull", multiplier: 1, score: 25 },
        { label: "D-Bull", segment: "inner-bull", multiplier: 2, score: 50 },
        miss,
      ],
    }];
  }

  return null;
}
