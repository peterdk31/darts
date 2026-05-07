/**
 * Contract: Storage Namespace Extensions
 *
 * Documents the new StorageNamespace values introduced by this feature.
 * The actual type lives at src/shared/storage/types.ts.
 */

/**
 * Extended StorageNamespace union after this feature:
 *
 * Existing:
 *   "session" | "inProgressGame" | "history" | "prefs" | `game:${string}`
 *
 * Added:
 *   "players" | "teams"
 *
 * localStorage keys:
 *   "darts:players" → VersionedRecord<RosterPlayer[]>
 *   "darts:teams"   → VersionedRecord<PersistedTeam[]>
 */
export type ExtendedStorageNamespace =
  | "session"
  | "inProgressGame"
  | "history"
  | "prefs"
  | "players"
  | "teams"
  | `game:${string}`;
