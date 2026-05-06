import type { StorageNamespace } from "./types";

export class StorageQuotaError extends Error {
  readonly kind = "quota" as const;
  readonly namespace: StorageNamespace;
  constructor(namespace: StorageNamespace, message?: string) {
    super(message ?? `Storage quota exceeded for namespace "${namespace}"`);
    this.name = "StorageQuotaError";
    this.namespace = namespace;
  }
}

export class StorageCorruptError extends Error {
  readonly kind = "corrupt" as const;
  readonly namespace: StorageNamespace;
  readonly raw: string;
  constructor(namespace: StorageNamespace, raw: string, message?: string) {
    super(message ?? `Corrupt storage payload in namespace "${namespace}"`);
    this.name = "StorageCorruptError";
    this.namespace = namespace;
    this.raw = raw;
  }
}

export class StorageUnsupportedError extends Error {
  readonly kind = "unsupported" as const;
  constructor(message?: string) {
    super(message ?? "Persistent storage is unavailable");
    this.name = "StorageUnsupportedError";
  }
}
