import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  StorageCorruptError,
  StorageQuotaError,
  storage,
  type VersionedRecord,
} from "@/shared/storage";

interface Sample {
  foo: string;
  count: number;
}

const NS = "prefs" as const;
const KEY = "darts:prefs";

describe("localStorage driver", () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.localStorage.clear();
  });

  describe("isAvailable", () => {
    it("returns true under jsdom", () => {
      expect(storage.isAvailable()).toBe(true);
    });
  });

  describe("read / write round-trip", () => {
    it("reads back the same record that was written", () => {
      const record: VersionedRecord<Sample> = {
        schemaVersion: 1,
        data: { foo: "hello", count: 42 },
      };
      storage.write<Sample>(NS, record);
      const read = storage.read<Sample>(NS);
      expect(read).toEqual(record);
    });

    it("returns null when the namespace has no record", () => {
      expect(storage.read<Sample>(NS)).toBeNull();
    });

    it("remove deletes the record", () => {
      storage.write<Sample>(NS, { schemaVersion: 1, data: { foo: "x", count: 1 } });
      storage.remove(NS);
      expect(storage.read<Sample>(NS)).toBeNull();
    });
  });

  describe("list operations", () => {
    it("readList returns [] when empty", () => {
      expect(storage.readList<Sample>("history")).toEqual([]);
    });

    it("appendToList accumulates records", () => {
      storage.appendToList<Sample>("history", {
        schemaVersion: 1,
        data: { foo: "a", count: 1 },
      });
      storage.appendToList<Sample>("history", {
        schemaVersion: 1,
        data: { foo: "b", count: 2 },
      });
      const list = storage.readList<Sample>("history");
      expect(list).toHaveLength(2);
      expect(list[0]!.data.foo).toBe("a");
      expect(list[1]!.data.foo).toBe("b");
    });

    it("replaceList overwrites the entire list", () => {
      storage.appendToList<Sample>("history", {
        schemaVersion: 1,
        data: { foo: "a", count: 1 },
      });
      storage.replaceList<Sample>("history", []);
      expect(storage.readList<Sample>("history")).toEqual([]);
    });
  });

  describe("StorageQuotaError", () => {
    it("write throws StorageQuotaError when localStorage rejects with QuotaExceededError", () => {
      const setItem = vi.spyOn(Storage.prototype, "setItem");
      setItem.mockImplementation(function (k: string, _v: string) {
        // Allow the safeStorage() probe; reject every other write.
        if (k.endsWith("__probe__")) return;
        const err = new Error("Quota") as Error & { name: string };
        err.name = "QuotaExceededError";
        throw err;
      });

      expect(() =>
        storage.write<Sample>(NS, { schemaVersion: 1, data: { foo: "x", count: 1 } }),
      ).toThrow(StorageQuotaError);
    });

    it("appendToList throws StorageQuotaError on quota", () => {
      const setItem = vi.spyOn(Storage.prototype, "setItem");
      setItem.mockImplementation(function (k: string, _v: string) {
        if (k.endsWith("__probe__")) return;
        const err = new Error("Quota") as Error & { name: string };
        err.name = "QuotaExceededError";
        throw err;
      });

      expect(() =>
        storage.appendToList<Sample>("history", {
          schemaVersion: 1,
          data: { foo: "x", count: 1 },
        }),
      ).toThrow(StorageQuotaError);
    });

    it("write maps quota messages without QuotaExceededError name", () => {
      const setItem = vi.spyOn(Storage.prototype, "setItem");
      setItem.mockImplementation(function (k: string, _v: string) {
        if (k.endsWith("__probe__")) return;
        throw new Error("Persistence quota reached");
      });
      expect(() =>
        storage.write<Sample>(NS, { schemaVersion: 1, data: { foo: "x", count: 1 } }),
      ).toThrow(StorageQuotaError);
    });
  });

  describe("StorageCorruptError", () => {
    it("read throws StorageCorruptError on malformed JSON", () => {
      globalThis.localStorage.setItem(KEY, "{not valid json");
      expect(() => storage.read<Sample>(NS)).toThrow(StorageCorruptError);
    });

    it("read throws StorageCorruptError on payload missing schemaVersion", () => {
      globalThis.localStorage.setItem(KEY, JSON.stringify({ data: { foo: "x" } }));
      expect(() => storage.read<Sample>(NS)).toThrow(StorageCorruptError);
    });

    it("read throws StorageCorruptError on payload missing data field", () => {
      globalThis.localStorage.setItem(KEY, JSON.stringify({ schemaVersion: 1 }));
      expect(() => storage.read<Sample>(NS)).toThrow(StorageCorruptError);
    });

    it("readList throws StorageCorruptError when payload is not an array", () => {
      globalThis.localStorage.setItem("darts:history", JSON.stringify({ not: "array" }));
      expect(() => storage.readList<Sample>("history")).toThrow(StorageCorruptError);
    });
  });

  describe("unknown schemaVersion", () => {
    it("read returns the record verbatim — caller decides how to migrate", () => {
      // Storage layer is version-agnostic: it preserves whatever schemaVersion was written.
      // Forward-migration is the caller's responsibility per Constitution Principle IV.
      const future: VersionedRecord<Sample> = {
        schemaVersion: 99,
        data: { foo: "future", count: 7 },
      };
      storage.write<Sample>(NS, future);
      const read = storage.read<Sample>(NS);
      expect(read).not.toBeNull();
      expect(read!.schemaVersion).toBe(99);
      expect(read!.data).toEqual(future.data);
    });
  });
});
