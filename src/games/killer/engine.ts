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
  maxTeamSize as computeMaxTeamSize,
  type TurnPointer,
  type TurnAdvanceResult,
} from "@/shared/turn/turn-helpers";

export const KILLER_THRESHOLD = 3;

export interface KillerEngineState {
  teams: Team[];
  turnOrder: string[];
  dartsPerPlayer: number;
  maxTeamSize: number;
  phase: "number-selection" | "playing";
  /** teamId → assigned number (1-20). */
  assignments: Record<string, number>;
  /** teamId → current lives (starts at 0, earns up). */
  lives: Record<string, number>;
  /** teamId → has killer status. */
  isKiller: Record<string, boolean>;
  eliminatedTeamIds: string[];
  /** "all" | "doubles" | "trebles" */
  targets: string;
  /** 0 = no limit; >0 = hard cap on lives. */
  maxLives: number;
  pointer: TurnPointer;
  status: "in-progress" | "won";
  winnerTeamIds: string[] | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function advanceSkipping(
  pointer: TurnPointer,
  turnOrder: string[],
  teams: Team[],
  dartsPerPlayer: number,
  mts: number,
  bust: boolean,
  shouldSkip: (teamId: string) => boolean,
): TurnAdvanceResult {
  let result = advance(pointer, turnOrder, teams, dartsPerPlayer, mts, bust);
  let safety = turnOrder.length;
  while (shouldSkip(result.nextTeamId) && safety-- > 0) {
    result = advance(
      result.pointer,
      turnOrder,
      teams,
      dartsPerPlayer,
      mts,
      true,
    );
  }
  return result;
}

function effectiveValue(throw_: ThrowRecord, targets: string): number {
  if (typeof throw_.segment !== "number") return 0;
  switch (targets) {
    case "doubles":
      return throw_.multiplier === 2 ? throw_.multiplier : 0;
    case "trebles":
      return throw_.multiplier === 3 ? throw_.multiplier : 0;
    default:
      return throw_.multiplier;
  }
}

function ownerOfNumber(
  assignments: Record<string, number>,
  num: number,
): string | undefined {
  for (const [teamId, n] of Object.entries(assignments)) {
    if (n === num) return teamId;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

export function initKiller(ctx: InitContext): KillerEngineState {
  const teams = [...ctx.teams];
  const turnOrder = teams.map((t) => t.id);
  const killerStraightOff =
    (ctx.resolvedSettings.killerStraightOff as boolean) ?? false;
  const numberSelection =
    (ctx.resolvedSettings.numberSelection as string) ?? "throw";
  const targets =
    (ctx.resolvedSettings.targets as string) ?? "all";
  const maxLives = (ctx.resolvedSettings.maxLives as number) ?? 0;

  const lives: Record<string, number> = {};
  const isKiller: Record<string, boolean> = {};
  const assignments: Record<string, number> = {};

  for (const t of teams) {
    lives[t.id] = killerStraightOff ? KILLER_THRESHOLD : 0;
    isKiller[t.id] = killerStraightOff;
  }

  let phase: "number-selection" | "playing" = "number-selection";

  if (numberSelection === "random") {
    const pool = Array.from({ length: 20 }, (_, i) => i + 1);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j]!, pool[i]!];
    }
    for (let i = 0; i < teams.length; i++) {
      assignments[teams[i]!.id] = pool[i]!;
    }
    phase = "playing";
  }

  return {
    teams,
    turnOrder,
    dartsPerPlayer: 3,
    maxTeamSize: computeMaxTeamSize(teams),
    phase,
    assignments,
    lives,
    isKiller,
    eliminatedTeamIds: [],
    targets,
    maxLives,
    pointer: initialPointer(),
    status: "in-progress",
    winnerTeamIds: null,
  };
}

// ---------------------------------------------------------------------------
// applyThrow
// ---------------------------------------------------------------------------

export function applyThrowKiller(
  state: KillerEngineState,
  throw_: ThrowRecord,
): ApplyThrowResult<KillerEngineState> {
  if (state.status === "won") return { state, effects: [] };

  if (state.phase === "number-selection") {
    return applyThrowNumberSelection(state, throw_);
  }
  return applyThrowPlaying(state, throw_);
}

// --- Number-selection phase ------------------------------------------------

