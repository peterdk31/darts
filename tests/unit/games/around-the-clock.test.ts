import { describe, it, expect } from "vitest";
import {
  applyThrowATC,
  initATC,
  type ATCEngineState,
} from "@/games/around-the-clock/engine";
import type { Team, ThrowRecord } from "@/shared/types/core";
import type { InitContext } from "@/shared/types/game-module";

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

function makeOneTeam(): Team[] {
  return [
    {
      id: "A",
      displayName: "A",
      colorId: "red",
      players: [{ id: "A1", displayName: "Alice" }],
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

function activeIds(s: ATCEngineState): { teamId: string; playerId: string } {
  const teamId = s.turnOrder[s.pointer.teamIdx]!;
  const team = s.teams.find((t) => t.id === teamId)!;
  const playerId = team.players[s.pointer.playerIdxInTeam]!.id;
  return { teamId, playerId };
}

function throwAtCurrent(
  s: ATCEngineState,
  segment: ThrowRecord["segment"],
  multiplier: 1 | 2 | 3,
  score: number,
): ATCEngineState {
  const { teamId, playerId } = activeIds(s);
  const t: ThrowRecord = {
    teamId,
    playerId,
    segment,
    multiplier,
    score,
    timestamp: "t",
  };
  return applyThrowATC(s, t).state;
}

describe("around-the-clock engine", () => {
  it("progresses only when hitting the current target; multipliers count as one hit", () => {
    let s = initATC(ctx(makeTwoTeams()));
    s = throwAtCurrent(s, 1, 1, 1);
    expect(s.progressByTeam["A"]).toBe(1);
    s = throwAtCurrent(s, 2, 3, 6); // T2 still counts as one hit for ATC
    expect(s.progressByTeam["A"]).toBe(2);
    s = throwAtCurrent(s, 5, 1, 5); // wrong target
    expect(s.progressByTeam["A"]).toBe(2);
  });

  it("hitting bull after completing 1-20 wins (single team for clarity)", () => {
    let s = initATC(ctx(makeOneTeam()));
    for (let n = 1; n <= 20; n++) {
      s = throwAtCurrent(s, n, 1, n);
    }
    expect(s.progressByTeam["A"]).toBe(20);
    const { teamId, playerId } = activeIds(s);
    const r = applyThrowATC(s, {
      teamId,
      playerId,
      segment: "outer-bull",
      multiplier: 1,
      score: 25,
      timestamp: "t",
    });
    expect(r.effects.some((e) => e.kind === "gameWon")).toBe(true);
    expect(r.state.status).toBe("won");
  });

  it("undo equivalence: replay deterministic", () => {
    const init = initATC(ctx(makeTwoTeams()));
    let a = init;
    a = throwAtCurrent(a, 1, 1, 1);
    a = throwAtCurrent(a, 2, 1, 2);
    a = throwAtCurrent(a, 3, 1, 3);
    let b = init;
    b = throwAtCurrent(b, 1, 1, 1);
    b = throwAtCurrent(b, 2, 1, 2);
    b = throwAtCurrent(b, 3, 1, 3);
    expect(a.progressByTeam).toEqual(b.progressByTeam);
    let shorter = init;
    shorter = throwAtCurrent(shorter, 1, 1, 1);
    shorter = throwAtCurrent(shorter, 2, 1, 2);
    expect(shorter.progressByTeam["A"]).toBe(2);
    expect(a.progressByTeam["A"]).toBe(3);
  });
});
