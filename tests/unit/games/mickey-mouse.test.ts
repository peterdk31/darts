import { describe, it, expect } from "vitest";
import {
  applyThrowMickey,
  getCandidatesForThrow,
  initMickey,
  selectScoreboardMickey,
  MICKEY_TARGETS_15,
  type MickeyEngineState,
} from "@/games/mickey-mouse/engine";
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

function ctx(
  teams: Team[],
  overrides: Record<string, boolean | number | string> = {},
): InitContext {
  return {
    teams,
    resolvedSettings: {
      startingNumber: "15",
      multipliersScore: true,
      dtRequireTargetRange: false,
      ...overrides,
    },
    helpers: { teamAllotment: () => 3, allotmentForPlayer: () => 3 },
  };
}

function activeIds(s: MickeyEngineState): { teamId: string; playerId: string } {
  const teamId = s.turnOrder[s.pointer.teamIdx]!;
  const team = s.teams.find((t) => t.id === teamId)!;
  const playerId = team.players[s.pointer.playerIdxInTeam]!.id;
  return { teamId, playerId };
}

function throwAt(
  s: MickeyEngineState,
  segment: ThrowRecord["segment"],
  multiplier: 1 | 2 | 3,
  score: number,
  intent?: string,
): MickeyEngineState {
  const { teamId, playerId } = activeIds(s);
  return applyThrowMickey(s, {
    teamId,
    playerId,
    segment,
    multiplier,
    score,
    timestamp: "t",
    intent,
  }).state;
}

function throwResult(
  s: MickeyEngineState,
  segment: ThrowRecord["segment"],
  multiplier: 1 | 2 | 3,
  score: number,
  intent?: string,
) {
  const { teamId, playerId } = activeIds(s);
  return applyThrowMickey(s, {
    teamId,
    playerId,
    segment,
    multiplier,
    score,
    timestamp: "t",
    intent,
  });
}

function candidates(
  s: MickeyEngineState,
  segment: ThrowRecord["segment"],
  multiplier: 1 | 2 | 3,
  score: number,
) {
  const { teamId, playerId } = activeIds(s);
  return getCandidatesForThrow(s, {
    teamId,
    playerId,
    segment,
    multiplier,
    score,
    timestamp: "t",
  });
}

function miss(s: MickeyEngineState): MickeyEngineState {
  return throwAt(s, "miss", 1, 0);
}

function consumeTurn(s: MickeyEngineState): MickeyEngineState {
  return miss(miss(miss(s)));
}

