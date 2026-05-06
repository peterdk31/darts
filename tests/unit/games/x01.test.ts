import { describe, it, expect } from "vitest";
import { initX01, applyThrowX01, type X01EngineState } from "@/games/x01/engine";
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

function makeCtx(teams: Team[], settings: Record<string, boolean>): InitContext {
  return {
    teams,
    resolvedSettings: settings,
    helpers: {
      teamAllotment: () => 3,
      allotmentForPlayer: () => 3,
    },
  };
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
    timestamp: new Date().toISOString(),
  };
}

function feed(state: X01EngineState, throws: ThrowRecord[]): X01EngineState {
  let s = state;
  for (const t of throws) s = applyThrowX01(s, t).state;
  return s;
}

describe("x01 engine", () => {
  it("normal play subtracts hits and reaches zero", () => {
    const teams = makeTeams();
    const init = initX01(makeCtx(teams, {}), { startingScore: 100 });
    // T20=60, then S20=20, then D10=20 → exactly zero.
    const t1 = makeThrow("A", "A1", 20, 3, 60);
    const t2 = makeThrow("A", "A1", 20, 1, 20);
    const t3 = makeThrow("A", "A1", 10, 2, 20);
    const r1 = applyThrowX01(init, t1);
    const r2 = applyThrowX01(r1.state, t2);
    const r3 = applyThrowX01(r2.state, t3);
    expect(r3.state.scoreByTeam["A"]).toBe(0);
    expect(r3.effects.some((e) => e.kind === "gameWon")).toBe(true);
  });

  it("bust on overshoot reverts to start of turn", () => {
    const teams = makeTeams();
    const init = initX01(makeCtx(teams, {}), { startingScore: 50 });
    // First throw 60 → overshoots → bust, score back to 50.
    const t1 = makeThrow("A", "A1", 20, 3, 60);
    const r = applyThrowX01(init, t1);
    expect(r.effects.some((e) => e.kind === "bust")).toBe(true);
    expect(r.state.scoreByTeam["A"]).toBe(50);
    // Should advance turn to team B.
    const adv = r.effects.find((e) => e.kind === "turnAdvance");
    expect(adv).toBeDefined();
  });

  it("double-out: cannot finish on a non-double", () => {
    const teams = makeTeams();
    const init = initX01(makeCtx(teams, { doubleOut: true }), { startingScore: 40 });
    // Single 20 — score would be 20 with 20 to go → fine
    const t1 = makeThrow("A", "A1", 20, 1, 20);
    const r1 = applyThrowX01(init, t1);
    expect(r1.state.scoreByTeam["A"]).toBe(20);
    // Single 20 again — would go to 0 but not on a double → bust.
    const t2 = makeThrow("A", "A1", 20, 1, 20);
    const r2 = applyThrowX01(r1.state, t2);
    expect(r2.effects.some((e) => e.kind === "bust")).toBe(true);
    expect(r2.state.scoreByTeam["A"]).toBe(40); // reverted
  });

  it("double-out: finishing on a double wins", () => {
    const teams = makeTeams();
    const init = initX01(makeCtx(teams, { doubleOut: true }), { startingScore: 40 });
    const t1 = makeThrow("A", "A1", 20, 2, 40); // D20 = 40 → finish on double.
    const r = applyThrowX01(init, t1);
    expect(r.effects.some((e) => e.kind === "gameWon")).toBe(true);
    expect(r.state.scoreByTeam["A"]).toBe(0);
  });

  it("double-in: throws score 0 until first double is hit", () => {
    const teams = makeTeams();
    const init = initX01(makeCtx(teams, { doubleIn: true }), { startingScore: 100 });
    const single = makeThrow("A", "A1", 20, 1, 20);
    const r1 = applyThrowX01(init, single);
    expect(r1.state.scoreByTeam["A"]).toBe(100); // no scoring before double-in.
    const dbl = makeThrow("A", "A1", 10, 2, 20);
    const r2 = applyThrowX01(r1.state, dbl);
    expect(r2.state.scoreByTeam["A"]).toBe(80); // double counted.
    const single2 = makeThrow("A", "A1", 5, 1, 5);
    const r3 = applyThrowX01(r2.state, single2);
    expect(r3.state.scoreByTeam["A"]).toBe(75); // singles count after double-in achieved.
  });

  it("undo equivalence: replay through n-1 throws produces same state as if last throw never happened", () => {
    const teams = makeTeams();
    const init = initX01(makeCtx(teams, {}), { startingScore: 501 });
    const throws: ThrowRecord[] = [
      makeThrow("A", "A1", 20, 3, 60),
      makeThrow("A", "A1", 20, 1, 20),
      makeThrow("A", "A1", 10, 2, 20),
    ];
    const sFull = feed(init, throws);
    const sShort = feed(init, throws.slice(0, -1));
    expect(sShort.scoreByTeam["A"]).not.toBe(sFull.scoreByTeam["A"]);
    // Re-replay short and verify deterministic.
    const sShortAgain = feed(init, throws.slice(0, -1));
    expect(sShortAgain.scoreByTeam).toEqual(sShort.scoreByTeam);
  });
});
