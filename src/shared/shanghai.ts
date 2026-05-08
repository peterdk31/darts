import type { ThrowRecord } from "./types/core";
import type { SettingDefinition } from "./types/game-module";

export function detectShanghai(lastThreeThrows: ReadonlyArray<ThrowRecord>): boolean {
  if (lastThreeThrows.length !== 3) return false;

  const multipliers = new Set<number>();
  let targetNumber: number | null = null;

  for (const t of lastThreeThrows) {
    if (typeof t.segment !== "number") return false;
    if (t.segment < 1 || t.segment > 20) return false;
    if (targetNumber === null) {
      targetNumber = t.segment;
    } else if (t.segment !== targetNumber) {
      return false;
    }
    multipliers.add(t.multiplier);
  }

  return multipliers.size === 3;
}

export const shanghaiSetting: SettingDefinition = {
  key: "shanghai",
  label: "Shanghai (instant win)",
  type: "toggle",
  default: false,
};
