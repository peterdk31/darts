import { describe, it, expect } from "vitest";
import {
  applyThrowLumberjack,
  computeRoundPoints,
  getBoardHintsLumberjack,
  initLumberjack,
  LUMBERJACK_ROUNDS,
  selectScoreboardLumberjack,
  type LumberjackEngineState,
} from "@/games/lumberjack/engine";
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
    resolvedSettings: { dtAbove15Only: false, ...overrides },
    helpers: { teamAllotment: () => 3, allotmentForPlayer: () => 3 },
  };
}

function activeIds(s: LumberjackEngineState): {
  teamId: string;
  playerId: string;
} {
  const teamId = s.turnOrder[s.pointer.teamIdx]!;
  const team = s.teams.find((t) => t.id === teamId)!;
  const playerId = team.players[s.pointer.playerIdxInTeam]!.id;
  return { teamId, playerId };
}

function mkThrow(
  state: LumberjackEngineState,
  segment: ThrowRecord["segment"],
  multiplier: 1 | 2 | 3 = 1,
): ThrowRecord {
  const { teamId, playerId } = activeIds(state);
  let score: number;
  if (segment === "miss") score = 0;
  else if (segment === "outer-bull") score = 25;
  else if (segment === "inner-bull") score = 50;
  else score = (segment as number) * multiplier;
  return {
    teamId,
    playerId,
    segment,
    multiplier,
    score,
    timestamp: new Date().toISOString(),
  };
}

function throwN(
  state: LumberjackEngineState,
  darts: Array<[ThrowRecord["segment"], (1 | 2 | 3)?]>,
): LumberjackEngineState {
  let s = state;
  for (const [seg, mult] of darts) {
    const t = mkThrow(s, seg, mult ?? 1);
    const r = applyThrowLumberjack(s, t);
    s = r.state;
  }
  return s;
}

