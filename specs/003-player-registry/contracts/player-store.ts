/**
 * Contract: Player Store
 *
 * Public interface for the player roster CRUD operations.
 * Implementation lives at src/shell/players/playerStore.ts.
 * Consumed by: PlayersPage, TeamSetupPage, PlayerStatsView.
 */

export interface RosterPlayer {
  id: string;
  displayName: string;
  createdAt: string;
  deletedAt: string | null;
}

export interface PlayerStore {
  /** Returns all roster players including soft-deleted. */
  getAll(): RosterPlayer[];

  /** Returns only active (non-deleted) players. */
  getActive(): RosterPlayer[];

  /** Returns only soft-deleted players. */
  getDeleted(): RosterPlayer[];

  /** Adds a new player. Throws if active count >= 20 or name is empty. */
  add(displayName: string): RosterPlayer;

  /** Renames an existing player. Throws if player not found or name is empty. */
  rename(playerId: string, displayName: string): void;

  /** Soft-deletes a player. Throws if player is assigned to any team. */
  remove(playerId: string): void;

  /** Restores a soft-deleted player. Throws if active count >= 20. */
  restore(playerId: string): void;

  /** Looks up a single player by ID (active or deleted). */
  getById(playerId: string): RosterPlayer | undefined;
}
