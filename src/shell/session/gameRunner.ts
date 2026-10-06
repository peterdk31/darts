/**
 * The single place where throws are applied to a game.
 *
 * The throw list is the source of truth; `engineState` / `currentTurn` on an
 * InProgressGame are a cache of replaying those throws from `init`. Recording,
 * undo, redo and session restore all go through `stepGame`, so they cannot
 * drift apart. This relies on engines being pure (see GameManifest) — the
 * seeded `random()` handed to engines keeps replays identical.
 */
import type {
  GameManifest,
  InitContext,
  ResolvedSettings,
  ThrowEffect,
} from "@/shared/types/game-module";
import type { Team, ThrowRecord } from "@/shared/types/core";
import type { CompletedGameRecord, CurrentTurn, InProgressGame } from "./types";
import { allotmentForPlayer } from "@/shared/dart-allotment";
import { gameRandom } from "@/shared/random";
import { detectShanghai } from "@/shared/shanghai";
import { maxTeamSize as computeMaxTeamSize } from "@/shared/turn/turn-helpers";
import { computeWinSummary } from "@/shell/stats/computeWinSummary";

type Manifest = GameManifest<any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** Result of applying one throw. `game` already includes the throw. */
export interface StepResult {
  game: InProgressGame;
  effects: ThrowEffect[];
  /** Set when this throw ended the game. */
  winnerTeamIds: string[] | null;
}

