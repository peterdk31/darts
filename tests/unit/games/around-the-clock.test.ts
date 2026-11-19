import { describe, it, expect } from "vitest";
import {
  applyThrowATC,
  getBoardHintsATC,
  getTurnHintATC,
  initATC,
  type ATCEngineState,
} from "@/games/around-the-clock/engine";
import type { Team, ThrowRecord } from "@/shared/types/core";
import { gameRandom } from "@/shared/random";
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
    random: gameRandom("test", "init"),
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
  it("progresses by multiplier when hitting current target; misses do nothing", () => {
    let s = initATC(ctx(makeTwoTeams()));
    s = throwAtCurrent(s, 1, 1, 1); // S1 → 1
    expect(s.progressByTeam["A"]).toBe(1);
    s = throwAtCurrent(s, 2, 3, 6); // T2 advances 3 steps → 4
    expect(s.progressByTeam["A"]).toBe(4);
    s = throwAtCurrent(s, 8, 1, 8); // wrong target (current is 5) → no change
    expect(s.progressByTeam["A"]).toBe(4);
  });

  it("double advances 2 steps", () => {
    let s = initATC(ctx(makeOneTeam()));
    s = throwAtCurrent(s, 1, 2, 2); // D1 advances 2 → 2
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

  it("multiplier on a numeric target cannot skip the bull", () => {
    let s = initATC(ctx(makeOneTeam()));
    // Walk progress to 18 (target = 19) using singles 1..18.
    for (let n = 1; n <= 18; n++) {
      s = throwAtCurrent(s, n, 1, n);
    }
    expect(s.progressByTeam["A"]).toBe(18);
    // T19 would naively advance by 3 (→ 21 = won), but must cap at 20.
    s = throwAtCurrent(s, 19, 3, 57);
    expect(s.progressByTeam["A"]).toBe(20);
    expect(s.status).toBe("in-progress");

    // T20 while already at 20 also must not win — bull is still required.
    s = throwAtCurrent(s, 20, 3, 60);
    expect(s.progressByTeam["A"]).toBe(20);
    expect(s.status).toBe("in-progress");

    // A bull hit now wins.
    const { teamId, playerId } = activeIds(s);
    const r = applyThrowATC(s, {
      teamId,
      playerId,
      segment: "outer-bull",
      multiplier: 1,
      score: 25,
      timestamp: "t",
    });
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

  describe("reverse order", () => {
    function reverseCtx(teams: Team[]): InitContext {
      return { ...ctx(teams), resolvedSettings: { reverse: true } };
    }

    it("starts at 20 and counts down", () => {
      let s = initATC(reverseCtx(makeOneTeam()));
      expect(getTurnHintATC(s, "A")).toEqual({ label: "Aim for", value: "20" });
      expect(getBoardHintsATC(s).highlights?.[0]?.segments).toEqual([20]);
      s = throwAtCurrent(s, 1, 1, 1); // 1 is not the target in reverse
      expect(s.progressByTeam["A"]).toBe(0);
      s = throwAtCurrent(s, 20, 1, 20);
      expect(s.progressByTeam["A"]).toBe(1);
      s = throwAtCurrent(s, 19, 3, 57); // T19 → skips 18, 17
      expect(s.progressByTeam["A"]).toBe(4);
      expect(getTurnHintATC(s, "A")!.value).toBe("16");
    });

    it("bull is still the final target after 1", () => {
      let s = initATC(reverseCtx(makeOneTeam()));
      for (let n = 20; n >= 1; n--) s = throwAtCurrent(s, n, 1, n);
      expect(s.progressByTeam["A"]).toBe(20);
      expect(getTurnHintATC(s, "A")!.value).toBe("Bull");
      s = throwAtCurrent(s, "outer-bull", 1, 25);
      expect(s.status).toBe("won");
    });

    it("multiplier cannot skip the bull", () => {
      let s = initATC(reverseCtx(makeOneTeam()));
      for (let n = 20; n >= 3; n--) s = throwAtCurrent(s, n, 1, n);
      s = throwAtCurrent(s, 2, 3, 6);
      expect(s.progressByTeam["A"]).toBe(20);
      expect(s.status).toBe("in-progress");
    });
  });
});
