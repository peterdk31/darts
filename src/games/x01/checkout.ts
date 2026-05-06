export type CheckoutDart = { segment: number | "bull"; multiplier: 1 | 2 | 3 };

function dartValue(d: CheckoutDart): number {
  if (d.segment === "bull") return 25 * d.multiplier;
  return d.segment * d.multiplier;
}

function allNonFinalHits(): CheckoutDart[] {
  const out: CheckoutDart[] = [];
  for (let s = 20; s >= 1; s--) {
    out.push({ segment: s, multiplier: 3 });
  }
  for (let s = 20; s >= 1; s--) {
    out.push({ segment: s, multiplier: 2 });
  }
  out.push({ segment: "bull", multiplier: 2 });
  for (let s = 20; s >= 1; s--) {
    out.push({ segment: s, multiplier: 1 });
  }
  out.push({ segment: "bull", multiplier: 1 });
  return out;
}

function allDoubles(): CheckoutDart[] {
  const out: CheckoutDart[] = [];
  for (let s = 20; s >= 1; s--) {
    out.push({ segment: s, multiplier: 2 });
  }
  out.push({ segment: "bull", multiplier: 2 });
  return out;
}

const NON_FINAL_HITS = allNonFinalHits();
const DOUBLES = allDoubles();

export function computeCheckout(
  score: number,
  dartsRemaining: 1 | 2 | 3,
  doubleOut: boolean,
): CheckoutDart[] | null {
  if (!doubleOut) return null;
  if (score > 170 || score < 2) return null;

  for (const d of DOUBLES) {
    if (dartValue(d) === score) return [d];
  }
  if (dartsRemaining === 1) return null;

  if (dartsRemaining >= 2) {
    for (const first of NON_FINAL_HITS) {
      const v1 = dartValue(first);
      if (v1 >= score) continue;
      const remain = score - v1;
      for (const last of DOUBLES) {
        if (dartValue(last) === remain) return [first, last];
      }
    }
  }
  if (dartsRemaining === 2) return null;

  for (const first of NON_FINAL_HITS) {
    const v1 = dartValue(first);
    if (v1 >= score) continue;
    for (const second of NON_FINAL_HITS) {
      const v2 = dartValue(second);
      if (v1 + v2 >= score) continue;
      const remain = score - v1 - v2;
      for (const last of DOUBLES) {
        if (dartValue(last) === remain) return [first, second, last];
      }
    }
  }
  return null;
}

export function formatCheckout(darts: CheckoutDart[]): string {
  return darts.map(formatDart).join(" → ");
}

function formatDart(d: CheckoutDart): string {
  const prefix = d.multiplier === 3 ? "T" : d.multiplier === 2 ? "D" : "S";
  if (d.segment === "bull") return d.multiplier === 2 ? "DB" : "B";
  return `${prefix}${d.segment}`;
}
