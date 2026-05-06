import { describe, it, expect } from "vitest";
import { computeCheckout, type CheckoutDart } from "@/games/x01/checkout";

function dartValue(d: CheckoutDart): number {
  return d.segment === "bull" ? 25 * d.multiplier : d.segment * d.multiplier;
}

function totalValue(darts: CheckoutDart[]): number {
  return darts.reduce((acc, d) => acc + dartValue(d), 0);
}

function endsOnDouble(darts: CheckoutDart[]): boolean {
  return darts[darts.length - 1]!.multiplier === 2;
}

describe("x01 checkout helper", () => {
  it("170: T20 → T20 → DB one-turn DO finish", () => {
    const result = computeCheckout(170, 3, true);
    expect(result).not.toBeNull();
    expect(result).toEqual([
      { segment: 20, multiplier: 3 },
      { segment: 20, multiplier: 3 },
      { segment: "bull", multiplier: 2 },
    ]);
  });

  it("returns a 1-dart finish when score is a single double", () => {
    const result = computeCheckout(40, 1, true);
    expect(result).not.toBeNull();
    expect(result!).toHaveLength(1);
    expect(result![0]).toEqual({ segment: 20, multiplier: 2 });
  });

  it("returns a 1-dart finish for double-bull (50)", () => {
    const result = computeCheckout(50, 1, true);
    expect(result).not.toBeNull();
    expect(result![0]).toEqual({ segment: "bull", multiplier: 2 });
  });

  it("returns a 2-dart finish for 100 (T20 + D20)", () => {
    const result = computeCheckout(100, 2, true);
    expect(result).not.toBeNull();
    expect(result!).toHaveLength(2);
    expect(totalValue(result!)).toBe(100);
    expect(endsOnDouble(result!)).toBe(true);
  });

  it("returns a 2-dart finish for 80 (T20 + D10)", () => {
    const result = computeCheckout(80, 2, true);
    expect(result).not.toBeNull();
    expect(totalValue(result!)).toBe(80);
    expect(endsOnDouble(result!)).toBe(true);
  });

  it("returns a 3-dart finish for 161 (T20 + T17 + DB)", () => {
    const result = computeCheckout(161, 3, true);
    expect(result).not.toBeNull();
    expect(totalValue(result!)).toBe(161);
    expect(endsOnDouble(result!)).toBe(true);
  });

  it("returns null when remaining darts cannot complete the score", () => {
    expect(computeCheckout(170, 1, true)).toBeNull();
    expect(computeCheckout(170, 2, true)).toBeNull();
    expect(computeCheckout(100, 1, true)).toBeNull();
  });

  it("returns null when score cannot be finished on a double", () => {
    // 1 cannot finish on a double (minimum double is D1 = 2).
    expect(computeCheckout(1, 3, true)).toBeNull();
    // 169, 168, 166, 165, 163, 162 are commonly cited as no-checkout scores from 170.
    expect(computeCheckout(169, 3, true)).toBeNull();
    expect(computeCheckout(168, 3, true)).toBeNull();
    expect(computeCheckout(166, 3, true)).toBeNull();
    expect(computeCheckout(165, 3, true)).toBeNull();
    expect(computeCheckout(163, 3, true)).toBeNull();
    expect(computeCheckout(162, 3, true)).toBeNull();
  });

  it("returns null when doubleOut is false", () => {
    expect(computeCheckout(40, 3, false)).toBeNull();
    expect(computeCheckout(170, 3, false)).toBeNull();
    expect(computeCheckout(100, 2, false)).toBeNull();
  });

  it("returns null when score is greater than 170", () => {
    expect(computeCheckout(171, 3, true)).toBeNull();
    expect(computeCheckout(180, 3, true)).toBeNull();
    expect(computeCheckout(501, 3, true)).toBeNull();
  });

  it("every returned finish ends on a double and totals to score", () => {
    for (let score = 2; score <= 170; score++) {
      const result = computeCheckout(score, 3, true);
      if (result === null) continue;
      expect(totalValue(result)).toBe(score);
      expect(endsOnDouble(result)).toBe(true);
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.length).toBeLessThanOrEqual(3);
    }
  });
});