describe("Lumberjack engine", () => {
  describe("init", () => {
    it("initializes with correct defaults", () => {
      const teams = makeTeams();
      const s = initLumberjack(ctx(teams));
      expect(s.currentRound).toBe(0);
      expect(s.scoreByTeam["A"]).toBe(0);
      expect(s.scoreByTeam["B"]).toBe(0);
      expect(s.status).toBe("in-progress");
      expect(s.dtAbove15Only).toBe(false);
      expect(s.turnOrder).toEqual(["A", "B"]);
    });

    it("respects dtAbove15Only setting", () => {
      const s = initLumberjack(ctx(makeTeams(), { dtAbove15Only: true }));
      expect(s.dtAbove15Only).toBe(true);
    });
  });

  describe("computeRoundPoints", () => {
    const miss: ThrowRecord = {
      teamId: "A",
      playerId: "A1",
      segment: "miss",
      multiplier: 1,
      score: 0,
      timestamp: "",
    };

    it("number round: only matching segment scores", () => {
      const round = LUMBERJACK_ROUNDS[0]!; // target 15
      expect(
        computeRoundPoints(
          { ...miss, segment: 15, multiplier: 1, score: 15 },
          round,
          false,
        ),
      ).toEqual({ points: 15, hit: true });
      expect(
        computeRoundPoints(
          { ...miss, segment: 15, multiplier: 3, score: 45 },
          round,
          false,
        ),
      ).toEqual({ points: 45, hit: true });
      expect(
        computeRoundPoints(
          { ...miss, segment: 20, multiplier: 1, score: 20 },
          round,
          false,
        ),
      ).toEqual({ points: 0, hit: false });
    });

    it("double round: any double counts", () => {
      const round = LUMBERJACK_ROUNDS[2]!; // Double
      expect(
        computeRoundPoints(
          { ...miss, segment: 5, multiplier: 2, score: 10 },
          round,
          false,
        ),
      ).toEqual({ points: 10, hit: true });
      expect(
        computeRoundPoints(
          { ...miss, segment: "inner-bull", multiplier: 1, score: 50 },
          round,
          false,
        ),
      ).toEqual({ points: 50, hit: true });
      expect(
        computeRoundPoints(
          { ...miss, segment: 5, multiplier: 1, score: 5 },
          round,
          false,
        ),
      ).toEqual({ points: 0, hit: false });
    });

    it("double round: dtAbove15Only blocks doubles below 15", () => {
      const round = LUMBERJACK_ROUNDS[2]!;
      expect(
        computeRoundPoints(
          { ...miss, segment: 14, multiplier: 2, score: 28 },
          round,
          true,
        ),
      ).toEqual({ points: 0, hit: false });
      expect(
        computeRoundPoints(
          { ...miss, segment: 15, multiplier: 2, score: 30 },
          round,
          true,
        ),
      ).toEqual({ points: 30, hit: true });
      expect(
        computeRoundPoints(
          { ...miss, segment: 16, multiplier: 2, score: 32 },
          round,
          true,
        ),
      ).toEqual({ points: 32, hit: true });
      // inner bull still counts
      expect(
        computeRoundPoints(
          { ...miss, segment: "inner-bull", multiplier: 1, score: 50 },
          round,
          true,
        ),
      ).toEqual({ points: 50, hit: true });
    });

    it("triple round: any triple counts", () => {
      const round = LUMBERJACK_ROUNDS[4]!; // Triple
      expect(
        computeRoundPoints(
          { ...miss, segment: 20, multiplier: 3, score: 60 },
          round,
          false,
        ),
      ).toEqual({ points: 60, hit: true });
      expect(
        computeRoundPoints(
          { ...miss, segment: 20, multiplier: 2, score: 40 },
          round,
          false,
        ),
      ).toEqual({ points: 0, hit: false });
    });

    it("triple round: dtAbove15Only blocks triples below 15", () => {
      const round = LUMBERJACK_ROUNDS[4]!;
      expect(
        computeRoundPoints(
          { ...miss, segment: 14, multiplier: 3, score: 42 },
          round,
          true,
        ),
      ).toEqual({ points: 0, hit: false });
      expect(
        computeRoundPoints(
          { ...miss, segment: 15, multiplier: 3, score: 45 },
          round,
          true,
        ),
      ).toEqual({ points: 45, hit: true });
      expect(
        computeRoundPoints(
          { ...miss, segment: 16, multiplier: 3, score: 48 },
          round,
          true,
        ),
      ).toEqual({ points: 48, hit: true });
    });

    it("exact41: all darts score face value, hit is always false", () => {
      const round = LUMBERJACK_ROUNDS[6]!; // exact41
      expect(
        computeRoundPoints(
          { ...miss, segment: 20, multiplier: 1, score: 20 },
          round,
          false,
        ),
      ).toEqual({ points: 20, hit: false });
      expect(
        computeRoundPoints(
          { ...miss, segment: "outer-bull", multiplier: 1, score: 25 },
          round,
          false,
        ),
      ).toEqual({ points: 25, hit: false });
    });

    it("bull round: only bull hits count", () => {
      const round = LUMBERJACK_ROUNDS[9]!; // Bull
      expect(
        computeRoundPoints(
          { ...miss, segment: "outer-bull", multiplier: 1, score: 25 },
          round,
          false,
        ),
      ).toEqual({ points: 25, hit: true });
      expect(
        computeRoundPoints(
          { ...miss, segment: "inner-bull", multiplier: 1, score: 50 },
          round,
          false,
        ),
      ).toEqual({ points: 50, hit: true });
      expect(
        computeRoundPoints(
          { ...miss, segment: 20, multiplier: 1, score: 20 },
          round,
          false,
        ),
      ).toEqual({ points: 0, hit: false });
    });

    it("miss scores 0 for all round types", () => {
      for (const round of LUMBERJACK_ROUNDS) {
        expect(computeRoundPoints(miss, round, false)).toEqual({
          points: 0,
          hit: false,
        });
      }
    });
  });

  describe("scoring and halving", () => {
    it("scores points when target is hit", () => {
      const teams = makeTeams();
      let s = initLumberjack(ctx(teams));
      // Round 1 (15): Team A hits 15 three times
      s = throwN(s, [
        [15, 1],
        [15, 1],
        [15, 1],
      ]);
      expect(s.scoreByTeam["A"]).toBe(45);
      expect(s.roundHitByTeam["A"]).toBe(true);
    });

    it("halves score when team misses all darts in a round", () => {
      const teams = makeTeams();
      let s = initLumberjack(ctx(teams));
      // Round 1: Team A hits 15 → 45 pts
      s = throwN(s, [
        [15, 1],
        [15, 1],
        [15, 1],
      ]);
      // Round 1: Team B misses everything → halved from 0 → 0
      s = throwN(s, [
        ["miss"],
        ["miss"],
        ["miss"],
      ]);
      expect(s.scoreByTeam["A"]).toBe(45);
      expect(s.scoreByTeam["B"]).toBe(0);
      expect(s.currentRound).toBe(1);

      // Round 2 (16): Team A hits T16 once
      s = throwN(s, [
        [16, 3],
        ["miss"],
        ["miss"],
      ]);
      expect(s.scoreByTeam["A"]).toBe(45 + 48);

      // Round 2: Team B misses all → still 0
      s = throwN(s, [
        ["miss"],
        ["miss"],
        ["miss"],
      ]);
      expect(s.scoreByTeam["B"]).toBe(0);
    });

    it("halves a nonzero accumulated score", () => {
      const teams = makeTeams();
      let s = initLumberjack(ctx(teams));
      // Round 1: both teams score
      s = throwN(s, [[15, 1], [15, 1], [15, 1]]); // A scores 45
      s = throwN(s, [[15, 1], ["miss"], ["miss"]]); // B scores 15

      // Round 2: Team A misses → halved from 45 → 22
      s = throwN(s, [["miss"], ["miss"], ["miss"]]);
      expect(s.scoreByTeam["A"]).toBe(22);

      // Round 2: Team B hits 16 → keeps 15 + 16 = 31
      s = throwN(s, [[16, 1], ["miss"], ["miss"]]);
      expect(s.scoreByTeam["B"]).toBe(31);
    });

    it("emits bust effect with HALVED label on halving", () => {
      const teams = makeTeams();
      let s = initLumberjack(ctx(teams));
      // Give Team A some points
      s = throwN(s, [[15, 1], [15, 1], [15, 1]]); // 45 pts
      s = throwN(s, [["miss"], ["miss"], ["miss"]]); // B misses round 1

      // Round 2: Team A misses all 3
      const t1 = mkThrow(s, "miss");
      s = applyThrowLumberjack(s, t1).state;
      const t2 = mkThrow(s, "miss");
      s = applyThrowLumberjack(s, t2).state;
      const t3 = mkThrow(s, "miss");
      const r = applyThrowLumberjack(s, t3);

      const bust = r.effects.find((e) => e.kind === "bust");
      expect(bust).toBeDefined();
      expect(bust!.label).toBe("HALVED");
      expect(bust!.detail).toContain("22");
    });
  });

  describe("round 7 (exact 41) — per-chance", () => {
    function skipToRound(roundIdx: number, state: LumberjackEngineState): LumberjackEngineState {
      let s = state;
      while (s.currentRound < roundIdx) {
        for (let t = 0; t < s.turnOrder.length; t++) {
          s = throwN(s, [["miss"], ["miss"], ["miss"]]);
        }
      }
      return s;
    }

    it("scores 41 when a 3-dart chance totals exactly 41", () => {
      const teams = makeTeams();
      let s = initLumberjack(ctx(teams));
      s = skipToRound(6, s);
      expect(LUMBERJACK_ROUNDS[6]!.type).toBe("exact41");

      // Team A (1 player, maxTeamSize=1 → 1 chance of 3 darts): 20+20+1=41
      s = throwN(s, [[20, 1], [20, 1], [1, 1]]);
      expect(s.scoreByTeam["A"]).toBe(41);
    });

    it("halves when no chance hits 41", () => {
      const teams = makeTeams();
      let s = initLumberjack(ctx(teams));
      s = throwN(s, [[15, 1], [15, 1], [15, 1]]); // A: 45
      s = throwN(s, [["miss"], ["miss"], ["miss"]]); // B: 0
      while (s.currentRound < 6) {
        s = throwN(s, [["miss"], ["miss"], ["miss"]]);
        s = throwN(s, [["miss"], ["miss"], ["miss"]]);
      }
      const scoreBefore = s.scoreByTeam["A"]!;

      // 20+20+20 = 60 ≠ 41
      s = throwN(s, [[20, 1], [20, 1], [20, 1]]);
      expect(s.scoreByTeam["A"]).toBe(Math.floor(scoreBefore / 2));
    });

    it("scored effect delta is 0 mid-chance, 41 on the 3rd dart of a hit", () => {
      const teams = makeTeams();
      let s = initLumberjack(ctx(teams));
      s = skipToRound(6, s);

      const t1 = mkThrow(s, 20);
      const r1 = applyThrowLumberjack(s, t1);
      expect((r1.effects[0] as { delta: number }).delta).toBe(0);
      s = r1.state;

      const t2 = mkThrow(s, 20);
      const r2 = applyThrowLumberjack(s, t2);
      expect((r2.effects[0] as { delta: number }).delta).toBe(0);
      s = r2.state;

      const t3 = mkThrow(s, 1); // 20+20+1=41
      const r3 = applyThrowLumberjack(s, t3);
      expect((r3.effects[0] as { delta: number }).delta).toBe(41);
    });

    it("gives each player on a team their own chance", () => {
      const teams: Team[] = [
        {
          id: "A",
          displayName: "Alpha",
          colorId: "red",
          players: [
            { id: "A1", displayName: "Alice" },
            { id: "A2", displayName: "Adam" },
          ],
        },
        {
          id: "B",
          displayName: "Bravo",
          colorId: "green",
          players: [{ id: "B1", displayName: "Bob" }],
        },
      ];
      let s = initLumberjack(ctx(teams));
      s = skipToRound(6, s);

      // Team A: player 1 hits 41, player 2 misses
      // maxTeamSize=2 → 6 darts per team, 2 chances of 3 each
      // Player 1 (3 darts): 20+20+1=41 → +41
      s = throwN(s, [[20, 1], [20, 1], [1, 1]]);
      expect(s.scoreByTeam["A"]).toBe(41);
      expect(s.r41HitCount["A"]).toBe(1);

      // Player 2 (3 darts): 10+10+10=30 → miss chance
      s = throwN(s, [[10, 1], [10, 1], [10, 1]]);
      // Team A turn done: 1 hit → no halving, scored 41
      expect(s.scoreByTeam["A"]).toBe(41);
      expect(s.roundLog["A"]![6]).toEqual({ scored: 41, halved: false });
    });

    it("both players can hit 41 → team scores 82", () => {
      const teams: Team[] = [
        {
          id: "A",
          displayName: "Alpha",
          colorId: "red",
          players: [
            { id: "A1", displayName: "Alice" },
            { id: "A2", displayName: "Adam" },
          ],
        },
        {
          id: "B",
          displayName: "Bravo",
          colorId: "green",
          players: [{ id: "B1", displayName: "Bob" }],
        },
      ];
      let s = initLumberjack(ctx(teams));
      s = skipToRound(6, s);

      // Player 1: 20+20+1=41
      s = throwN(s, [[20, 1], [20, 1], [1, 1]]);
      // Player 2: 19+20+2=41
      s = throwN(s, [[19, 1], [20, 1], [2, 1]]);

      expect(s.scoreByTeam["A"]).toBe(82);
      expect(s.roundLog["A"]![6]).toEqual({ scored: 82, halved: false });
    });

    it("solo player on smaller team gets extra chances matching maxTeamSize", () => {
      const teams: Team[] = [
        {
          id: "A",
          displayName: "Alpha",
          colorId: "red",
          players: [
            { id: "A1", displayName: "Alice" },
            { id: "A2", displayName: "Adam" },
          ],
        },
        {
          id: "B",
          displayName: "Bravo",
          colorId: "green",
          players: [{ id: "B1", displayName: "Bob" }],
        },
      ];
      let s = initLumberjack(ctx(teams));
      s = skipToRound(6, s);

      // Skip Team A's turn (6 darts, non-busting)
      s = throwN(s, [[1, 1], [1, 1], [1, 1], [1, 1], [1, 1], [1, 1]]);

      // Team B: solo player gets 6 darts (2 chances of 3)
      // Chance 1: miss (10+10+10=30)
      s = throwN(s, [[10, 1], [10, 1], [10, 1]]);
      expect(s.r41HitCount["B"]).toBe(0);

      // Chance 2: hit! (20+20+1=41)
      s = throwN(s, [[20, 1], [20, 1], [1, 1]]);

      // Team B scored 41 with the second chance → no halving
      expect(s.scoreByTeam["B"]).toBe(41);
      expect(s.roundLog["B"]![6]).toEqual({ scored: 41, halved: false });
    });

    it("busts immediately when first dart exceeds 41 (T20 = 60)", () => {
      const teams = makeTeams();
      let s = initLumberjack(ctx(teams));
      s = skipToRound(6, s);

      const t1 = mkThrow(s, 20, 3); // T20 = 60
      const r1 = applyThrowLumberjack(s, t1);
      const bust = r1.effects.find((e) => e.kind === "bust");
      expect(bust).toBeDefined();
      expect(bust!.label).toBe("BUST");
      expect(bust!.detail).toContain("over 41");
      // Skipped remaining 2 darts → team turn over (1-player, allotment=3)
      expect(r1.state.pointer.teamIdx).toBe(1);
    });

    it("busts on a miss in exact41 (all darts must score)", () => {
      const teams = makeTeams();
      let s = initLumberjack(ctx(teams));
      s = skipToRound(6, s);

      const t1 = mkThrow(s, "miss");
      const r1 = applyThrowLumberjack(s, t1);
      const bust = r1.effects.find((e) => e.kind === "bust");
      expect(bust).toBeDefined();
      expect(bust!.detail).toContain("miss");
      expect(r1.state.pointer.teamIdx).toBe(1);
    });

    it("busts when dart 2 pushes total past recoverability", () => {
      const teams = makeTeams();
      let s = initLumberjack(ctx(teams));
      s = skipToRound(6, s);

      // Dart 1: S20 → total 20, under limit (39). No bust.
      s = throwN(s, [[20, 1]]);
      expect(s.pointer.teamIdx).toBe(0); // still Team A

      // Dart 2: D20 = 40 → total 60 > 40 threshold. Bust.
      const t2 = mkThrow(s, 20, 2);
      const r2 = applyThrowLumberjack(s, t2);
      expect(r2.effects.find((e) => e.kind === "bust")).toBeDefined();
      expect(r2.state.pointer.teamIdx).toBe(1);
    });

    it("D20 (40) busts on dart 1 — remaining 2 darts can't sum to 1", () => {
      const teams = makeTeams();
      let s = initLumberjack(ctx(teams));
      s = skipToRound(6, s);

      const t1 = mkThrow(s, 20, 2); // D20 = 40, total > 39 threshold
      const r1 = applyThrowLumberjack(s, t1);
      expect(r1.effects.find((e) => e.kind === "bust")).toBeDefined();
      expect(r1.state.pointer.teamIdx).toBe(1);
    });

    it("bust on first chance still allows second chance", () => {
      const teams: Team[] = [
        {
          id: "A",
          displayName: "Alpha",
          colorId: "red",
          players: [
            { id: "A1", displayName: "Alice" },
            { id: "A2", displayName: "Adam" },
          ],
        },
        {
          id: "B",
          displayName: "Bravo",
          colorId: "green",
          players: [{ id: "B1", displayName: "Bob" }],
        },
      ];
      let s = initLumberjack(ctx(teams));
      s = skipToRound(6, s);

      // Skip Team A (non-busting)
      s = throwN(s, [[1, 1], [1, 1], [1, 1], [1, 1], [1, 1], [1, 1]]);

      // Team B chance 1: T20 → bust (skip 2 darts → chance 2 starts)
      s = throwN(s, [[20, 3]]);

      // Team B chance 2: 20+20+1 = 41 → hit!
      s = throwN(s, [[20, 1], [20, 1], [1, 1]]);

      expect(s.scoreByTeam["B"]).toBe(41);
      expect(s.roundLog["B"]![6]).toEqual({ scored: 41, halved: false });
    });
  });

  describe("round advancement", () => {
    it("advances round after all teams play", () => {
      const teams = makeTeams();
      let s = initLumberjack(ctx(teams));
      expect(s.currentRound).toBe(0);

      // Team A: 3 darts
      s = throwN(s, [[15, 1], ["miss"], ["miss"]]);
      expect(s.currentRound).toBe(0); // Not yet advanced

      // Team B: 3 darts → round complete
      s = throwN(s, [["miss"], ["miss"], ["miss"]]);
      expect(s.currentRound).toBe(1);
    });

    it("tracks round log correctly", () => {
      const teams = makeTeams();
      let s = initLumberjack(ctx(teams));

      // Round 1: A scores 30, B scores 0 (halved)
      s = throwN(s, [[15, 2], ["miss"], ["miss"]]); // A: D15 = 30
      s = throwN(s, [["miss"], ["miss"], ["miss"]]); // B: all miss

      expect(s.roundLog["A"]).toEqual([{ scored: 30, halved: false }]);
      expect(s.roundLog["B"]).toEqual([{ scored: 0, halved: true }]);
    });
  });

  describe("game completion", () => {
    function playFullGame(hitEverything: boolean): LumberjackEngineState {
      const teams = makeTeams();
      let s = initLumberjack(ctx(teams));

      for (let round = 0; round < 10; round++) {
        const r = LUMBERJACK_ROUNDS[round]!;
        for (let team = 0; team < 2; team++) {
          if (hitEverything) {
            switch (r.type) {
              case "number":
                s = throwN(s, [[r.target!, 1], ["miss"], ["miss"]]);
                break;
              case "double":
                s = throwN(s, [[20, 2], ["miss"], ["miss"]]);
                break;
              case "triple":
                s = throwN(s, [[20, 3], ["miss"], ["miss"]]);
                break;
              case "exact41":
                s = throwN(s, [[20, 1], [20, 1], [1, 1]]);
                break;
              case "bull":
                s = throwN(s, [["outer-bull"], ["miss"], ["miss"]]);
                break;
            }
          } else if (r.type === "exact41") {
            s = throwN(s, [[1, 1], [1, 1], [1, 1]]);
          } else {
            s = throwN(s, [["miss"], ["miss"], ["miss"]]);
          }
        }
      }
      return s;
    }

    it("ends after 10 rounds", () => {
      const s = playFullGame(false);
      expect(s.status).toBe("won");
      expect(s.currentRound).toBe(10);
    });

    it("determines winner by highest score", () => {
      const teams = makeTeams();
      let s = initLumberjack(ctx(teams));

      // Play all rounds: A always hits the target, B always misses
      for (let round = 0; round < 10; round++) {
        const r = LUMBERJACK_ROUNDS[round]!;
        // Team A hits
        switch (r.type) {
          case "number":
            s = throwN(s, [[r.target!, 1], ["miss"], ["miss"]]);
            break;
          case "double":
            s = throwN(s, [[20, 2], ["miss"], ["miss"]]);
            break;
          case "triple":
            s = throwN(s, [[20, 3], ["miss"], ["miss"]]);
            break;
          case "exact41":
            s = throwN(s, [[20, 1], [20, 1], [1, 1]]);
            break;
          case "bull":
            s = throwN(s, [["outer-bull"], ["miss"], ["miss"]]);
            break;
        }
        // Team B misses (use non-zero darts in exact41 to avoid bust-skip)
        if (r.type === "exact41") {
          s = throwN(s, [[1, 1], [1, 1], [1, 1]]);
        } else {
          s = throwN(s, [["miss"], ["miss"], ["miss"]]);
        }
      }

      expect(s.status).toBe("won");
      expect(s.scoreByTeam["A"]!).toBeGreaterThan(0);
      expect(s.scoreByTeam["B"]).toBe(0);
      expect(s.winnerTeamIds).toEqual(["A"]);
    });

    it("handles ties", () => {
      const s = playFullGame(true);
      // Both teams hit the same things → tied
      expect(s.winnerTeamIds).toEqual(["A", "B"]);
    });

    it("emits gameWon effect on completion", () => {
      const teams = makeTeams();
      let s = initLumberjack(ctx(teams));

      // Play through 9.5 rounds (all misses), leaving just Team B's last round
      for (let round = 0; round < 9; round++) {
        if (LUMBERJACK_ROUNDS[round]!.type === "exact41") {
          s = throwN(s, [[1, 1], [1, 1], [1, 1]]); // A
          s = throwN(s, [[1, 1], [1, 1], [1, 1]]); // B
        } else {
          s = throwN(s, [["miss"], ["miss"], ["miss"]]); // A
          s = throwN(s, [["miss"], ["miss"], ["miss"]]); // B
        }
      }
      // Round 10: Team A plays
      s = throwN(s, [["miss"], ["miss"], ["miss"]]);

      // Team B's last dart of round 10
      const t1 = mkThrow(s, "miss");
      s = applyThrowLumberjack(s, t1).state;
      const t2 = mkThrow(s, "miss");
      s = applyThrowLumberjack(s, t2).state;
      const t3 = mkThrow(s, "miss");
      const r = applyThrowLumberjack(s, t3);

      expect(r.effects.some((e) => e.kind === "gameWon")).toBe(true);
      expect(r.state.status).toBe("won");
    });
  });

  describe("board hints", () => {
    it("highlights number target for number rounds", () => {
      const s = initLumberjack(ctx(makeTeams()));
      expect(s.currentRound).toBe(0);
      expect(getBoardHintsLumberjack(s)).toEqual({ highlights: [{ segments: [15] }] });
    });

    it("highlights bull for bull round", () => {
      const teams = makeTeams();
      let s = initLumberjack(ctx(teams));
      // Skip to round 10 (bull)
      for (let i = 0; i < 9; i++) {
        if (LUMBERJACK_ROUNDS[i]!.type === "exact41") {
          s = throwN(s, [[1, 1], [1, 1], [1, 1]]);
          s = throwN(s, [[1, 1], [1, 1], [1, 1]]);
        } else {
          s = throwN(s, [["miss"], ["miss"], ["miss"]]);
          s = throwN(s, [["miss"], ["miss"], ["miss"]]);
        }
      }
      expect(s.currentRound).toBe(9);
      expect(getBoardHintsLumberjack(s)).toEqual({ highlights: [{ segments: ["bull"] }] });
    });

    it("highlights all doubles + inner bull for the double round", () => {
      const teams = makeTeams();
      let s = initLumberjack(ctx(teams));
      // Skip to round 2 (double)
      s = throwN(s, [["miss"], ["miss"], ["miss"]]);
      s = throwN(s, [["miss"], ["miss"], ["miss"]]);
      s = throwN(s, [["miss"], ["miss"], ["miss"]]);
      s = throwN(s, [["miss"], ["miss"], ["miss"]]);
      expect(s.currentRound).toBe(2);
      const hints = getBoardHintsLumberjack(s);
      const rule = hints.highlights?.[0];
      expect(rule?.segments).toEqual([1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20]);
      expect(rule?.rings).toEqual(["double"]);
      expect(rule?.bullInner).toBe(true);
    });

    it("highlights only 15+ doubles when dtAbove15Only is on", () => {
      const teams = makeTeams();
      let s = initLumberjack(ctx(teams, { dtAbove15Only: true }));
      // Skip to round 2 (double)
      s = throwN(s, [["miss"], ["miss"], ["miss"]]);
      s = throwN(s, [["miss"], ["miss"], ["miss"]]);
      s = throwN(s, [["miss"], ["miss"], ["miss"]]);
      s = throwN(s, [["miss"], ["miss"], ["miss"]]);
      expect(s.currentRound).toBe(2);
      const hints = getBoardHintsLumberjack(s);
      const rule = hints.highlights?.[0];
      expect(rule?.segments).toEqual([15, 16, 17, 18, 19, 20]);
      expect(rule?.rings).toEqual(["double"]);
      expect(rule?.bullInner).toBe(true);
    });

    it("highlights all triples for the triple round", () => {
      const teams = makeTeams();
      let s = initLumberjack(ctx(teams));
      // Skip to round 4 (triple)
      for (let i = 0; i < 8; i++) s = throwN(s, [["miss"], ["miss"], ["miss"]]);
      expect(s.currentRound).toBe(4);
      const hints = getBoardHintsLumberjack(s);
      const rule = hints.highlights?.[0];
      expect(rule?.segments).toEqual([1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20]);
      expect(rule?.rings).toEqual(["triple"]);
      expect(rule?.bullInner).toBeUndefined();
    });

    it("highlights only 15+ triples when dtAbove15Only is on", () => {
      const teams = makeTeams();
      let s = initLumberjack(ctx(teams, { dtAbove15Only: true }));
      // Skip to round 4 (triple)
      for (let i = 0; i < 8; i++) s = throwN(s, [["miss"], ["miss"], ["miss"]]);
      expect(s.currentRound).toBe(4);
      const hints = getBoardHintsLumberjack(s);
      const rule = hints.highlights?.[0];
      expect(rule?.segments).toEqual([15, 16, 17, 18, 19, 20]);
      expect(rule?.rings).toEqual(["triple"]);
    });

    it("returns empty hints for exact41 round", () => {
      const teams = makeTeams();
      let s = initLumberjack(ctx(teams));
      // Skip to round 6 (exact41)
      for (let i = 0; i < 12; i++) s = throwN(s, [["miss"], ["miss"], ["miss"]]);
      expect(s.currentRound).toBe(6);
      expect(getBoardHintsLumberjack(s)).toEqual({});
    });
  });

  describe("selectScoreboard", () => {
    it("returns score strings for each team", () => {
      const teams = makeTeams();
      let s = initLumberjack(ctx(teams));
      s = throwN(s, [[15, 1], [15, 1], [15, 1]]); // A: 45
      s = throwN(s, [["miss"], ["miss"], ["miss"]]); // B: 0

      const sb = selectScoreboardLumberjack(s);
      expect(sb.rows).toHaveLength(2);
      expect(sb.rows[0]!.primary).toBe("45");
      expect(sb.rows[1]!.primary).toBe("0");
    });
  });

  describe("dtAbove15Only setting integration", () => {
    it("allows D15 but blocks D14 in double round when enabled", () => {
      const teams = makeTeams();
      let s = initLumberjack(ctx(teams, { dtAbove15Only: true }));
      // Skip to round 2 (double)
      s = throwN(s, [["miss"], ["miss"], ["miss"]]);
      s = throwN(s, [["miss"], ["miss"], ["miss"]]);
      s = throwN(s, [["miss"], ["miss"], ["miss"]]);
      s = throwN(s, [["miss"], ["miss"], ["miss"]]);
      expect(s.currentRound).toBe(2);

      // Team A tries D14 (blocked), D15 (allowed), miss
      s = throwN(s, [[14, 2], [15, 2], ["miss"]]);
      expect(s.scoreByTeam["A"]).toBe(30); // Only D15 counted
    });
  });
});
