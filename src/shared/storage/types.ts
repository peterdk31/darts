export type StorageNamespace =
  | "session"
  | "inProgressGame"
  | "history"
  | "prefs"
  | `game:${string}`;

export interface VersionedRecord<T> {
  schemaVersion: number;
  data: T;
}
