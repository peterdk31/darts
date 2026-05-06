import type { Team, TeamColorId } from "@/shared/types/core";

export const TEAM_COLORS: readonly TeamColorId[] = [
  "red",
  "green",
  "orange",
  "purple",
  "teal",
  "pink",
  "yellow",
  "cyan",
];

export function assignNextColor(existingTeams: ReadonlyArray<Team>): TeamColorId {
  const used = new Set<TeamColorId>(existingTeams.map((t) => t.colorId));
  for (const c of TEAM_COLORS) {
    if (!used.has(c)) return c;
  }
  // 8 teams cap means we reach here only if all 8 are taken.
  return TEAM_COLORS[0]!;
}
