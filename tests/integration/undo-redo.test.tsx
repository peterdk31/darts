import { describe, it, expect } from "vitest";
import {
  initialSessionState,
  sessionReducer,
  type SessionAction,
} from "@/shell/session/sessionReducer";
import {
  applyOne,
  initialCurrentTurn,
  makeInitContext,
  replayAll,
} from "@/shell/session/replay";
import type { InProgressGame } from "@/shell/session/types";
import { x01Manifest } from "@/games/x01/manifest";
import type { GameManifest } from "@/shared/types/game-module";
import type { Team, ThrowRecord } from "@/shared/types/core";

const manifest = x01Manifest as unknown as GameManifest;

function makeTeams(): Team[] {
  return [
    {
      id: "A",
      displayName: "Alpha",
      colorId: "red",
      players: [{ id: "A1", displayName: "Alice" }],
    },
    {
      id: "B",
      displayName: "Bravo",
      colorId: "green",
      players: [{ id: "B1", displayName: "Bob" }],
    },
  ];
}

function makeThrow(
  teamId: string,
  playerId: string,
  segment: ThrowRecord["segment"],
  multiplier: 1 | 2 | 3,
  score: number,
): ThrowRecord {
  return {
    teamId,
    playerId,
    segment,
    multiplier,
    score,
    timestamp: new Date(0).toISOString(),
  };
}

function bootstrapGame(): InProgressGame {
  const teams = makeTeams();
  const turnOrder = ["A", "B"];
  const playerRotation: Record<string, string[]> = { A: ["A1"], B: ["B1"] };
  const dartsPerPlayer = 3;
  const teamMax = 1;
  const resolvedSettings = { startingScore: "501", doubleOut: false, doubleIn: false };
  const initCtx = makeInitContext(teams, resolvedSettings, dartsPerPlayer, teamMax);
  const engineState = manifest.init(initCtx);
  return {
    id: "g1",
    gameTypeId: manifest.id,
    resolvedSettings,
    teams,
    dartsPerPlayer,
    maxTeamSize: teamMax,
    turnOrder,
    playerRotation,
    throws: [],
    redoStack: [],
    engineState,
    engineSchemaVersion: manifest.schemaVersion,
    currentTurn: initialCurrentTurn(turnOrder, playerRotation),
    status: "in-progress",
    startedAt: new Date(0).toISOString(),
  };
}

// Mirrors PlayPage.handleThrow logic at the reducer level.
function dispatchThrow(
  state: ReturnType<typeof sessionReducer>,
  throw_: ThrowRecord,
): ReturnType<typeof sessionReducer> {
  const game = state.inProgressGame!;
  const r = applyOne(manifest, game.engineState, game.currentTurn, throw_);
  const action: SessionAction = {
    type: "appendThrow",
    throw_,
    engineState: r.state,
    currentTurn: r.turn,
  };
  return sessionReducer(state, action);
}

// Mirrors PlayPage.handleUndo (replay-from-init through n-1 throws).
function dispatchUndo(
  state: ReturnType<typeof sessionReducer>,
): ReturnType<typeof sessionReducer> {
  const game = state.inProgressGame!;
  if (game.throws.length === 0) return state;
  const initCtx = makeInitContext(
    game.teams,
    game.resolvedSettings,
    game.dartsPerPlayer,
    game.maxTeamSize,
  );
  const newThrows = game.throws.slice(0, -1);
  const replay = replayAll(
    manifest,
    initCtx,
    game.turnOrder,
    game.playerRotation,
    newThrows,
  );
  return sessionReducer(state, {
    type: "popThrow",
    engineState: replay.engineState,
    currentTurn: replay.currentTurn,
  });
}

// Mirrors PlayPage.handleRedo (pops top of redoStack, replays full throws+1).
function dispatchRedo(
  state: ReturnType<typeof sessionReducer>,
): ReturnType<typeof sessionReducer> {
  const game = state.inProgressGame!;
  if (game.redoStack.length === 0) return state;
  const popped = game.redoStack[game.redoStack.length - 1]!;
  const initCtx = makeInitContext(
    game.teams,
    game.resolvedSettings,
    game.dartsPerPlayer,
    game.maxTeamSize,
  );
  const newThrows = [...game.throws, popped];
  const replay = replayAll(
    manifest,
    initCtx,
    game.turnOrder,
    game.playerRotation,
    newThrows,
  );
  return sessionReducer(state, {
    type: "popRedo",
    engineState: replay.engineState,
    currentTurn: replay.currentTurn,
  });
}

describe("undo/redo (Iteration 3)", () => {
  it("walks back through three throws to the exact pre-throw state", () => {
    const game = bootstrapGame();
    let s = sessionReducer(initialSessionState, { type: "setInProgressGame", game });
    const baselineState = s.inProgressGame!.engineState;
    const baselineTurn = s.inProgressGame!.currentTurn;

    s = dispatchThrow(s, makeThrow("A", "A1", 20, 3, 60));
    s = dispatchThrow(s, makeThrow("A", "A1", 20, 1, 20));
    s = dispatchThrow(s, makeThrow("A", "A1", 19, 1, 19));
    expect(s.inProgressGame!.throws).toHaveLength(3);
    expect(s.inProgressGame!.engineState).not.toEqual(baselineState);

    s = dispatchUndo(s);
    s = dispatchUndo(s);
    s = dispatchUndo(s);

    expect(s.inProgressGame!.throws).toHaveLength(0);
    expect(s.inProgressGame!.engineState).toEqual(baselineState);
    expect(s.inProgressGame!.currentTurn).toEqual(baselineTurn);
    expect(s.inProgressGame!.redoStack).toHaveLength(3);
  });

  it("redo reapplies undone throws in original order", () => {
    const game = bootstrapGame();
    let s = sessionReducer(initialSessionState, { type: "setInProgressGame", game });

    const t1 = makeThrow("A", "A1", 20, 3, 60);
    const t2 = makeThrow("A", "A1", 20, 1, 20);
    const t3 = makeThrow("A", "A1", 19, 1, 19);
    s = dispatchThrow(s, t1);
    s = dispatchThrow(s, t2);
    s = dispatchThrow(s, t3);
    const stateAfterAllThrows = s.inProgressGame!.engineState;

    s = dispatchUndo(s);
    s = dispatchUndo(s);
    s = dispatchUndo(s);

    s = dispatchRedo(s);
    s = dispatchRedo(s);

    expect(s.inProgressGame!.throws).toHaveLength(2);
    expect(s.inProgressGame!.throws[0]).toEqual(t1);
    expect(s.inProgressGame!.throws[1]).toEqual(t2);
    expect(s.inProgressGame!.redoStack).toHaveLength(1);
    expect(s.inProgressGame!.redoStack[0]).toEqual(t3);
    expect(s.inProgressGame!.engineState).not.toEqual(stateAfterAllThrows);
  });

  it("recording a new throw clears redoStack (FR-024)", () => {
    const game = bootstrapGame();
    let s = sessionReducer(initialSessionState, { type: "setInProgressGame", game });

    s = dispatchThrow(s, makeThrow("A", "A1", 20, 3, 60));
    s = dispatchThrow(s, makeThrow("A", "A1", 20, 1, 20));
    s = dispatchUndo(s);
    expect(s.inProgressGame!.redoStack).toHaveLength(1);

    s = dispatchThrow(s, makeThrow("A", "A1", 5, 1, 5));
    expect(s.inProgressGame!.redoStack).toHaveLength(0);
  });
});
