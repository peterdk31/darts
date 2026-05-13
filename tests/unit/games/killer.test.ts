import { describe, it, expect } from "vitest";
import {
  applyThrowKiller,
  initKiller,
  getBoardHintsKiller,
  getTurnHintKiller,
  getQuickInputsKiller,
  KILLER_THRESHOLD,
  type KillerEngineState,
} from "@/games/killer/engine";
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
      targets: "all",
      killerStraightOff: false,
      numberSelection: "throw",
      ...overrides,
    },
    helpers: { teamAllotment: () => 3, allotmentForPlayer: () => 3 },
  };
}

function activeIds(s: KillerEngineState): { teamId: string; playerId: string } {
  const teamId = s.turnOrder[s.pointer.teamIdx]!;
  const team = s.teams.find((t) => t.id === teamId)!;
  const playerId = team.players[s.pointer.playerIdxInTeam]!.id;
  return { teamId, playerId };
}

function throwAt(
  s: KillerEngineState,
  segment: ThrowRecord["segment"],
  multiplier: 1 | 2 | 3,
  score: number,
): KillerEngineState {
  const { teamId, playerId } = activeIds(s);
  return applyThrowKiller(s, {
    teamId,
    playerId,
    segment,
    multiplier,
    score,
    timestamp: "t",
  }).state;
}

function throwResult(
  s: KillerEngineState,
  segment: ThrowRecord["segment"],
  multiplier: 1 | 2 | 3,
  score: number,
) {
  const { teamId, playerId } = activeIds(s);
  return applyThrowKiller(s, {
    teamId,
    playerId,
    segment,
    multiplier,
    score,
    timestamp: "t",
  });
}

/** Advance through number selection so all 3 teams have numbers. */
function selectNumbers(s: KillerEngineState): KillerEngineState {
  s = throwAt(s, 7, 1, 7); // A → 7
  s = throwAt(s, 12, 1, 12); // B → 12
  s = throwAt(s, 3, 1, 3); // C → 3
  return s;
}

// ---------------------------------------------------------------------------
// Number selection phase (unchanged from v1)
// ---------------------------------------------------------------------------

