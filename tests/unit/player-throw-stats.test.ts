import { describe, expect, it } from "vitest";
import { completedGameRecord, createGame, recordThrow } from "@/shell/session/gameRunner";
import type { InProgressGame } from "@/shell/session/types";
import { isWinSummary, type PlayerStat } from "@/shell/stats/computeWinSummary";
import { x01Manifest } from "@/games/x01/manifest";
import { cricketManifest } from "@/games/cricket/manifest";
import { aroundTheClockManifest } from "@/games/around-the-clock/manifest";
import type { GameManifest, ResolvedSettings } from "@/shared/types/game-module";
import type { Team, ThrowRecord } from "@/shared/types/core";

type AnyManifest = GameManifest<any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const TEAMS: Team[] = [
  { id: "A", displayName: "Alpha", colorId: "red", players: [{ id: "A1", displayName: "Alice" }] },
  { id: "B", displayName: "Bravo", colorId: "green", players: [{ id: "B1", displayName: "Bob" }] },
];

type Dart = [ThrowRecord["segment"], 1 | 2 | 3];

function playDarts(manifest: AnyManifest, settings: ResolvedSettings, darts: Dart[]): InProgressGame {
  let g = createGame(manifest, {
    id: "g1",
    teams: TEAMS,
    resolvedSettings: settings,
    startedAt: new Date(0).toISOString(),
  });
  for (const [segment, multiplier] of darts) {
    const score =
      segment === "miss" ? 0
      : segment === "outer-bull" ? 25
      : segment === "inner-bull" ? 50
      : segment * multiplier;
    g = recordThrow(manifest, g, {
      teamId: g.currentTurn.teamId,
      playerId: g.currentTurn.playerId,
      segment,
      multiplier,
      score,
      timestamp: new Date(0).toISOString(),
    }).game;
  }
  return g;
}

function statsFor(manifest: AnyManifest, g: InProgressGame, playerId: string): PlayerStat {
  const summary = completedGameRecord(manifest, g, ["A"]).summary;
  if (!isWinSummary(summary)) throw new Error("no summary");
  return summary.playerStats.find((p) => p.playerId === playerId)!;
}

const MISS3: Dart[] = [["miss", 1], ["miss", 1], ["miss", 1]];

describe("player throw stats", () => {
  it("Around the Clock: only darts that advance count as hits", () => {
    const g = playDarts(aroundTheClockManifest, {}, [[1, 1], [20, 1], ["miss", 1], ...MISS3]);
    const a = statsFor(aroundTheClockManifest, g, "A1");
    expect(a.dartsThrown).toBe(3);
    expect(a.dartsHit).toBe(1);
  });

  it("X01: average, 180s, busted visits and checkouts", () => {
    const g = playDarts(
      x01Manifest,
      { startingScore: "301", doubleOut: false, doubleIn: false },
      [
        [20, 3], [20, 3], [20, 3], // 180 → 121
        ...MISS3,
        [20, 3], [20, 3], [20, 1], // 61, 1, bust → back to 121
        ...MISS3,
        [20, 3], [20, 3], [1, 1], // 61, 1, checkout
      ],
    );
    const a = statsFor(x01Manifest, g, "A1");
    expect(a.dartsThrown).toBe(9);
    expect(a.dartsHit).toBe(6);
    expect(a.x01).toEqual({
      points: 301,
      visits180: 1,
      visits140: 0,
      checkoutDarts: 2, // remaining 1 before dart 3 of visit 2 and of visit 3
      checkouts: 1,
      highestCheckout: 121,
    });
    const b = statsFor(x01Manifest, g, "B1");
    expect(b.dartsHit).toBe(0);
    expect(b.x01!.points).toBe(0);
  });

  it("Cricket: marks count toward closing or scoring, not dead numbers", () => {
    const g = playDarts(cricketManifest, {}, [
      [20, 3], [20, 1], [5, 1], // close 20, score 20, nothing
      [20, 3], ["miss", 1], ["miss", 1], // Bob closes 20
      [20, 1], ["miss", 1], ["miss", 1], // 20 is dead
    ]);
    const a = statsFor(cricketManifest, g, "A1");
    expect(a.marks).toBe(4);
    expect(a.dartsHit).toBe(2);
    expect(statsFor(cricketManifest, g, "B1").marks).toBe(3);
  });
});
