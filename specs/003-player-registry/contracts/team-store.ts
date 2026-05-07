/**
 * Contract: Team Store
 *
 * Public interface for persistent team CRUD operations.
 * Implementation lives at src/shell/teams/teamStore.ts.
 * Consumed by: TeamSetupPage, TeamStatsView.
 */

import type { TeamColorId, Team, Player } from "../../../src/shared/types/core";
import type { RosterPlayer } from "./player-store";

export interface PersistedTeam {
  id: string;
  displayName: string;
  colorId: TeamColorId;
  playerIds: string[];
}

export interface TeamStore {
  /** Returns all persistent teams. */
  getAll(): PersistedTeam[];

  /** Creates a new team. Throws if team count >= 8 or name is empty. */
  add(displayName: string, colorId: TeamColorId): PersistedTeam;

  /** Renames an existing team. */
  rename(teamId: string, displayName: string): void;

  /** Changes a team's color. */
  setColor(teamId: string, colorId: TeamColorId): void;

  /** Assigns a player to a team. Throws if player already on another team or team full. */
  assignPlayer(teamId: string, playerId: string): void;

  /** Removes a player from a team. */
  unassignPlayer(teamId: string, playerId: string): void;

  /** Removes a team entirely. */
  remove(teamId: string): void;

  /**
   * Resolves a PersistedTeam to a full Team (with expanded Player objects)
   * suitable for passing to game engines. Used at game-start snapshot time.
   */
  resolve(team: PersistedTeam, roster: RosterPlayer[]): Team;

  /** Checks if a player ID is assigned to any team. */
  isPlayerAssigned(playerId: string): boolean;

  /** Looks up a single team by ID. */
  getById(teamId: string): PersistedTeam | undefined;
}
