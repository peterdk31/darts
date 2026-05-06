import { localStorageDriver } from "./localStorageDriver";

export { StorageQuotaError, StorageCorruptError, StorageUnsupportedError } from "./errors";
export type { StorageNamespace, VersionedRecord } from "./types";

export const storage = localStorageDriver;