function applyThrowNumberSelection(
  state: KillerEngineState,
  throw_: ThrowRecord,
): ApplyThrowResult<KillerEngineState> {
  const effects: ThrowEffect[] = [];
  const currentTeamId = state.turnOrder[state.pointer.teamIdx]!;

  // Bulls are ignored entirely — same player throws again.
  if (throw_.segment === "outer-bull" || throw_.segment === "inner-bull") {
    effects.push({ kind: "scored", teamId: currentTeamId, delta: 0 });
    return { state, effects };
  }

  let newAssignments = state.assignments;

  if (state.assignments[currentTeamId] === undefined) {
    const seg = throw_.segment;
    if (typeof seg === "number" && seg >= 1 && seg <= 20) {
      const taken = new Set(Object.values(state.assignments));
      if (!taken.has(seg)) {
        newAssignments = { ...state.assignments, [currentTeamId]: seg };
      }
    }
  }

  effects.push({ kind: "scored", teamId: currentTeamId, delta: 0 });

  const allAssigned = state.teams.every(
    (t) => newAssignments[t.id] !== undefined,
  );

  if (allAssigned) {
    const firstTeamId = state.turnOrder[0]!;
    const firstTeam = state.teams.find((t) => t.id === firstTeamId)!;
    effects.push({
      kind: "turnAdvance",
      nextTeamId: firstTeamId,
      nextPlayerId: firstTeam.players[0]!.id,
    });
    return {
      state: {
        ...state,
        assignments: newAssignments,
        phase: "playing",
        pointer: initialPointer(),
      },
      effects,
    };
  }

  const adv = advanceSkipping(
    state.pointer,
    state.turnOrder,
    state.teams,
    state.dartsPerPlayer,
    state.maxTeamSize,
    true,
    (id) => newAssignments[id] !== undefined,
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
    state: { ...state, assignments: newAssignments, pointer: adv.pointer },
    effects,
  };
}

// --- Playing phase ---------------------------------------------------------

function applyThrowPlaying(
  state: KillerEngineState,
  throw_: ThrowRecord,
): ApplyThrowResult<KillerEngineState> {
  const effects: ThrowEffect[] = [];
  const currentTeamId = state.turnOrder[state.pointer.teamIdx]!;
  const value = effectiveValue(throw_, state.targets);

  let newLives = state.lives;
  let newIsKiller = state.isKiller;
  let newEliminated = state.eliminatedTeamIds;

  if (value > 0 && typeof throw_.segment === "number") {
    const owner = ownerOfNumber(state.assignments, throw_.segment);

    if (owner && !state.eliminatedTeamIds.includes(owner)) {
      if (owner === currentTeamId) {
        // Hit own number → gain lives; (re)gain killer at threshold
        const uncapped = (state.lives[currentTeamId] ?? 0) + value;
        const after =
          state.maxLives > 0 ? Math.min(uncapped, state.maxLives) : uncapped;
        newLives = { ...state.lives, [currentTeamId]: after };
        if (after >= KILLER_THRESHOLD && !state.isKiller[currentTeamId]) {
          newIsKiller = { ...state.isKiller, [currentTeamId]: true };
        }
      } else if (state.isKiller[currentTeamId]) {
        // Killer hits opponent's number
        const ownerLives = state.lives[owner] ?? 0;
        if (ownerLives === 0) {
          // Already at 0 → eliminated
          newEliminated = [...state.eliminatedTeamIds, owner];
        } else {
          const remaining = Math.max(0, ownerLives - value);
          newLives = { ...state.lives, [owner]: remaining };
          // Opponent loses killer status when hit
          if (state.isKiller[owner]) {
            newIsKiller = { ...state.isKiller, [owner]: false };
          }
        }
      }
    }
  }

  effects.push({ kind: "scored", teamId: currentTeamId, delta: 0 });

  const activeIds = state.teams
    .map((t) => t.id)
    .filter((id) => !newEliminated.includes(id));

  if (activeIds.length <= 1) {
    effects.push({ kind: "gameWon", winnerTeamIds: activeIds });
    return {
      state: {
        ...state,
        lives: newLives,
        isKiller: newIsKiller,
        eliminatedTeamIds: newEliminated,
        status: "won",
        winnerTeamIds: activeIds,
      },
      effects,
    };
  }

  const adv = advanceSkipping(
    state.pointer,
    state.turnOrder,
    state.teams,
    state.dartsPerPlayer,
    state.maxTeamSize,
    false,
    (id) => newEliminated.includes(id),
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
    state: {
      ...state,
      lives: newLives,
      isKiller: newIsKiller,
      eliminatedTeamIds: newEliminated,
      pointer: adv.pointer,
    },
    effects,
  };
}

// ---------------------------------------------------------------------------
// Scoreboard
// ---------------------------------------------------------------------------

