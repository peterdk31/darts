/**
 * Deterministic randomness for game engines.
 *
 * Undo/redo and session restore rebuild a game by replaying its throws from
 * `init`. That only works if engines are pure, so engines must never call
 * `Math.random()` — they use the `random()` the shell passes to `init` and
 * `applyThrow`, which is seeded from the game id and the throw index.
 */

export type RandomFn = () => number;

/** FNV-1a string hash → unsigned 32-bit seed. */
function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: small, fast PRNG; good enough for shuffling a dartboard. */
function mulberry32(seed: number): RandomFn {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Random stream for one step of a game. `step` is "init" for `init`, or the
 * 0-based index of the throw being applied.
 */
export function gameRandom(gameId: string, step: number | "init"): RandomFn {
  return mulberry32(hashString(`${gameId}:${step}`));
}

/** Fisher–Yates shuffle (returns a new array). */
export function shuffle<T>(items: ReadonlyArray<T>, random: RandomFn): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
