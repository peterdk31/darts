import { storage, StorageCorruptError } from "@/shared/storage";

export type BoardTheme = "traditional" | "desaturated";
export type BoardLayout = "classic" | "grid" | "quick";

export interface UserPrefs {
  boardTheme: BoardTheme;
  boardLayout: BoardLayout;
}

export const PREFS_SCHEMA_VERSION = 1;

const DEFAULT_PREFS: UserPrefs = {
  boardTheme: "traditional",
  boardLayout: "classic",
};

export function loadPrefs(): UserPrefs {
  try {
    const rec = storage.read<UserPrefs>("prefs");
    if (!rec) return { ...DEFAULT_PREFS };
    const data = rec.data;
    return {
      boardTheme:
        data?.boardTheme === "desaturated" ? "desaturated" : "traditional",
      boardLayout:
        data?.boardLayout === "grid" ? "grid" : data?.boardLayout === "quick" ? "quick" : "classic",
    };
  } catch (err) {
    if (err instanceof StorageCorruptError) {
      // Treat corrupt prefs as default; non-fatal.
      return { ...DEFAULT_PREFS };
    }
    throw err;
  }
}

export function savePrefs(prefs: UserPrefs): void {
  storage.write<UserPrefs>("prefs", {
    schemaVersion: PREFS_SCHEMA_VERSION,
    data: prefs,
  });
}

export function setBoardTheme(theme: BoardTheme): UserPrefs {
  const current = loadPrefs();
  const next: UserPrefs = { ...current, boardTheme: theme };
  try {
    savePrefs(next);
  } catch {
    // Quota / unsupported on prefs is non-fatal — caller still gets the in-memory pref.
  }
  return next;
}
