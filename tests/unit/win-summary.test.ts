import { describe, expect, it } from "vitest";
import {
  computeWinSummary,
  isWinSummary,
} from "@/shell/stats/computeWinSummary";
import type { Team, ThrowRecord } from "@/shared/types/core";
import type { X01EngineState } from "@/games/x01/engine";
import type { ATCEngineState } from "@/games/around-the-clock/engine";

const TEAMS: Team[] = [
  { id: "t1", displayName: "Red", colorId: "red", players: [{ id: "p1", displayName: "Alice" }] },
  { id: "t2", displayName: "Blue", colorId: "blue" as any, players: [{ id: "p2", displayName: "Bob" }] },
];

function mkThrow(overrides: Partial<ThrowRecord> & { playerId: string; teamId: string }): ThrowRecord {
  return {
    segment: 20,
    multiplier: 1,
    score: 20,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

describe("computeWinSummary", () => {
  it("computes player stats from throws", () => {
    const throws: ThrowRecord[] = [
      mkThrow({ playerId: "p1", teamId: "t1", segment: 20, score: 20 }),
      mkThrow({ playerId: "p1", teamId: "t1", segment: "miss", score: 0 }),
      mkThrow({ playerId: "p1", teamId: "t1", segment: 19, score: 19 }),
      mkThrow({ playerId: "p2", teamId: "t2", segment: "miss", score: 0 }),
      mkThrow({ playerId: "p2", teamId: "t2", segment: "miss", score: 0 }),
      mkThrow({ playerId: "p2", teamId: "t2", segment: 1, score: 1 }),
    ];

    const fakeState: Partial<ATCEngineState> = {
      progressByTeam: { t1: 21, t2: 5 },
    };

    const result = computeWinSummary("around-the-clock", TEAMS, ["t1"], throws, fakeState);

    expect(result._type).toBe("win-summary");
    expect(result.totalDarts).toBe(6);

    const p1 = result.playerStats.find((p) => p.playerId === "p1")!;
    expect(p1.dartsThrown).toBe(3);
    expect(p1.dartsHit).toBe(2);

    const p2 = result.playerStats.find((p) => p.playerId === "p2")!;
    expect(p2.dartsThrown).toBe(3);
    expect(p2.dartsHit).toBe(1);
  });

  it("ranks X01 teams by remaining score", () => {
    const throws: ThrowRecord[] = [
      mkThrow({ playerId: "p1", teamId: "t1" }),
      mkThrow({ playerId: "p2", teamId: "t2" }),
    ];

    const state: Partial<X01EngineState> = {
      startingScore: 501,
      scoreByTeam: { t1: 0, t2: 200 },
    };

    const result = computeWinSummary("x01", TEAMS, ["t1"], throws, state);

    expect(result.rankings[0]!.teamId).toBe("t1");
    expect(result.rankings[0]!.rank).toBe(1);
    expect(result.rankings[1]!.teamId).toBe("t2");
    expect(result.rankings[1]!.rank).toBe(2);
    expect(result.rankings[1]!.label).toContain("200 left");
  });

  it("ranks Around the Clock by progress", () => {
    const state: Partial<ATCEngineState> = {
      progressByTeam: { t1: 21, t2: 12 },
    };

    const result = computeWinSummary("around-the-clock", TEAMS, ["t1"], [], state);

    expect(result.rankings[0]!.teamId).toBe("t1");
    expect(result.rankings[0]!.label).toBe("Completed");
    expect(result.rankings[1]!.label).toBe("Reached 12/21");
  });

  it("isWinSummary type guard works", () => {
    expect(isWinSummary(null)).toBe(false);
    expect(isWinSummary({})).toBe(false);
    expect(isWinSummary({ _type: "other" })).toBe(false);
    expect(isWinSummary({ _type: "win-summary" })).toBe(true);
  });

  it("falls back gracefully for unknown game types", () => {
    const result = computeWinSummary("unknown-game", TEAMS, ["t1"], [], {});
    expect(result.rankings).toHaveLength(2);
    expect(result.rankings[0]!.teamId).toBe("t1");
    expect(result.rankings[0]!.rank).toBe(1);
  });
});