export function selectScoreboardKiller(
  state: KillerEngineState,
): ScoreboardSummary {
  return {
    rows: state.teams.map((t) => {
      const num = state.assignments[t.id];
      const lives = state.lives[t.id] ?? 0;
      const killer = state.isKiller[t.id] ?? false;
      const eliminated = state.eliminatedTeamIds.includes(t.id);

      let primary: string;
      if (state.phase === "number-selection") {
        primary = num !== undefined ? `#${num}` : "Awaiting number";
      } else if (eliminated) {
        primary = `#${num} — OUT`;
      } else {
        primary = `#${num} — ${lives} ${lives === 1 ? "life" : "lives"}${killer ? " — KILLER" : ""}`;
      }

      return {
        teamId: t.id,
        primary,
        perPlayer: t.players.map((p) => ({ playerId: p.id, line: "" })),
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// Turn hint
// ---------------------------------------------------------------------------

export function getTurnHintKiller(
  state: KillerEngineState,
  teamId: string,
): { label: string; value: string } | null {
  if (state.phase === "number-selection") {
    const num = state.assignments[teamId];
    if (num !== undefined) return { label: "Assigned", value: `#${num}` };
    return { label: "Throw", value: "Claim a number (1–20)" };
  }

  if (state.eliminatedTeamIds.includes(teamId)) return null;

  const num = state.assignments[teamId];
  const lives = state.lives[teamId] ?? 0;
  if (!state.isKiller[teamId]) {
    return {
      label: "Target",
      value: `#${num} — ${lives}/${KILLER_THRESHOLD} lives`,
    };
  }
  return {
    label: "Killer",
    value: `${lives} ${lives === 1 ? "life" : "lives"}`,
  };
}

// ---------------------------------------------------------------------------
// Board hints
// ---------------------------------------------------------------------------

function segmentHints(
  segments: DartSegment[],
  targets: string,
): BoardHints {
  switch (targets) {
    case "doubles":
      return { highlightDoubles: segments };
    case "trebles":
      return { highlightTriples: segments };
    default:
      return { highlight: segments };
  }
}

export function getBoardHintsKiller(state: KillerEngineState): BoardHints {
  const teamId = state.turnOrder[state.pointer.teamIdx]!;

  if (state.phase === "number-selection") {
    const taken = new Set(Object.values(state.assignments));
    const available = (
      Array.from({ length: 20 }, (_, i) => i + 1) as DartSegment[]
    ).filter((n) => !taken.has(n as number));
    return { highlight: available };
  }

  if (!state.isKiller[teamId]) {
    const num = state.assignments[teamId];
    return num ? segmentHints([num as DartSegment], state.targets) : {};
  }

  const targets: DartSegment[] = [];
  for (const t of state.teams) {
    if (t.id !== teamId && !state.eliminatedTeamIds.includes(t.id)) {
      const n = state.assignments[t.id];
      if (n) targets.push(n as DartSegment);
    }
  }
  return segmentHints(targets, state.targets);
}

// ---------------------------------------------------------------------------
// Quick inputs
// ---------------------------------------------------------------------------

function segmentActions(
  num: number,
  targets: string,
): QuickInputAction[] {
  const actions: QuickInputAction[] = [];
  if (targets === "all" || targets === "trebles") {
    if (targets === "all") {
      actions.push({
        label: `S${num}`,
        segment: num,
        multiplier: 1,
        score: num,
      });
    }
    if (targets === "all") {
      actions.push({
        label: `D${num}`,
        segment: num,
        multiplier: 2,
        score: num * 2,
      });
    }
    if (targets === "all" || targets === "trebles") {
      actions.push({
        label: `T${num}`,
        segment: num,
        multiplier: 3,
        score: num * 3,
      });
    }
  }
  if (targets === "doubles") {
    actions.push({
      label: `D${num}`,
      segment: num,
      multiplier: 2,
      score: num * 2,
    });
  }
  return actions;
}

export function getQuickInputsKiller(
  state: KillerEngineState,
): QuickInputGroup[] | null {
  if (state.status !== "in-progress") return null;

  const teamId = state.turnOrder[state.pointer.teamIdx]!;

  if (state.phase === "number-selection") {
    const taken = new Set(Object.values(state.assignments));
    const actions: QuickInputAction[] = [];
    for (let n = 1; n <= 20; n++) {
      if (!taken.has(n)) {
        actions.push({
          label: String(n),
          segment: n,
          multiplier: 1,
          score: n,
        });
      }
    }
    actions.push({
      label: "Miss",
      segment: "miss",
      multiplier: 1,
      score: 0,
      variant: "miss",
    });
    return [{ label: "Claim a number", actions }];
  }

  const groups: QuickInputGroup[] = [];
  const ownNum = state.assignments[teamId]!;

  if (!state.isKiller[teamId]) {
    groups.push({
      label: "Earn lives",
      actions: segmentActions(ownNum, state.targets),
    });
  } else {
    const currentLives = state.lives[teamId] ?? 0;
    const canGainLives =
      state.maxLives === 0 || currentLives < state.maxLives;
    if (canGainLives) {
      groups.push({
        label: "Gain lives",
        actions: segmentActions(ownNum, state.targets),
      });
    }

    for (const t of state.teams) {
      if (t.id === teamId || state.eliminatedTeamIds.includes(t.id)) continue;
      const num = state.assignments[t.id]!;
      const label =
        t.players.length === 1 ? t.players[0]!.displayName : t.displayName;
      groups.push({
        label: `${label} (#${num})`,
        actions: segmentActions(num, state.targets),
      });
    }
  }

  groups.push({
    actions: [
      {
        label: "Miss",
        segment: "miss",
        multiplier: 1,
        score: 0,
        variant: "miss",
      },
    ],
  });

  return groups;
}
