import { describe, it, expect } from "vitest";
import {
  applyThrowMinesweeper,
  getBoardHintsMinesweeper,
  getTurnHintMinesweeper,
  getQuickInputsMinesweeper,
  initMinesweeper,
  selectScoreboardMinesweeper,
  generateMines,
  BOARD_ORDER,
  type MinesweeperEngineState,
} from "@/games/minesweeper/engine";
import type { Team, ThrowRecord } from "@/shared/types/core";
import type { InitContext } from "@/shared/types/game-module";

function makeThreeTeams(): Team[] {
  return [
    {
      id: "A",
      displayName: "A",
      colorId: "red",
      players: [{ id: "A1", displayName: "Alice" }],
    },
    {
      id: "B",
      displayName: "B",
      colorId: "green",
      players: [{ id: "B1", displayName: "Bob" }],
    },
    {
      id: "C",
      displayName: "C",
      colorId: "orange",
      players: [{ id: "C1", displayName: "Charlie" }],
    },
  ];
}

function makeTwoTeams(): Team[] {
  return [
    {
      id: "A",
      displayName: "A",
      colorId: "red",
      players: [{ id: "A1", displayName: "Alice" }],
    },
    {
      id: "B",
      displayName: "B",
      colorId: "green",
      players: [{ id: "B1", displayName: "Bob" }],
    },
  ];
}

function ctx(
  teams: Team[],
  overrides: Record<string, unknown> = {},
): InitContext {
  return {
    teams,
    resolvedSettings: {
      maxLives: 3,
      startingMines: 3,
      mineIncrement: 1,
      ...overrides,
    },
    helpers: { teamAllotment: () => 3, allotmentForPlayer: () => 3 },
  };
}

function withMines(
  state: MinesweeperEngineState,
  mines: number[],
): MinesweeperEngineState {
  return { ...state, mines };
}

function activeIds(s: MinesweeperEngineState): {
  teamId: string;
  playerId: string;
} {
  const teamId = s.turnOrder[s.pointer.teamIdx]!;
  const team = s.teams.find((t) => t.id === teamId)!;
  const playerId = team.players[s.pointer.playerIdxInTeam]!.id;
  return { teamId, playerId };
}

function throwAt(
  s: MinesweeperEngineState,
  segment: ThrowRecord["segment"],
  multiplier: 1 | 2 | 3,
  score: number,
): MinesweeperEngineState {
  const { teamId, playerId } = activeIds(s);
  return applyThrowMinesweeper(s, {
    teamId,
    playerId,
    segment,
    multiplier,
    score,
    timestamp: "t",
  }).state;
}

function throwResult(
  s: MinesweeperEngineState,
  segment: ThrowRecord["segment"],
  multiplier: 1 | 2 | 3,
  score: number,
) {
  const { teamId, playerId } = activeIds(s);
  return applyThrowMinesweeper(s, {
    teamId,
    playerId,
    segment,
    multiplier,
    score,
    timestamp: "t",
  });
}

// ---------------------------------------------------------------------------
// generateRound
// ---------------------------------------------------------------------------

