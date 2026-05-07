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

export const COLOR_LABELS: Record<TeamColorId, string> = {
  red: "Red",
  green: "Green",
  orange: "Orange",
  purple: "Purple",
  teal: "Teal",
  pink: "Pink",
  yellow: "Yellow",
  cyan: "Cyan",
};

export function assignNextColor(existingTeams: ReadonlyArray<Team>): TeamColorId {
  const used = new Set<TeamColorId>(existingTeams.map((t) => t.colorId));
  for (const c of TEAM_COLORS) {
    if (!used.has(c)) return c;
  }
  return TEAM_COLORS[0]!;
}
