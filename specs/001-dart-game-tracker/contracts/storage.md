# Contract: Storage Abstraction

**Feature**: 001-dart-game-tracker
**Audience**: every caller that needs to read or write persisted data — i.e. the shell and any game module.
**Authority**: Constitution Principle IV (Local-First Persistence). Gate IV.a forbids direct `localStorage.*` calls outside this layer.

This is the only API for persistent storage. The driver (localStorage in v1, possibly IndexedDB later) is hidden behind it.

---

## Module location

```text
src/shared/storage/
├── index.ts            # public API (this contract)
├── localStorageDriver.ts  # v1 driver implementation
├── errors.ts           # typed errors
└── types.ts            # versioned envelope and namespace key types
```

---

## TypeScript surface

```ts
/** Discriminator for namespaces. The shell registers its namespaces; each game module registers `game:<id>`. */
export type StorageNamespace =
  | "session"
  | "inProgressGame"
  | "history"
  | `game:${string}`;

/** Every persisted record is wrapped in this envelope. The driver reads/writes envelopes; callers see only `data`. */
export interface VersionedRecord<T> {
  schemaVersion: number;
  data: T;
}

/** Errors. */
export class StorageQuotaError extends Error { kind: "quota"; namespace: StorageNamespace; }
export class StorageCorruptError extends Error { kind: "corrupt"; namespace: StorageNamespace; raw: string; }
export class StorageUnsupportedError extends Error { kind: "unsupported"; }

/** Public API. All operations are synchronous in v1 (localStorage is sync). The signature is async-ready so an IndexedDB swap is a non-breaking driver change. */
export interface Storage {
  /**
   * Read a singleton namespace. Returns `null` if the namespace is empty.
   * @throws StorageCorruptError if the stored payload cannot be parsed or its schemaVersion is unknown.
   */
  read<T>(namespace: "session" | "inProgressGame" | `game:${string}`): VersionedRecord<T> | null;

  /**
   * Read a list namespace. Returns `[]` when nothing has been written.
   * @throws StorageCorruptError on parse failure.
   */
  readList<T>(namespace: "history"): VersionedRecord<T>[];

  /**
   * Write a singleton namespace. Replaces any prior value.
   * @throws StorageQuotaError when storage quota is exceeded — caller MUST surface a clear, non-dismissable-until-acknowledged error per FR-027a.
   */
  write<T>(namespace: "session" | "inProgressGame" | `game:${string}`, record: VersionedRecord<T>): void;

  /**
   * Append a record to a list namespace.
   * @throws StorageQuotaError on quota exhaustion. Caller MUST NOT silently drop entries — FR-027a.
   */
  appendToList<T>(namespace: "history", record: VersionedRecord<T>): void;

  /** Replace an entire list namespace with the given records (used by "Clear history" and migrations). */
  replaceList<T>(namespace: "history", records: VersionedRecord<T>[]): void;

  /** Delete a singleton namespace's value (e.g., when an in-progress game is abandoned per FR-022a). Idempotent. */
  remove(namespace: "session" | "inProgressGame" | `game:${string}`): void;

  /** Detect whether persistence is available at all. Returns false in environments where localStorage is disabled (private browsing in some browsers). */
  isAvailable(): boolean;
}
```

---

## Required behaviour

1. **Sole access surface** — every read or write of persisted data MUST go through this module (Gate IV.a). PR review enforces. There is no permitted alternative path.
2. **Versioned envelopes** — every record passes through this layer wrapped in `VersionedRecord<T>`. Callers MUST set `schemaVersion` to their current schema version when writing. Readers MUST decide on the returned `schemaVersion` whether to migrate or treat as future-unknown.
3. **Quota errors are loud** — on `QuotaExceededError` from the underlying driver, the storage layer MUST throw `StorageQuotaError` typed by namespace. Calling code MUST surface this to the user (the shell shows a modal — FR-027a). The storage layer MUST NOT silently evict or auto-purge.
4. **Corrupt data is recoverable** — on parse failure or unknown shape, throw `StorageCorruptError`. Callers decide whether to treat as empty (e.g., the in-progress game) or read-only (history).
5. **No PII off-device** — this layer makes no network calls. Ever.
6. **Sync-shaped API** — v1 driver is synchronous (`localStorage`). Returning plain values keeps call sites simple. If swapped to IndexedDB later, the API will become `Promise<...>` — that is a single coordinated change at the storage boundary.

---

## Namespace ownership

| Namespace          | Cardinality | Owner            | Notes |
|--------------------|-------------|------------------|-------|
| `session`          | singleton   | shell            | Last-edited teams + in-progress pointer. |
| `inProgressGame`   | singleton   | shell            | Removed on game completion or abandonment. |
| `history`          | list        | shell            | Append-only during play; full replace allowed only via "Clear history". |
| `game:<gameTypeId>`| singleton   | corresponding game module | Optional. Most modules will not need it — engine state lives inside `inProgressGame`. |

A game module MUST NOT read or write outside `game:<its own id>`. The shell MUST NOT read or write inside `game:<...>` namespaces.

---

## Error-handling contract for callers

Callers of `write` / `appendToList` MUST `try`/`catch` and react as follows:

```ts
try {
  storage.appendToList("history", { schemaVersion: HISTORY_VERSION, data: completedGame });
} catch (err) {
  if (err instanceof StorageQuotaError) {
    showQuotaExceededModal(err.namespace); // see FR-027a contract
    return;
  }
  if (err instanceof StorageUnsupportedError) {
    showUnsupportedStorageMessage();       // graceful degrade per Gate IV.c
    return;
  }
  throw err; // genuinely unexpected — let it bubble
}
```

Callers of `read` / `readList` MUST handle `StorageCorruptError`:

- For `inProgressGame`: prompt the user to discard and start fresh.
- For `history`: treat as read-only/empty, surface a non-fatal warning. Do not overwrite (would lose recoverable data).
- For `session`: treat as empty (initial state).