describe("minesweeper – generateMines", () => {
  it("generates the correct number of mines", () => {
    const mines = generateMines(1, 3, 1);
    expect(mines).toHaveLength(3);
  });

  it("mines grow each round", () => {
    const m1 = generateMines(1, 3, 1);
    const m3 = generateMines(3, 3, 1);
    expect(m3.length).toBeGreaterThan(m1.length);
  });

  it("mine count caps at 20", () => {
    const mines = generateMines(100, 3, 5);
    expect(mines).toHaveLength(20);
  });

  it("all mines are valid board numbers", () => {
    for (let round = 1; round <= 10; round++) {
      const mines = generateMines(round, 3, 1);
      for (const m of mines) {
        expect(m).toBeGreaterThanOrEqual(1);
        expect(m).toBeLessThanOrEqual(20);
        expect(BOARD_ORDER).toContain(m);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

describe("minesweeper engine – init", () => {
  it("initializes with correct defaults", () => {
    const s = initMinesweeper(ctx(makeThreeTeams()));
    expect(s.round).toBe(1);
    expect(s.maxLives).toBe(3);
    expect(s.status).toBe("in-progress");
    expect(s.eliminatedTeamIds).toEqual([]);
    expect(s.mines).toHaveLength(3);
    for (const t of s.teams) {
      expect(s.scores[t.id]).toBe(0);
      expect(s.lives[t.id]).toBe(3);
    }
  });

  it("respects custom settings", () => {
    const s = initMinesweeper(
      ctx(makeThreeTeams(), {
        maxLives: 5,
        startingMines: 2,
        mineIncrement: 0,
      }),
    );
    expect(s.maxLives).toBe(5);
    expect(s.mines).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

describe("minesweeper engine – scoring", () => {
  it("scores segment value on a safe single", () => {
    let s = withMines(initMinesweeper(ctx(makeThreeTeams())), [5]);
    s = throwAt(s, 10, 1, 10);
    expect(s.scores["A"]).toBe(10);
  });

  it("scores double value on a safe double", () => {
    let s = withMines(initMinesweeper(ctx(makeThreeTeams())), [5]);
    s = throwAt(s, 10, 2, 20);
    expect(s.scores["A"]).toBe(20);
  });

  it("scores triple value on a safe triple", () => {
    let s = withMines(initMinesweeper(ctx(makeThreeTeams())), [5]);
    s = throwAt(s, 10, 3, 30);
    expect(s.scores["A"]).toBe(30);
  });

  it("accumulates score across multiple throws", () => {
    let s = withMines(initMinesweeper(ctx(makeThreeTeams())), []);
    s = throwAt(s, 10, 1, 10);
    s = throwAt(s, 15, 1, 15);
    s = throwAt(s, 20, 1, 20);
    expect(s.scores["A"]).toBe(45);
  });

  it("bull scores points (always safe)", () => {
    let s = withMines(initMinesweeper(ctx(makeThreeTeams())), [5]);
    s = throwAt(s, "outer-bull", 1, 25);
    expect(s.scores["A"]).toBe(25);
    s = throwAt(s, "inner-bull", 1, 50);
    expect(s.scores["A"]).toBe(75);
  });

  it("miss scores nothing", () => {
    let s = withMines(initMinesweeper(ctx(makeThreeTeams())), [5]);
    s = throwAt(s, "miss", 1, 0);
    expect(s.scores["A"]).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Mines
// ---------------------------------------------------------------------------

describe("minesweeper engine – mine hits", () => {
  it("hitting a mine loses a life", () => {
    let s = withMines(initMinesweeper(ctx(makeThreeTeams())), [5, 10]);
    s = throwAt(s, 5, 1, 5);
    expect(s.lives["A"]).toBe(2);
  });

  it("mine hit emits bust effect", () => {
    const s = withMines(initMinesweeper(ctx(makeThreeTeams())), [5]);
    const r = throwResult(s, 5, 1, 5);
    expect(r.effects.some((e) => e.kind === "bust")).toBe(true);
  });

  it("mine hit does not add to score", () => {
    let s = withMines(initMinesweeper(ctx(makeThreeTeams())), [5]);
    s = throwAt(s, 5, 1, 5);
    expect(s.scores["A"]).toBe(0);
  });

  it("double on a mine still only loses one life", () => {
    let s = withMines(initMinesweeper(ctx(makeThreeTeams())), [5]);
    s = throwAt(s, 5, 2, 10);
    expect(s.lives["A"]).toBe(2);
  });

  it("hitting a mine ends the turn (bust behavior)", () => {
    let s = withMines(initMinesweeper(ctx(makeThreeTeams())), [5]);
    s = throwAt(s, 5, 1, 5);
    expect(activeIds(s).teamId).toBe("B");
  });
});

// ---------------------------------------------------------------------------
// Elimination
// ---------------------------------------------------------------------------

describe("minesweeper engine – elimination", () => {
  it("player is eliminated when lives reach 0", () => {
    let s = withMines(
      initMinesweeper(ctx(makeThreeTeams(), { maxLives: 1 })),
      [5],
    );
    s = throwAt(s, 5, 1, 5);
    expect(s.eliminatedTeamIds).toContain("A");
  });

  it("eliminated player is skipped in turn order", () => {
    let s = withMines(
      initMinesweeper(ctx(makeThreeTeams(), { maxLives: 1 })),
      [5],
    );
    s = throwAt(s, 5, 1, 5);
    expect(activeIds(s).teamId).toBe("B");

    s = throwAt(s, 10, 1, 10);
    s = throwAt(s, 15, 1, 15);
    s = throwAt(s, 10, 1, 10);

    expect(activeIds(s).teamId).toBe("C");

    s = throwAt(s, 10, 1, 10);
    s = throwAt(s, 15, 1, 15);
    s = throwAt(s, 10, 1, 10);

    expect(activeIds(s).teamId).toBe("B");
  });

  it("last player standing wins", () => {
    const s = withMines(
      initMinesweeper(ctx(makeTwoTeams(), { maxLives: 1 })),
      [5],
    );
    const r = throwResult(s, 5, 1, 5);
    expect(r.state.status).toBe("won");
    expect(r.state.winnerTeamIds).toEqual(["B"]);
    expect(r.effects.some((e) => e.kind === "gameWon")).toBe(true);
  });

  it("when two players are eliminated, last standing wins", () => {
    let s = withMines(
      initMinesweeper(ctx(makeThreeTeams(), { maxLives: 1 })),
      [5, 10],
    );
    s = throwAt(s, 5, 1, 5);
    expect(s.eliminatedTeamIds).toContain("A");
    expect(s.status).toBe("in-progress");

    const r = throwResult(s, 10, 1, 10);
    expect(r.state.status).toBe("won");
    expect(r.state.winnerTeamIds).toEqual(["C"]);
  });
});

// ---------------------------------------------------------------------------
// Round progression
// ---------------------------------------------------------------------------

describe("minesweeper engine – round progression", () => {
  it("advances to round 2 after all players have thrown", () => {
    let s = withMines(initMinesweeper(ctx(makeTwoTeams())), [5]);
    s = throwAt(s, 10, 1, 10);
    s = throwAt(s, 15, 1, 15);
    s = throwAt(s, 10, 1, 10);
    expect(s.round).toBe(1);

    s = throwAt(s, 15, 1, 15);
    s = throwAt(s, 10, 1, 10);
    s = throwAt(s, 15, 1, 15);
    expect(s.round).toBe(2);
  });

  it("new round generates new mines", () => {
    let s = withMines(
      initMinesweeper(ctx(makeTwoTeams(), { startingMines: 2, mineIncrement: 1 })),
      [1, 2],
    );

    for (let i = 0; i < 6; i++) s = throwAt(s, "miss", 1, 0);
    expect(s.round).toBe(2);
    expect(s.mines).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// Board hints
// ---------------------------------------------------------------------------

describe("minesweeper engine – board hints", () => {
  it("colors safe segments green, mines red, bull always safe", () => {
    const s = withMines(initMinesweeper(ctx(makeTwoTeams())), [5, 10]);
    const hints = getBoardHintsMinesweeper(s);

    expect(hints.segmentColors).toHaveLength(2);
    const [safeRule, mineRule] = hints.segmentColors!;
    expect(safeRule!.segments).toHaveLength(18 + 1);
    expect(safeRule!.segments).not.toContain(5);
    expect(safeRule!.segments).not.toContain(10);
    expect(safeRule!.color).toContain("success");
    expect(safeRule!.segments).toContain("bull");
    expect(safeRule!.bullInner).toBe(true);

    expect(mineRule!.segments).toEqual(expect.arrayContaining([5, 10]));
    expect(mineRule!.color).toContain("danger");

    expect(hints.dim).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Turn hint
// ---------------------------------------------------------------------------

describe("minesweeper engine – turn hint", () => {
  it("shows round and safe/mine counts", () => {
    const s = withMines(initMinesweeper(ctx(makeTwoTeams())), [5, 10]);
    const hint = getTurnHintMinesweeper(s, "A");
    expect(hint?.label).toBe("Round 1");
    expect(hint?.value).toContain("19 safe");
    expect(hint?.value).toContain("2 mines");
  });

  it("returns null for eliminated team", () => {
    let s = withMines(
      initMinesweeper(ctx(makeThreeTeams(), { maxLives: 1 })),
      [5],
    );
    s = throwAt(s, 5, 1, 5);
    expect(getTurnHintMinesweeper(s, "A")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Quick inputs
// ---------------------------------------------------------------------------

describe("minesweeper engine – quick inputs", () => {
  it("shows all 20 numbers grouped by safe/mine, plus bull", () => {
    const s = withMines(initMinesweeper(ctx(makeTwoTeams())), [5, 10]);
    const qi = getQuickInputsMinesweeper(s)!;
    const safeGroup = qi.find((g) => g.label === "Safe")!;
    const mineGroup = qi.find((g) => g.label === "Mines")!;

    expect(safeGroup.actions).toHaveLength(18 + 2);
    expect(safeGroup.actions.map((a) => a.segment)).toContain("outer-bull");
    expect(safeGroup.actions.map((a) => a.segment)).toContain("inner-bull");
    expect(mineGroup.actions).toHaveLength(2);
    expect(mineGroup.actions.map((a) => a.segment)).toEqual(
      expect.arrayContaining([5, 10]),
    );
  });

  it("includes miss action", () => {
    const s = withMines(initMinesweeper(ctx(makeTwoTeams())), [5]);
    const qi = getQuickInputsMinesweeper(s)!;
    const allActions = qi.flatMap((g) => g.actions);
    expect(allActions.some((a) => a.segment === "miss")).toBe(true);
  });

  it("returns null when game is won", () => {
    let s = withMines(
      initMinesweeper(ctx(makeTwoTeams(), { maxLives: 1 })),
      [5],
    );
    s = throwAt(s, 5, 1, 5);
    expect(getQuickInputsMinesweeper(s)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Scoreboard
// ---------------------------------------------------------------------------

describe("minesweeper engine – scoreboard", () => {
  it("shows score and lives", () => {
    let s = withMines(initMinesweeper(ctx(makeTwoTeams())), [5]);
    s = throwAt(s, 10, 1, 10);
    const sb = selectScoreboardMinesweeper(s);
    expect(sb.rows[0]!.primary).toContain("10 pts");
    expect(sb.rows[0]!.primary).toContain("lives");
  });

  it("shows OUT for eliminated teams", () => {
    let s = withMines(
      initMinesweeper(ctx(makeTwoTeams(), { maxLives: 1 })),
      [5],
    );
    s = throwAt(s, 5, 1, 5);
    const sb = selectScoreboardMinesweeper(s);
    expect(sb.rows[0]!.primary).toContain("OUT");
  });
});

// ---------------------------------------------------------------------------
// Won state
// ---------------------------------------------------------------------------

describe("minesweeper engine – won state", () => {
  it("no-ops when game is already won", () => {
    let s = withMines(
      initMinesweeper(ctx(makeTwoTeams(), { maxLives: 1 })),
      [5],
    );
    s = throwAt(s, 5, 1, 5);
    const r = throwResult(s, 10, 1, 10);
    expect(r.effects).toEqual([]);
    expect(r.state).toBe(s);
  });
});

// ---------------------------------------------------------------------------
// Full game scenario
// ---------------------------------------------------------------------------

describe("minesweeper engine – full game", () => {
  it("plays a complete 2-player game with mine progression", () => {
    let s = withMines(
      initMinesweeper(ctx(makeTwoTeams(), { maxLives: 2, startingMines: 2, mineIncrement: 1 })),
      [6, 13],
    );

    // Round 1: mines [6,13], everything else scores
    // A: safe 10, safe 15, safe 18 → score = 43
    s = throwAt(s, 10, 1, 10);
    s = throwAt(s, 15, 1, 15);
    s = throwAt(s, 18, 1, 18);
    expect(s.scores["A"]).toBe(43);
    expect(s.lives["A"]).toBe(2);

    // B: mine 6 (bust, loses life, turn ends)
    s = throwAt(s, 6, 1, 6);
    expect(s.lives["B"]).toBe(1);
    expect(activeIds(s).teamId).toBe("A");

    // Round 2: new mines (3 total)
    expect(s.round).toBe(2);
    expect(s.mines).toHaveLength(3);

    // Override mines for predictability
    s = withMines(s, [3, 7, 19]);

    // A: safe 17, mine 3 (bust, loses life, turn ends)
    s = throwAt(s, 17, 1, 17);
    expect(s.scores["A"]).toBe(60);
    s = throwAt(s, 3, 1, 3);
    expect(s.lives["A"]).toBe(1);

    // B: mine 7 (bust, eliminated → A wins)
    const r = throwResult(s, 7, 1, 7);
    expect(r.state.status).toBe("won");
    expect(r.state.winnerTeamIds).toEqual(["A"]);
  });
});
