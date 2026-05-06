import type { ThrowRecord, ThrowSegment } from "./types/core";

export function computeScore(segment: ThrowSegment, multiplier: 1 | 2 | 3): number {
  if (segment === "miss") return 0;
  if (segment === "outer-bull") return 25;
  if (segment === "inner-bull") return 50;
  return segment * multiplier;
}

export function validateThrow(t: ThrowRecord): void {
  if (t.segment === "miss") {
    if (t.multiplier !== 1) throw new Error("Miss must have multiplier 1");
    if (t.score !== 0) throw new Error("Miss must score 0");
    return;
  }
  if (t.segment === "outer-bull") {
    if (t.multiplier !== 1) throw new Error("Outer bull must have multiplier 1");
    if (t.score !== 25) throw new Error("Outer bull must score 25");
    return;
  }
  if (t.segment === "inner-bull") {
    if (t.multiplier !== 1) throw new Error("Inner bull must have multiplier 1");
    if (t.score !== 50) throw new Error("Inner bull must score 50");
    return;
  }
  if (typeof t.segment !== "number" || t.segment < 1 || t.segment > 20) {
    throw new Error(`Invalid segment ${String(t.segment)}`);
  }
  if (![1, 2, 3].includes(t.multiplier)) {
    throw new Error(`Invalid multiplier ${t.multiplier}`);
  }
  if (t.score !== t.segment * t.multiplier) {
    throw new Error(`Score ${t.score} does not match segment*multiplier`);
  }
}
