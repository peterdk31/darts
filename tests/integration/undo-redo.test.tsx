import { describe, it, expect } from "vitest";
import {
  completedGameRecord,
  createGame,
  recordThrow,
  redoThrow,
  replayGame,
  undoThrow,
} from "@/shell/session/gameRunner";
import type { InProgressGame } from "@/shell/session/types";
import { x01Manifest } from "@/games/x01/manifest";
import { minesweeperManifest } from "@/games/minesweeper/manifest";
import { killerManifest } from "@/games/killer/manifest";
import type { MinesweeperEngineState } from "@/games/minesweeper/engine";
import type { KillerEngineState } from "@/games/killer/engine";
import type { GameManifest, ResolvedSettings } from "@/shared/types/game-module";
import type { Team, ThrowRecord } from "@/shared/types/core";

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

function newGame(
  manifest: GameManifest<any>, // eslint-disable-line @typescript-eslint/no-explicit-any
  resolvedSettings: ResolvedSettings,
  id = "g1",
): InProgressGame {
  return createGame(manifest, {
    id,
    teams: makeTeams(),
    resolvedSettings,
    startedAt: new Date(0).toISOString(),
  });
}

const x01Settings = { startingScore: "501", doubleOut: false, doubleIn: false };

function makeThrow(
  game: InProgressGame,
  segment: ThrowRecord["segment"],
  multiplier: 1 | 2 | 3,
  score: number,
): ThrowRecord {
  return {
    teamId: game.currentTurn.teamId,
    playerId: game.currentTurn.playerId,
    segment,
    multiplier,
    score,
    timestamp: new Date(0).toISOString(),
  };
}

function play(
  game: InProgressGame,
  t: ThrowRecord,
  manifest: GameManifest<any> = x01Manifest, // eslint-disable-line @typescript-eslint/no-explicit-any
): InProgressGame {
  return recordThrow(manifest, game, t).game;
}

describe("undo/redo", () => {
  it("walks back through three throws to the exact pre-throw state", () => {
    const baseline = newGame(x01Manifest, x01Settings);
    let g = baseline;
    g = play(g, makeThrow(g, 20, 3, 60));
    g = play(g, makeThrow(g, 20, 1, 20));
    g = play(g, makeThrow(g, 19, 1, 19));
    expect(g.throws).toHaveLength(3);
    expect(g.engineState).not.toEqual(baseline.engineState);

    g = undoThrow(x01Manifest, g)!;
    g = undoThrow(x01Manifest, g)!;
    g = undoThrow(x01Manifest, g)!;

    expect(g.throws).toHaveLength(0);
    expect(g.engineState).toEqual(baseline.engineState);
    expect(g.currentTurn).toEqual(baseline.currentTurn);
    expect(g.redoStack).toHaveLength(3);
    expect(undoThrow(x01Manifest, g)).toBeNull();
  });

  it("redo reapplies undone throws in original order", () => {
    let g = newGame(x01Manifest, x01Settings);
    const t1 = makeThrow(g, 20, 3, 60);
    g = play(g, t1);
    const t2 = makeThrow(g, 20, 1, 20);
    g = play(g, t2);
    const afterTwo = g;
    const t3 = makeThrow(g, 19, 1, 19);
    g = play(g, t3);

    g = undoThrow(x01Manifest, g)!;
    g = undoThrow(x01Manifest, g)!;
    g = undoThrow(x01Manifest, g)!;

    g = redoThrow(x01Manifest, g)!.game;
    g = redoThrow(x01Manifest, g)!.game;

    expect(g.throws).toEqual([t1, t2]);
    expect(g.redoStack).toEqual([t3]);
    expect(g.engineState).toEqual(afterTwo.engineState);
    expect(g.currentTurn).toEqual(afterTwo.currentTurn);
  });

  it("recording a new throw clears redoStack (FR-024)", () => {
    let g = newGame(x01Manifest, x01Settings);
    g = play(g, makeThrow(g, 20, 3, 60));
    g = play(g, makeThrow(g, 20, 1, 20));
    g = undoThrow(x01Manifest, g)!;
    expect(g.redoStack).toHaveLength(1);

    g = play(g, makeThrow(g, 5, 1, 5));
    expect(g.redoStack).toHaveLength(0);
  });

  it("redo of the winning throw reports the win", () => {
    let g = newGame(x01Manifest, { startingScore: "301", doubleOut: false, doubleIn: false });
    // A: 180 ×1, then 121 → finish on the next turn.
    const darts: Array<[number | "inner-bull", 1 | 2 | 3, number]> = [
      [20, 3, 60], [20, 3, 60], [20, 3, 60], // A → 121
      [1, 1, 1], [1, 1, 1], [1, 1, 1],       // B
      [20, 3, 60], [20, 3, 60],              // A → 1
    ];
    for (const [seg, mul, score] of darts) g = play(g, makeThrow(g, seg, mul, score));
    const win = recordThrow(x01Manifest, g, makeThrow(g, 1, 1, 1));
    expect(win.winnerTeamIds).toEqual(["A"]);

    const undone = undoThrow(x01Manifest, win.game)!;
    const redone = redoThrow(x01Manifest, undone)!;
    expect(redone.winnerTeamIds).toEqual(["A"]);
    expect(redone.game.engineState).toEqual(win.game.engineState);
  });
});

