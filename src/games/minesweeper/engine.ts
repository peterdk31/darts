import type { Team, ThrowRecord } from "@/shared/types/core";
import type {
  ApplyThrowResult,
  BoardHints,
  DartSegment,
  InitContext,
  QuickInputAction,
  QuickInputGroup,
  ScoreboardSummary,
  ThrowContext,
  ThrowEffect,
} from "@/shared/types/game-module";
import { shuffle, type RandomFn } from "@/shared/random";
import {
  advance,
  initialPointer,
  maxTeamSize as computeMaxTeamSize,
  type TurnPointer,
  type TurnAdvanceResult,
} from "@/shared/turn/turn-helpers";

/** Clockwise segment order on a real dartboard, starting from the top. */
export const BOARD_ORDER: number[] = [
  20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5,
];

export interface MineRound {
  round: number;
  mines: number[];
  /** Mines that were hit this round, in throw order. */
  hits: { teamId: string; playerId: string; segment: number }[];
}

export interface MinesweeperEngineState {
  teams: Team[];
  turnOrder: string[];
  dartsPerPlayer: number;
  maxTeamSize: number;

  round: number;
  startingMines: number;
  mineIncrement: number;
  maxLives: number;

  /** Segments that are mines this round. */
  mines: number[];
  /** Every round played so far, including the current one. */
  mineHistory: MineRound[];
  /** teamId → current score. */
  scores: Record<string, number>;
  /** teamId → remaining lives. */
  lives: Record<string, number>;
  eliminatedTeamIds: string[];

