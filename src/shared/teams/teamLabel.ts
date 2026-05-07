import type { TeamColorId } from "@/shared/types/core";
import { COLOR_LABELS } from "@/shared/teams/colors";

export function getTeamLabel(team: {
  colorId: TeamColorId;
  players: ReadonlyArray<{ displayName: string }>;
}): string {
  if (team.players.length === 1) return team.players[0]!.displayName;
  return `${COLOR_LABELS[team.colorId]} Team`;
}
