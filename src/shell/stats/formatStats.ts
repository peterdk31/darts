/** Shared formatting for dart stats on the results and players pages. */

export function threeDartAvg(points: number, darts: number): string {
  return darts > 0 ? ((points / darts) * 3).toFixed(1) : "0.0";
}

export function mpr(marks: number, darts: number): string {
  return darts > 0 ? ((marks / darts) * 3).toFixed(2) : "0.00";
}

export function percent(n: number, d: number): string {
  return `${d > 0 ? Math.round((100 * n) / d) : 0}%`;
}

export function x01Line(x: {
  darts: number;
  points: number;
  visits180: number;
  visits140: number;
  checkoutDarts: number;
  checkouts: number;
  highestCheckout: number;
}): string {
  const parts = [`avg ${threeDartAvg(x.points, x.darts)}`];
  if (x.visits180 > 0) parts.push(`${x.visits180}× 180`);
  if (x.visits140 > 0) parts.push(`${x.visits140}× 140+`);
  if (x.checkoutDarts > 0) {
    parts.push(`checkout ${x.checkouts}/${x.checkoutDarts} (${percent(x.checkouts, x.checkoutDarts)})`);
  }
  if (x.highestCheckout > 0) parts.push(`best out ${x.highestCheckout}`);
  return parts.join(" · ");
}
