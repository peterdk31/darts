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

/** Clockwise segment order on a real dartboard, starting from the top. */
export const BOARD_ORDER: number[] = [
  20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5,
];

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
  /** teamId → current score. */
  scores: Record<string, number>;
  /** teamId → remaining lives. */
  lives: Record<string, number>;
  eliminatedTeamIds: string[];

  pointer: TurnPointer;
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
): number[] {
  const mineCount = Math.min(
    startingMines + (round - 1) * mineIncrement,
    20,
  );

  const shuffled = [...BOARD_ORDER];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  return shuffled.slice(0, mineCount).sort((a, b) => a - b);
}

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
    result = advance(result.pointer, turnOrder, teams, dartsPerPlayer, mts, true);
  }
  return result;
}

function isNewRound(pointer: TurnPointer): boolean {
  return (
    pointer.teamIdx === 0 &&
    pointer.playerIdxInTeam === 0 &&
    pointer.dartsThrownThisStretch === 0
  );
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

  const mines = generateMines(1, startingMines, mineIncrement);

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
): ApplyThrowResult<MinesweeperEngineState> {
  if (state.status === "won") return { state, effects: [] };

  const effects: ThrowEffect[] = [];
  const currentTeamId = state.turnOrder[state.pointer.teamIdx]!;

  let newScores = state.scores;
  let newLives = state.lives;
  let newEliminated = state.eliminatedTeamIds;

  const seg = throw_.segment;
  const isMine = typeof seg === "number" && state.mines.includes(seg);

  if (isMine) {
    const remaining = (state.lives[currentTeamId] ?? 0) - 1;
    newLives = { ...state.lives, [currentTeamId]: remaining };
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

  const activeIds = state.teams
    .map((t) => t.id)
    .filter((id) => !newEliminated.includes(id));

  if (activeIds.length <= 1) {
    const winnerIds = activeIds.length === 1 ? activeIds : bestScoreTeams(newScores, state.teams);
    effects.push({ kind: "gameWon", winnerTeamIds: winnerIds });
    return {
      state: {
        ...state,
        scores: newScores,
        lives: newLives,
        eliminatedTeamIds: newEliminated,
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
  if (isNewRound(adv.pointer)) {
    newRound = state.round + 1;
    newMines = generateMines(newRound, state.startingMines, state.mineIncrement);
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
      pointer: adv.pointer,
      round: newRound,
      mines: newMines,
    },
    effects,
  };
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
  const safeSegments: DartSegment[] = [];
  const mineSegments: DartSegment[] = [];
  for (let n = 1; n <= 20; n++) {
    if (state.mines.includes(n)) {
      mineSegments.push(n as DartSegment);
    } else {
      safeSegments.push(n as DartSegment);
    }
  }
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
