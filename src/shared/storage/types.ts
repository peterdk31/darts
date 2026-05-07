export type StorageNamespace =
  | "session"
  | "sessions"
  | "inProgressGame"
  | "history"
  | "prefs"
  | "players"
  | "teams"
  | `sess:${string}:session`
  | `sess:${string}:inProgressGame`
  | `sess:${string}:history`
  | `game:${string}`;

export interface VersionedRecord<T> {
  schemaVersion: number;
  data: T;
}
