/**
 * Contract every registered game must meet for undo/redo and session restore
 * to work: the game is a pure function of its throw list.
 *
 * For each game and a spread of settings, plays a long pseudo-random game and
 * after every throw checks that
 *   - replaying all throws from init gives exactly the live state
 *     (no Math.random, no hidden state),
 *   - applyThrow never mutates the previous state (states are deep-frozen),
 *   - undo restores exactly the previous state, and redo the next one,
 *   - the state survives a JSON round trip (it is persisted to localStorage).
 */
import { describe, it, expect } from "vitest";
import { listAll } from "@/games/registry";
import {
  createGame,
  recordThrow,
  redoThrow,
  replayGame,
  undoThrow,
} from "@/shell/session/gameRunner";
import type { InProgressGame } from "@/shell/session/types";
import type { GameManifest, ResolvedSettings, SettingDefinition } from "@/shared/types/game-module";
import type { Team, ThrowRecord, ThrowSegment } from "@/shared/types/core";
import { gameRandom, type RandomFn } from "@/shared/random";

type AnyManifest = GameManifest<any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const MAX_THROWS = 120;

const teams: Team[] = [
  { id: "A", displayName: "A", colorId: "red", players: [{ id: "A1", displayName: "Ann" }, { id: "A2", displayName: "Al" }] },
  { id: "B", displayName: "B", colorId: "green", players: [{ id: "B1", displayName: "Bob" }] },
  { id: "C", displayName: "C", colorId: "orange", players: [{ id: "C1", displayName: "Cy" }] },
];

function defaults(schema: ReadonlyArray<SettingDefinition>): Record<string, boolean | number | string> {
  return Object.fromEntries(schema.map((s) => [s.key, s.default]));
}

/** Defaults, plus every single-setting variation from them. */
function settingVariants(schema: ReadonlyArray<SettingDefinition>): ResolvedSettings[] {
  const base = defaults(schema);
  const out: ResolvedSettings[] = [base];
  for (const s of schema) {
    const values: Array<boolean | number | string> =
      s.type === "toggle"
        ? [!s.default]
        : s.type === "integer"
          ? [s.constraints.min, s.constraints.max]
          : s.constraints.choices.map((c) => c.value);
    for (const v of values) {
      if (v !== s.default) out.push({ ...base, [s.key]: v });
    }
  }
  return out;
}

function randomThrow(manifest: AnyManifest, game: InProgressGame, rnd: RandomFn): ThrowRecord {
  const roll = rnd();
  let segment: ThrowSegment;
  let multiplier: 1 | 2 | 3 = 1;
  let score: number;
  if (roll < 0.1) {
    segment = "miss";
    score = 0;
  } else if (roll < 0.15) {
    segment = "outer-bull";
    score = 25;
  } else if (roll < 0.18) {
    segment = "inner-bull";
    score = 50;
  } else {
    const n = 1 + Math.floor(rnd() * 20);
    multiplier = (1 + Math.floor(rnd() * 3)) as 1 | 2 | 3;
    segment = n as ThrowSegment;
    score = n * multiplier;
  }
  const t: ThrowRecord = {
    teamId: game.currentTurn.teamId,
    playerId: game.currentTurn.playerId,
    segment,
    multiplier,
    score,
    timestamp: "t",
  };
  const candidates = manifest.getCandidatesForThrow?.(game.engineState, t) ?? [];
  if (candidates.length > 0) {
    t.intent = candidates[Math.floor(rnd() * candidates.length)]!.intent;
  }
  return t;
}

function deepFreeze<T>(x: T): T {
  if (x && typeof x === "object" && !Object.isFrozen(x)) {
    Object.freeze(x);
    for (const v of Object.values(x)) deepFreeze(v);
  }
  return x;
}

const snapshot = (g: InProgressGame) => ({ engineState: g.engineState, currentTurn: g.currentTurn });

describe.each(listAll().map((m) => [m.id, m] as const))("%s replay contract", (_id, manifest) => {
  it.each(settingVariants(manifest.settingsSchema).map((s) => [JSON.stringify(s), s] as const))(
    "settings %s",
    (_label, settings) => {
      for (const seed of ["s1", "s2"]) {
        const rnd = gameRandom(`throws-${seed}`, "init");
        let game = createGame(manifest, {
          id: `game-${seed}`,
          teams,
          resolvedSettings: settings,
          startedAt: "t",
        });

        for (let i = 0; i < MAX_THROWS; i++) {
          deepFreeze(game.engineState);
          const before = game;
          const r = recordThrow(manifest, before, randomThrow(manifest, before, rnd));
          game = r.game;

          const replayed = replayGame(manifest, game);
          expect(snapshot(replayed.game)).toEqual(snapshot(game));
          expect(replayed.winnerTeamIds).toEqual(r.winnerTeamIds);

          const undone = undoThrow(manifest, game)!;
          expect(snapshot(undone)).toEqual(snapshot(before));
          const redone = redoThrow(manifest, undone)!;
          expect(snapshot(redone.game)).toEqual(snapshot(game));
          expect(redone.winnerTeamIds).toEqual(r.winnerTeamIds);

          expect(JSON.parse(JSON.stringify(game.engineState))).toEqual(game.engineState);

          if (r.winnerTeamIds) break;
        }
      }
    },
  );
});