describe("killer engine – number selection", () => {
  it("starts in number-selection phase with throw mode", () => {
    const s = initKiller(ctx(makeThreeTeams()));
    expect(s.phase).toBe("number-selection");
    expect(Object.keys(s.assignments)).toHaveLength(0);
  });

  it("claims a number when hitting an unclaimed segment", () => {
    let s = initKiller(ctx(makeThreeTeams()));
    s = throwAt(s, 7, 1, 7);
    expect(s.assignments["A"]).toBe(7);
  });

  it("claims via double or triple (multiplier irrelevant in selection)", () => {
    let s = initKiller(ctx(makeThreeTeams()));
    s = throwAt(s, 18, 2, 36);
    expect(s.assignments["A"]).toBe(18);
  });

  it("does not claim on miss", () => {
    let s = initKiller(ctx(makeThreeTeams()));
    s = throwAt(s, "miss", 1, 0);
    expect(s.assignments["A"]).toBeUndefined();
  });

  it("bull does not claim and does not change turn", () => {
    let s = initKiller(ctx(makeThreeTeams()));
    s = throwAt(s, "outer-bull", 1, 25);
    expect(s.assignments["A"]).toBeUndefined();
    expect(activeIds(s).teamId).toBe("A"); // still A's turn
    s = throwAt(s, "inner-bull", 2, 50);
    expect(activeIds(s).teamId).toBe("A"); // still A's turn
  });

  it("does not claim an already-taken number", () => {
    let s = initKiller(ctx(makeThreeTeams()));
    s = throwAt(s, 7, 1, 7); // A claims 7
    s = throwAt(s, 7, 1, 7); // B tries 7
    expect(s.assignments["B"]).toBeUndefined();
  });

  it("advances to next unclaimed team", () => {
    let s = initKiller(ctx(makeThreeTeams()));
    s = throwAt(s, 7, 1, 7);
    expect(activeIds(s).teamId).toBe("B");
    s = throwAt(s, 12, 1, 12);
    expect(activeIds(s).teamId).toBe("C");
  });

  it("wraps around skipping claimed teams on miss", () => {
    let s = initKiller(ctx(makeThreeTeams()));
    s = throwAt(s, 7, 1, 7); // A claims
    s = throwAt(s, "miss", 1, 0); // B misses → C
    expect(activeIds(s).teamId).toBe("C");
    s = throwAt(s, "miss", 1, 0); // C misses → B (A skipped)
    expect(activeIds(s).teamId).toBe("B");
  });

  it("transitions to playing phase when all teams assigned", () => {
    let s = initKiller(ctx(makeThreeTeams()));
    s = selectNumbers(s);
    expect(s.phase).toBe("playing");
    expect(s.pointer.teamIdx).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Random number selection
// ---------------------------------------------------------------------------

describe("killer engine – random numbers", () => {
  it("assigns unique numbers and starts in playing phase", () => {
    const s = initKiller(ctx(makeThreeTeams(), { numberSelection: "random" }));
    expect(s.phase).toBe("playing");
    const nums = Object.values(s.assignments);
    expect(new Set(nums).size).toBe(3);
    for (const n of nums) {
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(20);
    }
  });
});

// ---------------------------------------------------------------------------
// Earning lives & becoming a killer (new mechanic)
// ---------------------------------------------------------------------------

describe("killer engine – earning lives", () => {
  it("starts with 0 lives", () => {
    let s = initKiller(ctx(makeThreeTeams()));
    s = selectNumbers(s);
    expect(s.lives["A"]).toBe(0);
  });

  it("single on own number → +1 life", () => {
    let s = initKiller(ctx(makeThreeTeams()));
    s = selectNumbers(s);
    s = throwAt(s, 7, 1, 7); // A hits S7
    expect(s.lives["A"]).toBe(1);
  });

  it("double on own number → +2 lives", () => {
    let s = initKiller(ctx(makeThreeTeams()));
    s = selectNumbers(s);
    s = throwAt(s, 7, 2, 14); // A hits D7
    expect(s.lives["A"]).toBe(2);
  });

  it("triple on own number → +3 lives → killer", () => {
    let s = initKiller(ctx(makeThreeTeams()));
    s = selectNumbers(s);
    s = throwAt(s, 7, 3, 21); // A hits T7 → 3 lives
    expect(s.lives["A"]).toBe(3);
    expect(s.isKiller["A"]).toBe(true);
  });

  it("accumulates across turns to reach killer threshold", () => {
    let s = initKiller(ctx(makeThreeTeams()));
    s = selectNumbers(s);

    // A: S7 (+1), miss, miss → 1 life
    s = throwAt(s, 7, 1, 7);
    s = throwAt(s, "miss", 1, 0);
    s = throwAt(s, "miss", 1, 0);
    expect(s.lives["A"]).toBe(1);
    expect(s.isKiller["A"]).toBe(false);

    // skip B and C turns (miss×3 each)
    for (let i = 0; i < 6; i++) s = throwAt(s, "miss", 1, 0);

    // A: D7 (+2) → 3 total → killer
    s = throwAt(s, 7, 2, 14);
    expect(s.lives["A"]).toBe(3);
    expect(s.isKiller["A"]).toBe(true);
  });

  it("hitting own number as a killer gains more lives (stockpile)", () => {
    let s = initKiller(ctx(makeThreeTeams()));
    s = selectNumbers(s);
    s = throwAt(s, 7, 3, 21); // A: T7 → 3 lives, killer
    s = throwAt(s, 7, 1, 7); // A: S7 → 4 lives, still killer
    expect(s.lives["A"]).toBe(4);
    expect(s.isKiller["A"]).toBe(true);
  });

  it("hitting opponent's number as non-killer does nothing", () => {
    let s = initKiller(ctx(makeThreeTeams()));
    s = selectNumbers(s);
    s = throwAt(s, 12, 3, 36); // A hits T12 (B's number) — not a killer
    expect(s.lives["B"]).toBe(0);
    expect(s.lives["A"]).toBe(0);
  });

  it("miss and bull do not earn lives", () => {
    let s = initKiller(ctx(makeThreeTeams()));
    s = selectNumbers(s);
    s = throwAt(s, "miss", 1, 0);
    s = throwAt(s, "outer-bull", 1, 25);
    s = throwAt(s, "inner-bull", 2, 50);
    expect(s.lives["A"]).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Killer straight off
// ---------------------------------------------------------------------------

describe("killer engine – killer straight off", () => {
  it("all teams start as killers with threshold lives", () => {
    let s = initKiller(ctx(makeThreeTeams(), { killerStraightOff: true }));
    s = selectNumbers(s);
    expect(s.isKiller["A"]).toBe(true);
    expect(s.isKiller["B"]).toBe(true);
    expect(s.lives["A"]).toBe(KILLER_THRESHOLD);
  });
});

// ---------------------------------------------------------------------------
// Attacking opponents (new mechanic)
// ---------------------------------------------------------------------------

describe("killer engine – attacking opponents", () => {
  function setupAllKillers() {
    let s = initKiller(
      ctx(makeThreeTeams(), { killerStraightOff: true }),
    );
    return selectNumbers(s);
  }

  it("killer S on opponent → -1 life", () => {
    let s = setupAllKillers();
    s = throwAt(s, 12, 1, 12); // A hits S12 → B loses 1
    expect(s.lives["B"]).toBe(2);
  });

  it("killer D on opponent → -2 lives", () => {
    let s = setupAllKillers();
    s = throwAt(s, 12, 2, 24);
    expect(s.lives["B"]).toBe(1);
  });

  it("killer T on opponent → -3 lives → floor at 0", () => {
    let s = setupAllKillers();
    s = throwAt(s, 12, 3, 36);
    expect(s.lives["B"]).toBe(0);
    expect(s.eliminatedTeamIds).not.toContain("B"); // mercy: not eliminated at 0
  });

  it("opponent at 0 lives + another hit → eliminated", () => {
    let s = setupAllKillers();
    s = throwAt(s, 12, 3, 36); // B → 0
    s = throwAt(s, 12, 1, 12); // B at 0, hit again → eliminated
    expect(s.eliminatedTeamIds).toContain("B");
  });

  it("opponent loses killer status when hit", () => {
    let s = setupAllKillers();
    expect(s.isKiller["B"]).toBe(true);
    s = throwAt(s, 12, 1, 12); // A hits B
    expect(s.isKiller["B"]).toBe(false);
    expect(s.lives["B"]).toBe(2);
  });

  it("eliminated team is skipped in turn order", () => {
    let s = setupAllKillers();
    s = throwAt(s, 12, 3, 36); // A: T12 → B to 0
    s = throwAt(s, 12, 1, 12); // A: S12 → B eliminated
    s = throwAt(s, "miss", 1, 0); // A: miss → turn ends → skip B → C
    expect(activeIds(s).teamId).toBe("C");
  });

  it("last team standing wins", () => {
    let s = initKiller(
      ctx(makeTwoTeams(), { killerStraightOff: true }),
    );
    s = throwAt(s, 7, 1, 7);
    s = throwAt(s, 12, 1, 12);
    // A: T12 → B to 0, then S12 → B eliminated
    s = throwAt(s, 12, 3, 36);
    const r = throwResult(s, 12, 1, 12);
    expect(r.effects.some((e) => e.kind === "gameWon")).toBe(true);
    expect(r.state.status).toBe("won");
    expect(r.state.winnerTeamIds).toEqual(["A"]);
  });
});

// ---------------------------------------------------------------------------
// Losing & regaining killer status
// ---------------------------------------------------------------------------

describe("killer engine – killer status loss & recovery", () => {
  function setupAllKillers() {
    let s = initKiller(
      ctx(makeThreeTeams(), { killerStraightOff: true }),
    );
    return selectNumbers(s);
  }

  it("killer who gets hit loses status even with lives remaining", () => {
    let s = setupAllKillers();
    // A (killer, 3 lives) attacks B
    s = throwAt(s, 12, 1, 12);
    expect(s.isKiller["B"]).toBe(false);
    expect(s.lives["B"]).toBe(2); // still has lives, but not killer
  });

  it("hitting own number at threshold regains killer status", () => {
    let s = setupAllKillers();
    // A hits B → B loses status (2 lives)
    s = throwAt(s, 12, 1, 12);
    s = throwAt(s, "miss", 1, 0);
    s = throwAt(s, "miss", 1, 0);

    // B's turn: hit own number → lives go 2→3, regain killer
    s = throwAt(s, 12, 1, 12); // B: S12 → 3 lives
    expect(s.lives["B"]).toBe(3);
    expect(s.isKiller["B"]).toBe(true);
  });

  it("player reduced to 0 can recover by earning lives", () => {
    let s = setupAllKillers();
    // A: T12 → B to 0 (not eliminated), miss, miss
    s = throwAt(s, 12, 3, 36);
    s = throwAt(s, "miss", 1, 0);
    s = throwAt(s, "miss", 1, 0);
    expect(s.lives["B"]).toBe(0);
    expect(s.eliminatedTeamIds).not.toContain("B");

    // B's turn: T12 → +3 lives → killer again
    s = throwAt(s, 12, 3, 36);
    expect(s.lives["B"]).toBe(3);
    expect(s.isKiller["B"]).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Target ring setting
// ---------------------------------------------------------------------------

describe("killer engine – target ring: doubles only", () => {
  it("only double hits count; single and triple ignored", () => {
    let s = initKiller(ctx(makeThreeTeams(), { targets: "doubles" }));
    s = selectNumbers(s);

    s = throwAt(s, 7, 1, 7); // S7 → no effect
    expect(s.lives["A"]).toBe(0);
    s = throwAt(s, 7, 3, 21); // T7 → no effect
    expect(s.lives["A"]).toBe(0);
    s = throwAt(s, 7, 2, 14); // D7 → +2 lives
    expect(s.lives["A"]).toBe(2);
  });

  it("two doubles reach killer threshold", () => {
    let s = initKiller(ctx(makeThreeTeams(), { targets: "doubles" }));
    s = selectNumbers(s);

    s = throwAt(s, 7, 2, 14); // +2
    s = throwAt(s, 7, 2, 14); // +2 → 4 ≥ 3 → killer
    expect(s.lives["A"]).toBe(4);
    expect(s.isKiller["A"]).toBe(true);
  });
});

describe("killer engine – target ring: trebles only", () => {
  it("only triple hits count", () => {
    let s = initKiller(ctx(makeThreeTeams(), { targets: "trebles" }));
    s = selectNumbers(s);

    s = throwAt(s, 7, 1, 7); // S7 → no effect
    expect(s.lives["A"]).toBe(0);
    s = throwAt(s, 7, 2, 14); // D7 → no effect
    expect(s.lives["A"]).toBe(0);
    s = throwAt(s, 7, 3, 21); // T7 → +3 → killer
    expect(s.lives["A"]).toBe(3);
    expect(s.isKiller["A"]).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Max lives setting
// ---------------------------------------------------------------------------

describe("killer engine – max lives", () => {
  it("0 means no cap (can stockpile freely)", () => {
    let s = initKiller(ctx(makeThreeTeams(), { maxLives: 0 }));
    s = selectNumbers(s);
    // A: T7 (+3) → killer, T7 (+3) → 6, T7 (+3) → 9
    s = throwAt(s, 7, 3, 21);
    s = throwAt(s, 7, 3, 21);
    s = throwAt(s, 7, 3, 21);
    expect(s.lives["A"]).toBe(9);
  });

  it("caps lives when maxLives > 0", () => {
    let s = initKiller(ctx(makeThreeTeams(), { maxLives: 4 }));
    s = selectNumbers(s);
    // A: T7 (+3) → 3, then D7 would give +2 → capped at 4
    s = throwAt(s, 7, 3, 21);
    s = throwAt(s, 7, 2, 14);
    expect(s.lives["A"]).toBe(4);
  });

  it("cap applies even with a single large hit", () => {
    let s = initKiller(ctx(makeThreeTeams(), { maxLives: 3 }));
    s = selectNumbers(s);
    // A: T7 (+3) → capped at 3, then S7 → still 3
    s = throwAt(s, 7, 3, 21);
    s = throwAt(s, 7, 1, 7);
    expect(s.lives["A"]).toBe(3);
  });

  it("lives can still be reduced below the cap by opponents", () => {
    let s = initKiller(
      ctx(makeThreeTeams(), { maxLives: 3, killerStraightOff: true }),
    );
    s = selectNumbers(s);
    // A (killer, 3) hits B → B goes to 2
    s = throwAt(s, 12, 1, 12);
    expect(s.lives["B"]).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Board hints respect target ring
// ---------------------------------------------------------------------------

describe("killer engine – board hints", () => {
  it("highlights full segment in 'all' mode for non-killer", () => {
    let s = initKiller(ctx(makeThreeTeams(), { targets: "all" }));
    s = selectNumbers(s);
    const hints = getBoardHintsKiller(s);
    expect(hints.highlights?.[0]?.segments).toEqual([7]);
    expect(hints.highlights?.[0]?.rings).toBeUndefined();
  });

  it("highlights double ring in 'doubles' mode", () => {
    let s = initKiller(ctx(makeThreeTeams(), { targets: "doubles" }));
    s = selectNumbers(s);
    const hints = getBoardHintsKiller(s);
    expect(hints.highlights?.[0]?.segments).toEqual([7]);
    expect(hints.highlights?.[0]?.rings).toEqual(["double"]);
  });

  it("highlights triple ring in 'trebles' mode", () => {
    let s = initKiller(ctx(makeThreeTeams(), { targets: "trebles" }));
    s = selectNumbers(s);
    const hints = getBoardHintsKiller(s);
    expect(hints.highlights?.[0]?.segments).toEqual([7]);
    expect(hints.highlights?.[0]?.rings).toEqual(["triple"]);
  });

  it("highlights opponent segments for killer", () => {
    let s = initKiller(
      ctx(makeThreeTeams(), { killerStraightOff: true, targets: "all" }),
    );
    s = selectNumbers(s);
    const hints = getBoardHintsKiller(s);
    const segs = hints.highlights?.[0]?.segments;
    expect(segs).toEqual(expect.arrayContaining([12, 3]));
    expect(segs).not.toContain(7);
  });
});

// ---------------------------------------------------------------------------
// Quick inputs respect target ring
// ---------------------------------------------------------------------------

describe("killer engine – quick inputs", () => {
  it("shows S/D/T in 'all' mode for non-killer", () => {
    let s = initKiller(ctx(makeThreeTeams(), { targets: "all" }));
    s = selectNumbers(s);
    const qi = getQuickInputsKiller(s)!;
    const labels = qi[0]!.actions.map((a) => a.label);
    expect(labels).toEqual(["S7", "D7", "T7"]);
  });

  it("shows only D in 'doubles' mode", () => {
    let s = initKiller(ctx(makeThreeTeams(), { targets: "doubles" }));
    s = selectNumbers(s);
    const qi = getQuickInputsKiller(s)!;
    expect(qi[0]!.actions.map((a) => a.label)).toEqual(["D7"]);
  });

  it("shows only T in 'trebles' mode", () => {
    let s = initKiller(ctx(makeThreeTeams(), { targets: "trebles" }));
    s = selectNumbers(s);
    const qi = getQuickInputsKiller(s)!;
    expect(qi[0]!.actions.map((a) => a.label)).toEqual(["T7"]);
  });

  it("shows opponent targets for killer", () => {
    let s = initKiller(
      ctx(makeThreeTeams(), { killerStraightOff: true, targets: "all" }),
    );
    s = selectNumbers(s);
    const qi = getQuickInputsKiller(s)!;
    const allLabels = qi.flatMap((g) => g.actions.map((a) => a.label));
    expect(allLabels).toContain("S12");
    expect(allLabels).toContain("S3");
    expect(allLabels).toContain("Miss");
  });

  it("returns null when game is won", () => {
    let s = initKiller(
      ctx(makeTwoTeams(), { killerStraightOff: true }),
    );
    s = throwAt(s, 7, 1, 7);
    s = throwAt(s, 12, 1, 12);
    s = throwAt(s, 12, 3, 36); // B → 0
    s = throwAt(s, 12, 1, 12); // B eliminated → A wins
    expect(getQuickInputsKiller(s)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Turn hint
// ---------------------------------------------------------------------------

describe("killer engine – turn hint", () => {
  it("shows claim prompt during number selection", () => {
    const s = initKiller(ctx(makeThreeTeams()));
    expect(getTurnHintKiller(s, "A")?.label).toBe("Throw");
  });

  it("shows lives progress for non-killer", () => {
    let s = initKiller(ctx(makeThreeTeams()));
    s = selectNumbers(s);
    const hint = getTurnHintKiller(s, "A");
    expect(hint?.label).toBe("Target");
    expect(hint?.value).toContain("0/3");
  });

  it("shows killer status with life count", () => {
    let s = initKiller(ctx(makeThreeTeams(), { killerStraightOff: true }));
    s = selectNumbers(s);
    const hint = getTurnHintKiller(s, "A");
    expect(hint?.label).toBe("Killer");
    expect(hint?.value).toContain("3");
  });
});

// ---------------------------------------------------------------------------
// Full game scenario
// ---------------------------------------------------------------------------

describe("killer engine – full game", () => {
  it("plays a complete 3-player game with earning and attacking", () => {
    let s = initKiller(ctx(makeThreeTeams()));

    // Number selection
    s = selectNumbers(s);
    expect(s.phase).toBe("playing");

    // A earns killer: T7 (+3) → killer, miss, miss
    s = throwAt(s, 7, 3, 21);
    expect(s.isKiller["A"]).toBe(true);
    s = throwAt(s, "miss", 1, 0);
    s = throwAt(s, "miss", 1, 0);

    // B earns: S12 (+1), D12 (+2) → 3 lives → killer, miss
    s = throwAt(s, 12, 1, 12);
    s = throwAt(s, 12, 2, 24);
    expect(s.isKiller["B"]).toBe(true);
    s = throwAt(s, "miss", 1, 0);

    // C earns: T3 (+3) → killer, then attacks A: S7 → A loses 1 life (2), miss
    s = throwAt(s, 3, 3, 9);
    expect(s.isKiller["C"]).toBe(true);
    s = throwAt(s, 7, 1, 7); // C attacks A → A: 3→2
    expect(s.lives["A"]).toBe(2);
    expect(s.isKiller["A"]).toBe(false); // A lost killer status
    s = throwAt(s, "miss", 1, 0);

    // A's turn: must re-earn killer. S7 (+1) → 3 lives → regain killer
    s = throwAt(s, 7, 1, 7);
    expect(s.lives["A"]).toBe(3);
    expect(s.isKiller["A"]).toBe(true);

    // A attacks B: T12 → -3, B at 0
    s = throwAt(s, 12, 3, 36);
    expect(s.lives["B"]).toBe(0);
    expect(s.eliminatedTeamIds).not.toContain("B"); // mercy

    // A finishes turn: S12 → B at 0, eliminated
    const r = throwResult(s, 12, 1, 12);
    expect(r.state.eliminatedTeamIds).toContain("B");
    s = r.state;

    // B skipped → C's turn
    expect(activeIds(s).teamId).toBe("C");

    // C attacks A: T7 → A: 3→0, then S7 → eliminate → C wins
    s = throwAt(s, 7, 3, 21);
    expect(s.lives["A"]).toBe(0);
    const final = throwResult(s, 7, 1, 7);
    expect(final.state.status).toBe("won");
    expect(final.state.winnerTeamIds).toEqual(["C"]);
  });
});