export function makeInitContext(
  game: Pick<InProgressGame, "id" | "teams" | "resolvedSettings" | "dartsPerPlayer" | "maxTeamSize">,
): InitContext {
  const { teams, dartsPerPlayer, maxTeamSize } = game;
  const teamById = new Map<string, Team>(teams.map((t) => [t.id, t]));
  return {
    teams,
    resolvedSettings: game.resolvedSettings,
    random: gameRandom(game.id, "init"),
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

function initialCurrentTurn(
  turnOrder: string[],
  playerRotation: Record<string, string[]>,
): CurrentTurn {
  const teamId = turnOrder[0]!;
  const playerId = playerRotation[teamId]?.[0] ?? "";
  return { teamId, playerId, dartsThrownThisTurn: 0 };
}

export function createGame(
  manifest: Manifest,
  opts: {
    id: string;
    teams: ReadonlyArray<Team>;
    resolvedSettings: ResolvedSettings;
    startedAt: string;
  },
): InProgressGame {
  const teams = opts.teams.map((t) => ({
    ...t,
    players: t.players.map((p) => ({ ...p })),
  }));
  const turnOrder = teams.map((t) => t.id);
  const playerRotation: Record<string, string[]> = {};
  for (const t of teams) playerRotation[t.id] = t.players.map((p) => p.id);

  const base = {
    id: opts.id,
    gameTypeId: manifest.id,
    resolvedSettings: opts.resolvedSettings,
    teams,
    dartsPerPlayer: manifest.dartsPerPlayer,
    maxTeamSize: computeMaxTeamSize(teams),
    turnOrder,
    playerRotation,
  };
  return {
    ...base,
    throws: [],
    redoStack: [],
    engineState: manifest.init(makeInitContext(base)),
    engineSchemaVersion: manifest.schemaVersion,
    currentTurn: initialCurrentTurn(turnOrder, playerRotation),
    status: "in-progress",
    startedAt: opts.startedAt,
  };
}

/**
 * Apply `throw_` on top of `game` (whose throws are those already played).
 * Pure — returns the new engine state and turn without touching redoStack.
 */
function stepGame(
  manifest: Manifest,
  game: InProgressGame,
  throw_: ThrowRecord,
): { engineState: unknown; currentTurn: CurrentTurn; effects: ThrowEffect[]; winnerTeamIds: string[] | null } {
  const prevTurn = game.currentTurn;
  const result = manifest.applyThrow(game.engineState, throw_, {
    random: gameRandom(game.id, game.throws.length),
  });
  const effects = [...result.effects];

  let currentTurn: CurrentTurn = {
    ...prevTurn,
    dartsThrownThisTurn: prevTurn.dartsThrownThisTurn + 1,
  };
  for (const eff of effects) {
    if (eff.kind === "turnAdvance") {
      currentTurn = {
        teamId: eff.nextTeamId,
        playerId: eff.nextPlayerId,
        dartsThrownThisTurn: 0,
      };
    }
  }

  let won = effects.find(
    (e): e is Extract<ThrowEffect, { kind: "gameWon" }> => e.kind === "gameWon",
  );

  // Shanghai is a shell-level rule shared by several games: same number hit
  // as single, double and triple with one player's three darts of a turn.
  if (
    !won &&
    game.resolvedSettings["shanghai"] === true &&
    prevTurn.dartsThrownThisTurn === 2
  ) {
    const last3 = [...game.throws, throw_]
      .slice(-3)
      .filter((t) => t.playerId === throw_.playerId);
    if (last3.length === 3 && detectShanghai(last3)) {
      won = { kind: "gameWon", winnerTeamIds: [prevTurn.teamId] };
      effects.push(won);
    }
  }

  return {
    engineState: result.state,
    currentTurn,
    effects,
    winnerTeamIds: won ? won.winnerTeamIds.slice() : null,
  };
}

function withThrow(manifest: Manifest, game: InProgressGame, throw_: ThrowRecord, redoStack: ThrowRecord[]): StepResult {
  const r = stepGame(manifest, game, throw_);
  return {
    game: {
      ...game,
      throws: [...game.throws, throw_],
      redoStack,
      engineState: r.engineState,
      currentTurn: r.currentTurn,
    },
    effects: r.effects,
    winnerTeamIds: r.winnerTeamIds,
  };
}

/** Record a new throw. Clears the redo stack (FR-024). */
export function recordThrow(
  manifest: Manifest,
  game: InProgressGame,
  throw_: ThrowRecord,
): StepResult {
  return withThrow(manifest, game, throw_, []);
}

/**
 * Rebuild a game from `init` by replaying `throws`. Stops at the first throw
 * that ends the game (later throws cannot exist in a valid game).
 */
export function replayGame(
  manifest: Manifest,
  game: InProgressGame,
  throws: ReadonlyArray<ThrowRecord> = game.throws,
): { game: InProgressGame; winnerTeamIds: string[] | null } {
  let g: InProgressGame = {
    ...game,
    throws: [],
    engineState: manifest.init(makeInitContext(game)),
    currentTurn: initialCurrentTurn(game.turnOrder, game.playerRotation),
  };
  for (const t of throws) {
    const r = withThrow(manifest, g, t, game.redoStack);
    g = r.game;
    if (r.winnerTeamIds) return { game: g, winnerTeamIds: r.winnerTeamIds };
  }
  return { game: g, winnerTeamIds: null };
}

/** Undo the last throw; it moves onto the redo stack. */
export function undoThrow(manifest: Manifest, game: InProgressGame): InProgressGame | null {
  const last = game.throws[game.throws.length - 1];
  if (!last) return null;
  const { game: rebuilt } = replayGame(manifest, game, game.throws.slice(0, -1));
  return { ...rebuilt, redoStack: [...game.redoStack, last] };
}

/** Re-apply the most recently undone throw. */
export function redoThrow(manifest: Manifest, game: InProgressGame): StepResult | null {
  const next = game.redoStack[game.redoStack.length - 1];
  if (!next) return null;
  return withThrow(manifest, game, next, game.redoStack.slice(0, -1));
}

export function completedGameRecord(
  game: InProgressGame,
  winnerTeamIds: string[],
): CompletedGameRecord {
  return {
    id: game.id,
    gameTypeId: game.gameTypeId,
    resolvedSettings: game.resolvedSettings,
    teams: game.teams,
    winnerTeamIds,
    completedAt: new Date().toISOString(),
    summary: computeWinSummary(
      game.gameTypeId, game.teams, winnerTeamIds, game.throws, game.engineState,
    ),
    finalEngineState: game.engineState,
  };
}
