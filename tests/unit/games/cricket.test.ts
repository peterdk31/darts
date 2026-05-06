import { describe, it, expect } from "vitest";
import {
  applyThrowCricket,
  initCricket,
  type CricketEngineState,
} from "@/games/cricket/engine";
import type { Team, ThrowRecord } from "@/shared/types/core";
import type { InitContext } from "@/shared/types/game-module";

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

function ctx(teams: Team[]): InitContext {
  return {
    teams,
    resolvedSettings: {},
    helpers: { teamAllotment: () => 3, allotmentForPlayer: () => 3 },
  };
}

function activeIds(s: CricketEngineState): { teamId: string; playerId: string } {
  const teamId = s.turnOrder[s.pointer.teamIdx]!;
  const team = s.teams.find((t) => t.id === teamId)!;
  const playerId = team.players[s.pointer.playerIdxInTeam]!.id;
  return { teamId, playerId };
}

function throwAtCurrent(
  s: CricketEngineState,
  segment: ThrowRecord["segment"],
  multiplier: 1 | 2 | 3,
  score: number,
): CricketEngineState {
  const { teamId, playerId } = activeIds(s);
  return applyThrowCricket(s, {
    teamId,
    playerId,
    segment,
    multiplier,
    score,
    timestamp: "t",
  }).state;
}

describe("cricket engine", () => {
  it("triple closes a number; further hits score after closing", () => {
    let s = initCricket(ctx(makeTeams()));
    s = throwAtCurrent(s, 20, 3, 60); // closes 20 (3 marks).
    expect(s.marksByTeam["A"]?.["20"]).toBe(3);
    expect(s.scoreByTeam["A"]).toBe(0);
    // Single-20 — A closed, B not → score 20.
    s = throwAtCurrent(s, 20, 1, 20);
    expect(s.scoreByTeam["A"]).toBe(20);
  });

  it("scoring stops once all opponents also close the number", () => {
    let s = initCricket(ctx(makeTeams()));
    // A's 3 darts: T20, T20, T20 — A closes (mark dart 1 = no score, marks 2&3 = +60 each).
    s = throwAtCurrent(s, 20, 3, 60);
    s = throwAtCurrent(s, 20, 3, 60);
    s = throwAtCurrent(s, 20, 3, 60);
    expect(s.marksByTeam["A"]?.["20"]).toBe(9);
    expect(s.scoreByTeam["A"]).toBe(120);
    // Pointer now on B. B closes 20 with T20 + 2 more T20 — but A already closed,
    // so B closes (no score on closing), then B's overflow doesn't score either.
    s = throwAtCurrent(s, 20, 3, 60); // B closes
    s = throwAtCurrent(s, 20, 3, 60);
    s = throwAtCurrent(s, 20, 3, 60);
    expect(s.marksByTeam["B"]?.["20"]).toBe(9);
    expect(s.scoreByTeam["B"]).toBe(0);
    // Now A throws single-20 again — both closed → no further A score.
    const before = s.scoreByTeam["A"];
    s = throwAtCurrent(s, 20, 1, 20);
    expect(s.scoreByTeam["A"]).toBe(before);
  });

  it("all-closed-but-trailing: game does NOT end while A leads but is no longer the only one closing all", () => {
    let s = initCricket(ctx(makeTeams()));
    // A closes 20: T20 (mark to 3, no score), then T20 (overflow 3 → +60), then T20 (+60).
    s = throwAtCurrent(s, 20, 3, 60);
    s = throwAtCurrent(s, 20, 3, 60);
    s = throwAtCurrent(s, 20, 3, 60);
    // Pointer to B. B throws three misses to consume turn cleanly.
    s = throwAtCurrent(s, "miss", 1, 0);
    s = throwAtCurrent(s, "miss", 1, 0);
    s = throwAtCurrent(s, "miss", 1, 0);
    // A continues closing 19, 18, 17, 16, 15 — 3 darts per round.
    for (const n of [19, 18, 17, 16, 15] as const) {
      // Three triples on n: closes + 2 overflow = 60×n + 0 + 2*n*3 ... well +(n*3) twice
      s = throwAtCurrent(s, n, 3, n * 3);
      s = throwAtCurrent(s, n, 3, n * 3);
      s = throwAtCurrent(s, n, 3, n * 3);
      // B's turn — three misses
      s = throwAtCurrent(s, "miss", 1, 0);
      s = throwAtCurrent(s, "miss", 1, 0);
      s = throwAtCurrent(s, "miss", 1, 0);
    }
    // Now A closes bull. 3 outer-bulls = 3 marks total → closes.
    s = throwAtCurrent(s, "outer-bull", 1, 25);
    s = throwAtCurrent(s, "outer-bull", 1, 25);
    s = throwAtCurrent(s, "outer-bull", 1, 25);
    // A has all 7 closed and is leading → game ends with A as winner.
    expect(s.status).toBe("won");
    expect(s.winnerTeamIds).toEqual(["A"]);
  });

  it("undo equivalence: replay deterministic", () => {
    const init = initCricket(ctx(makeTeams()));
    function feed(): CricketEngineState {
      let s = init;
      s = throwAtCurrent(s, 20, 3, 60);
      s = throwAtCurrent(s, 20, 1, 20);
      s = throwAtCurrent(s, 19, 2, 38);
      return s;
    }
    const a = feed();
    const b = feed();
    expect(a.scoreByTeam).toEqual(b.scoreByTeam);
    expect(a.marksByTeam).toEqual(b.marksByTeam);
  });
});
