import {
  StorageCorruptError,
  StorageQuotaError,
  StorageUnsupportedError,
} from "./errors";
import type { StorageNamespace, VersionedRecord } from "./types";

const KEY_PREFIX = "darts:";

function key(namespace: StorageNamespace): string {
  return `${KEY_PREFIX}${namespace}`;
}

function isQuotaError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  // Standard DOMException name
  if (err.name === "QuotaExceededError") return true;
  // Old Firefox
  if (err.name === "NS_ERROR_DOM_QUOTA_REACHED") return true;
  // Some browsers include the word in the message
  return /quota/i.test(err.message);
}

function safeStorage(): Storage {
  try {
    if (typeof globalThis === "undefined" || !globalThis.localStorage) {
      throw new StorageUnsupportedError();
    }
    // Probe — some browsers (private mode) will throw on write.
    const probe = `${KEY_PREFIX}__probe__`;
    globalThis.localStorage.setItem(probe, "1");
    globalThis.localStorage.removeItem(probe);
    return globalThis.localStorage;
  } catch (err) {
    if (err instanceof StorageUnsupportedError) throw err;
    throw new StorageUnsupportedError(
      `localStorage unavailable: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export const localStorageDriver = {
  isAvailable(): boolean {
    try {
      safeStorage();
      return true;
    } catch {
      return false;
    }
  },

  read<T>(namespace: StorageNamespace): VersionedRecord<T> | null {
    const ls = safeStorage();
    const raw = ls.getItem(key(namespace));
    if (raw === null) return null;
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (
        !parsed ||
        typeof parsed !== "object" ||
        typeof (parsed as Record<string, unknown>)["schemaVersion"] !== "number" ||
        !("data" in (parsed as Record<string, unknown>))
      ) {
        throw new Error("Missing schemaVersion or data");
      }
      return parsed as VersionedRecord<T>;
    } catch (err) {
      throw new StorageCorruptError(
        namespace,
        raw,
        `Failed to parse: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  },

  readList<T>(namespace: StorageNamespace): VersionedRecord<T>[] {
    const ls = safeStorage();
    const raw = ls.getItem(key(namespace));
    if (raw === null) return [];
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) throw new Error("Expected array");
      return parsed as VersionedRecord<T>[];
    } catch (err) {
      throw new StorageCorruptError(
        namespace,
        raw,
        `Failed to parse list: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  },

  write<T>(namespace: StorageNamespace, record: VersionedRecord<T>): void {
    const ls = safeStorage();
    try {
      ls.setItem(key(namespace), JSON.stringify(record));
    } catch (err) {
      if (isQuotaError(err)) throw new StorageQuotaError(namespace);
      throw err;
    }
  },

  appendToList<T>(namespace: StorageNamespace, record: VersionedRecord<T>): void {
    const ls = safeStorage();
    const existing = this.readList<T>(namespace);
    existing.push(record);
    try {
      ls.setItem(key(namespace), JSON.stringify(existing));
    } catch (err) {
      if (isQuotaError(err)) throw new StorageQuotaError(namespace);
      throw err;
    }
  },

  replaceList<T>(namespace: StorageNamespace, records: VersionedRecord<T>[]): void {
    const ls = safeStorage();
    try {
      ls.setItem(key(namespace), JSON.stringify(records));
    } catch (err) {
      if (isQuotaError(err)) throw new StorageQuotaError(namespace);
      throw err;
    }
  },

  remove(namespace: StorageNamespace): void {
    const ls = safeStorage();
    ls.removeItem(key(namespace));
  },
};