describe("shanghai", () => {
  const settings = { startingScore: "501", doubleOut: false, doubleIn: false, shanghai: true };

  function shanghai(g: InProgressGame): InProgressGame {
    g = play(g, makeThrow(g, 20, 1, 20));
    return play(g, makeThrow(g, 20, 2, 40));
  }

  it("wins on single/double/triple of one number", () => {
    const g = shanghai(newGame(x01Manifest, settings));
    const r = recordThrow(x01Manifest, g, makeThrow(g, 20, 3, 60));
    expect(r.winnerTeamIds).toEqual(["A"]);
    expect(r.effects.some((e) => e.kind === "gameWon")).toBe(true);
  });

  it("is detected on redo and on replay, not just live", () => {
    const g = shanghai(newGame(x01Manifest, settings));
    const won = recordThrow(x01Manifest, g, makeThrow(g, 20, 3, 60)).game;

    const redone = redoThrow(x01Manifest, undoThrow(x01Manifest, won)!)!;
    expect(redone.winnerTeamIds).toEqual(["A"]);
    expect(replayGame(x01Manifest, won).winnerTeamIds).toEqual(["A"]);
  });

  it("does nothing when the setting is off", () => {
    let g = newGame(x01Manifest, x01Settings);
    g = shanghai(g);
    expect(recordThrow(x01Manifest, g, makeThrow(g, 20, 3, 60)).winnerTeamIds).toBeNull();
  });
});

describe("randomised games survive undo", () => {
  it("minesweeper keeps the same mines when undoing across a round change", () => {
    const settings = { maxLives: 3, startingMines: 3, mineIncrement: 1 };
    let g = newGame(minesweeperManifest, settings);
    for (let i = 0; i < 6; i++) g = play(g, makeThrow(g, "miss", 1, 0), minesweeperManifest);
    const round2 = g.engineState as MinesweeperEngineState;
    expect(round2.round).toBe(2);

    g = play(g, makeThrow(g, "miss", 1, 0), minesweeperManifest);
    g = undoThrow(minesweeperManifest, g)!;
    g = undoThrow(minesweeperManifest, g)!;
    g = redoThrow(minesweeperManifest, g)!.game;

    expect((g.engineState as MinesweeperEngineState).mines).toEqual(round2.mines);
    expect((g.engineState as MinesweeperEngineState).mineHistory).toEqual(round2.mineHistory);
  });

  it("killer keeps the same random numbers after undo", () => {
    const settings = { numberSelection: "random", targets: "all", killerStraightOff: false, maxLives: 0 };
    let g = newGame(killerManifest, settings);
    const before = (g.engineState as KillerEngineState).assignments;
    g = play(g, makeThrow(g, 1, 1, 1), killerManifest);
    g = undoThrow(killerManifest, g)!;
    expect((g.engineState as KillerEngineState).assignments).toEqual(before);
  });

  it("different games get different mines", () => {
    const settings = { maxLives: 3, startingMines: 5, mineIncrement: 1 };
    const mines = new Set(
      ["g1", "g2", "g3", "g4"].map((id) =>
        (newGame(minesweeperManifest, settings, id).engineState as MinesweeperEngineState).mines.join(),
      ),
    );
    expect(mines.size).toBeGreaterThan(1);
  });
});

describe("completedGameRecord", () => {
  it("captures the final engine state and throws-based summary", () => {
    let g = newGame(x01Manifest, x01Settings);
    g = play(g, makeThrow(g, 20, 3, 60));
    const rec = completedGameRecord(g, ["A"]);
    expect(rec.finalEngineState).toBe(g.engineState);
    expect(rec.winnerTeamIds).toEqual(["A"]);
  });
});