describe("mickey mouse engine", () => {
  it("initialises with 9 targets at default (starting=15)", () => {
    const s = initMickey(ctx(makeTeams()));
    expect(s.targets).toHaveLength(9);
    expect(s.targets).toEqual(MICKEY_TARGETS_15);
    expect(s.startingNumber).toBe(15);
    expect(s.multipliersScore).toBe(true);
    expect(s.dtRequireTargetRange).toBe(false);
  });

  it("initialises with 12 targets when starting=12", () => {
    const s = initMickey(ctx(makeTeams(), { startingNumber: "12" }));
    expect(s.targets).toHaveLength(12);
    expect(s.startingNumber).toBe(12);
  });

  it("single 18 → 1 mark on 18, no chooser", () => {
    const s = initMickey(ctx(makeTeams()));
    const c = candidates(s, 18, 1, 18);
    expect(c).toHaveLength(1);
    expect(c[0]!.intent).toBe("number");

    const s2 = throwAt(s, 18, 1, 18);
    expect(s2.marksByTeam["A"]!["18"]).toBe(1);
  });

  it("T18 with intent=number → 3 marks on 18", () => {
    const s = initMickey(ctx(makeTeams()));
    const c = candidates(s, 18, 3, 54);
    expect(c).toHaveLength(2);
    expect(c.map((x) => x.intent).sort()).toEqual(["number", "triple"]);

    const s2 = throwAt(s, 18, 3, 54, "number");
    expect(s2.marksByTeam["A"]!["18"]).toBe(3);
    expect(s2.marksByTeam["A"]!["triple"]).toBe(0);
  });

  it("T18 with intent=triple → 1 mark on Triple", () => {
    const s = initMickey(ctx(makeTeams()));
    const s2 = throwAt(s, 18, 3, 54, "triple");
    expect(s2.marksByTeam["A"]!["18"]).toBe(0);
    expect(s2.marksByTeam["A"]!["triple"]).toBe(1);
  });

  it("D14 with dtRequireTargetRange=true → 0 marks", () => {
    const s = initMickey(ctx(makeTeams(), { dtRequireTargetRange: true }));
    const c = candidates(s, 14, 2, 28);
    expect(c).toHaveLength(0);

    const s2 = throwAt(s, 14, 2, 28);
    expect(s2.marksByTeam["A"]!["double"]).toBe(0);
  });

  it("D14 with dtRequireTargetRange=false → 1 mark on Double (14 not in range)", () => {
    const s = initMickey(ctx(makeTeams()));
    const c = candidates(s, 14, 2, 28);
    expect(c).toHaveLength(1);
    expect(c[0]!.intent).toBe("double");

    const s2 = throwAt(s, 14, 2, 28);
    expect(s2.marksByTeam["A"]!["double"]).toBe(1);
  });

  it("multiplier OFF makes T18-as-number = 1 mark", () => {
    const s = initMickey(ctx(makeTeams(), { multipliersScore: false }));
    const c = candidates(s, 18, 3, 54);
    expect(c).toHaveLength(2);
    expect(c.find((x) => x.intent === "number")!.label).toBe("18 ×1");

    const s2 = throwAt(s, 18, 3, 54, "number");
    expect(s2.marksByTeam["A"]!["18"]).toBe(1);
  });

  it("inner-bull intent=bull with multiplier ON = 2 bull marks", () => {
    const s = initMickey(ctx(makeTeams()));
    const c = candidates(s, "inner-bull", 2, 50);
    expect(c).toHaveLength(2);
    expect(c.find((x) => x.intent === "bull")!.label).toBe("Bull ×2");
    expect(c.find((x) => x.intent === "double")!.label).toBe("Double ×1");

    const s2 = throwAt(s, "inner-bull", 2, 50, "bull");
    expect(s2.marksByTeam["A"]!["bull"]).toBe(2);
    expect(s2.marksByTeam["A"]!["double"]).toBe(0);
  });

  it("inner-bull with multiplier OFF → Bull ×1", () => {
    const s = initMickey(ctx(makeTeams(), { multipliersScore: false }));
    const c = candidates(s, "inner-bull", 2, 50);
    expect(c.find((x) => x.intent === "bull")!.label).toBe("Bull ×1");

    const s2 = throwAt(s, "inner-bull", 2, 50, "bull");
    expect(s2.marksByTeam["A"]!["bull"]).toBe(1);
  });

  it("closing the last target sets status=won and ends the turn mid-throw", () => {
    let s = initMickey(ctx(makeTeams()));

    // Close all targets for team A
    for (const tg of MICKEY_TARGETS_15) {
      if (typeof tg === "number") {
        // T + number with intent=number → 3 marks, closes it
        s = throwAt(s, tg, 3, tg * 3, "number");
        // consume remaining darts with misses
        s = miss(s);
        s = miss(s);
        // B's turn
        s = consumeTurn(s);
      }
    }
    // Close "double" with 3 singles via D14 (non-target number → 1 mark on double each)
    s = throwAt(s, 14, 2, 28); // auto-applies to double (only candidate)
    s = throwAt(s, 14, 2, 28);
    s = throwAt(s, 14, 2, 28);
    s = consumeTurn(s); // B's turn

    // Close "triple" with T14 → only candidate is triple
    s = throwAt(s, 14, 3, 42);
    s = throwAt(s, 14, 3, 42);
    s = throwAt(s, 14, 3, 42);
    s = consumeTurn(s); // B's turn

    // Close "bull" — need 3 marks. outer-bull gives 1 each
    s = throwAt(s, "outer-bull", 1, 25);
    s = throwAt(s, "outer-bull", 1, 25);
    // This should be the closing throw
    const r = throwResult(s, "outer-bull", 1, 25);
    expect(r.state.status).toBe("won");
    expect(r.state.winnerTeamIds).toEqual(["A"]);
    expect(r.effects.some((e) => e.kind === "gameWon")).toBe(true);
  });

  it("marks clamp at 3 — overflow is discarded", () => {
    let s = initMickey(ctx(makeTeams()));
    s = throwAt(s, 18, 3, 54, "number"); // 3 marks
    s = throwAt(s, 18, 1, 18); // already closed, should be no-op (0 candidates)
    expect(s.marksByTeam["A"]!["18"]).toBe(3);
  });

  it("T20 after 20 is closed → auto-applies to Triple (only candidate)", () => {
    let s = initMickey(ctx(makeTeams()));
    s = throwAt(s, 20, 3, 60, "number"); // close 20
    const c = candidates(s, 20, 3, 60);
    expect(c).toHaveLength(1);
    expect(c[0]!.intent).toBe("triple");
  });

  it("miss → no marks, turn advances normally", () => {
    const s = initMickey(ctx(makeTeams()));
    const c = candidates(s, "miss", 1, 0);
    expect(c).toHaveLength(0);
    const s2 = miss(s);
    expect(s2.marksByTeam["A"]!["15"]).toBe(0);
  });

  it("outer-bull → 1 mark on Bull, no chooser", () => {
    const s = initMickey(ctx(makeTeams()));
    const c = candidates(s, "outer-bull", 1, 25);
    expect(c).toHaveLength(1);
    expect(c[0]!.intent).toBe("bull");

    const s2 = throwAt(s, "outer-bull", 1, 25);
    expect(s2.marksByTeam["A"]!["bull"]).toBe(1);
  });

  it("throws on won game are no-ops", () => {
    let s = initMickey(ctx(makeTeams()));
    s = { ...s, status: "won", winnerTeamIds: ["A"] };
    const r = throwResult(s, 18, 1, 18);
    expect(r.effects).toHaveLength(0);
    expect(r.state).toBe(s);
  });

  it("D16 with intent=number → 2 marks on 16", () => {
    const s = initMickey(ctx(makeTeams()));
    const s2 = throwAt(s, 16, 2, 32, "number");
    expect(s2.marksByTeam["A"]!["16"]).toBe(2);
    expect(s2.marksByTeam["A"]!["double"]).toBe(0);
  });

  it("D16 with intent=double → 1 mark on double", () => {
    const s = initMickey(ctx(makeTeams()));
    const s2 = throwAt(s, 16, 2, 32, "double");
    expect(s2.marksByTeam["A"]!["16"]).toBe(0);
    expect(s2.marksByTeam["A"]!["double"]).toBe(1);
  });

  it("selectScoreboard shows progress", () => {
    let s = initMickey(ctx(makeTeams()));
    const sb1 = selectScoreboardMickey(s);
    expect(sb1.rows[0]!.primary).toBe("0 / 9 closed");

    s = throwAt(s, 20, 3, 60, "number");
    const sb2 = selectScoreboardMickey(s);
    expect(sb2.rows[0]!.primary).toBe("1 / 9 closed");
  });

  it("single on non-target number → 0 candidates", () => {
    const s = initMickey(ctx(makeTeams()));
    const c = candidates(s, 10, 1, 10);
    expect(c).toHaveLength(0);
  });

  it("replay is deterministic", () => {
    function feed() {
      let s = initMickey(ctx(makeTeams()));
      s = throwAt(s, 20, 3, 60, "number");
      s = throwAt(s, 18, 1, 18);
      s = throwAt(s, "inner-bull", 2, 50, "bull");
      return s;
    }
    const a = feed();
    const b = feed();
    expect(a.marksByTeam).toEqual(b.marksByTeam);
    expect(a.pointer).toEqual(b.pointer);
  });
});