  pointer: TurnPointer;
  /** "won" once every team has run out of lives. */
  status: "in-progress" | "won";
  winnerTeamIds: string[] | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function generateMines(
  round: number,
  startingMines: number,
  mineIncrement: number,
  random: RandomFn,
): number[] {
  const mineCount = Math.min(
    startingMines + (round - 1) * mineIncrement,
    20,
  );
  return shuffle(BOARD_ORDER, random)
    .slice(0, mineCount)
    .sort((a, b) => a - b);
}

/**
 * Advance past eliminated teams. `wrapped` is true when the pointer passed
 * the end of the turn order, i.e. a new round has started — even when the
 * first team in the order is eliminated and gets skipped.
 */
function advanceSkipping(
  pointer: TurnPointer,
  turnOrder: string[],
  teams: Team[],
  dartsPerPlayer: number,
  mts: number,
  bust: boolean,
  shouldSkip: (teamId: string) => boolean,
): TurnAdvanceResult & { wrapped: boolean } {
  let result = advance(pointer, turnOrder, teams, dartsPerPlayer, mts, bust);
  let wrapped = result.teamChanged && result.pointer.teamIdx <= pointer.teamIdx;
  let safety = turnOrder.length;
  while (shouldSkip(result.nextTeamId) && safety-- > 0) {
    const prevIdx = result.pointer.teamIdx;
    result = advance(result.pointer, turnOrder, teams, dartsPerPlayer, mts, true);
    if (result.pointer.teamIdx <= prevIdx) wrapped = true;
  }
  return { ...result, wrapped };
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

export function initMinesweeper(ctx: InitContext): MinesweeperEngineState {
  const teams = [...ctx.teams];
  const turnOrder = teams.map((t) => t.id);
  const maxLives = (ctx.resolvedSettings.maxLives as number) ?? 3;
  const startingMines = (ctx.resolvedSettings.startingMines as number) ?? 3;
  const mineIncrement = (ctx.resolvedSettings.mineIncrement as number) ?? 1;

  const scores: Record<string, number> = {};
  const lives: Record<string, number> = {};
  for (const t of teams) {
    scores[t.id] = 0;
    lives[t.id] = maxLives;
  }

  const mines = generateMines(1, startingMines, mineIncrement, ctx.random);

  return {
    teams,
    turnOrder,
    dartsPerPlayer: 3,
    maxTeamSize: computeMaxTeamSize(teams),
    round: 1,
    startingMines,
    mineIncrement,
    maxLives,
    mines,
    mineHistory: [{ round: 1, mines, hits: [] }],
    scores,
    lives,
    eliminatedTeamIds: [],
    pointer: initialPointer(),
    status: "in-progress",
    winnerTeamIds: null,
  };
}

// ---------------------------------------------------------------------------
// applyThrow
// ---------------------------------------------------------------------------

export function applyThrowMinesweeper(
  state: MinesweeperEngineState,
  throw_: ThrowRecord,
  ctx: ThrowContext,
): ApplyThrowResult<MinesweeperEngineState> {
  if (state.status === "won") return { state, effects: [] };

  const effects: ThrowEffect[] = [];
  const currentTeamId = state.turnOrder[state.pointer.teamIdx]!;

  let newScores = state.scores;
  let newLives = state.lives;
  let newEliminated = state.eliminatedTeamIds;
  let newHistory = state.mineHistory;

  const seg = throw_.segment;
  const isMine = typeof seg === "number" && state.mines.includes(seg);

  if (isMine) {
    const remaining = (state.lives[currentTeamId] ?? 0) - 1;
    newLives = { ...state.lives, [currentTeamId]: remaining };
    newHistory = recordHit(state.mineHistory, state.round, state.mines, {
      teamId: currentTeamId,
      playerId: throw_.playerId,
      segment: seg as number,
    });
    effects.push({
      kind: "bust",
      teamId: currentTeamId,
      label: "MINE!",
      detail: `Hit ${seg} — lost a life`,
    });
    if (remaining <= 0) {
      newEliminated = [...state.eliminatedTeamIds, currentTeamId];
    }
  } else if (seg !== "miss") {
    const delta = throw_.score;
    newScores = {
      ...state.scores,
      [currentTeamId]: (state.scores[currentTeamId] ?? 0) + delta,
    };
    effects.push({ kind: "scored", teamId: currentTeamId, delta });
  } else {
    effects.push({ kind: "scored", teamId: currentTeamId, delta: 0 });
  }

  // The game runs until every team is out of lives; highest score wins.
  if (newEliminated.length >= state.teams.length) {
    const winnerIds = bestScoreTeams(newScores, state.teams);
    effects.push({ kind: "gameWon", winnerTeamIds: winnerIds });
    return {
      state: {
        ...state,
        scores: newScores,
        lives: newLives,
        eliminatedTeamIds: newEliminated,
        mineHistory: newHistory,
        status: "won",
        winnerTeamIds: winnerIds,
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
    isMine,
    (id) => newEliminated.includes(id),
  );

  let newRound = state.round;
  let newMines = state.mines;
  if (adv.wrapped) {
    newRound = state.round + 1;
    newMines = generateMines(
      newRound,
      state.startingMines,
      state.mineIncrement,
      ctx.random,
    );
    newHistory = [...newHistory, { round: newRound, mines: newMines, hits: [] }];
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
      scores: newScores,
      lives: newLives,
      eliminatedTeamIds: newEliminated,
      mineHistory: newHistory,
      pointer: adv.pointer,
      round: newRound,
      mines: newMines,
    },
    effects,
  };
}

function recordHit(
  history: MineRound[],
  round: number,
  mines: number[],
  hit: MineRound["hits"][number],
): MineRound[] {
  const last = history[history.length - 1];
  if (last && last.round === round) {
    return [...history.slice(0, -1), { ...last, hits: [...last.hits, hit] }];
  }
  return [...history, { round, mines, hits: [hit] }];
}

function bestScoreTeams(
  scores: Record<string, number>,
  teams: Team[],
): string[] {
  let best = -Infinity;
  const winners: string[] = [];
  for (const t of teams) {
    const s = scores[t.id] ?? 0;
    if (s > best) {
      best = s;
      winners.length = 0;
      winners.push(t.id);
    } else if (s === best) {
      winners.push(t.id);
    }
  }
  return winners;
}

// ---------------------------------------------------------------------------
// Scoreboard
// ---------------------------------------------------------------------------

export function selectScoreboardMinesweeper(
  state: MinesweeperEngineState,
): ScoreboardSummary {
  return {
    rows: state.teams.map((t) => {
      const score = state.scores[t.id] ?? 0;
      const lives = state.lives[t.id] ?? 0;
      const eliminated = state.eliminatedTeamIds.includes(t.id);

      let primary: string;
      if (eliminated) {
        primary = `${score} pts — OUT`;
      } else {
        primary = `${score} pts — ${lives} ${lives === 1 ? "life" : "lives"}`;
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

export function getTurnHintMinesweeper(
  state: MinesweeperEngineState,
  teamId: string,
): { label: string; value: string } | null {
  if (state.eliminatedTeamIds.includes(teamId)) return null;

  const safeCount = 20 - state.mines.length + 1;
  return {
    label: `Round ${state.round}`,
    value: `${safeCount} safe · ${state.mines.length} mines`,
  };
}

// ---------------------------------------------------------------------------
// Board hints
// ---------------------------------------------------------------------------

export function getBoardHintsMinesweeper(state: MinesweeperEngineState): BoardHints {
  const mineSegments = state.mines.map((n) => n as DartSegment);
  return {
    segmentColors: [
      { segments: mineSegments, color: "#cc0000", opacity: 1 },
    ],
  };
}

// ---------------------------------------------------------------------------
// Quick inputs
// ---------------------------------------------------------------------------

export function getQuickInputsMinesweeper(
  state: MinesweeperEngineState,
): QuickInputGroup[] | null {
  if (state.status !== "in-progress") return null;

  const safeActions: QuickInputAction[] = [];
  const mineActions: QuickInputAction[] = [];

  for (let n = 1; n <= 20; n++) {
    if (state.mines.includes(n)) {
      mineActions.push({
        label: `${n}`,
        segment: n,
        multiplier: 1,
        score: n,
      });
    } else {
      safeActions.push({
        label: `${n}`,
        segment: n,
        multiplier: 1,
        score: n,
      });
    }
  }

  safeActions.push(
    { label: "Bull", segment: "outer-bull", multiplier: 1, score: 25 },
    { label: "Inner", segment: "inner-bull", multiplier: 1, score: 50 },
  );

  const groups: QuickInputGroup[] = [];

  groups.push({ label: "Safe", actions: safeActions });
  if (mineActions.length > 0) {
    groups.push({ label: "Mines", actions: mineActions });
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
