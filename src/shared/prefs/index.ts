import { storage, StorageCorruptError } from "@/shared/storage";

export type BoardLayout = "classic" | "grid" | "quick";
export type AppTheme = "system" | "light" | "dark";

export interface UserPrefs {
  boardLayout: BoardLayout;
  appTheme: AppTheme;
}

export const PREFS_SCHEMA_VERSION = 1;

const DEFAULT_PREFS: UserPrefs = {
  boardLayout: "classic",
  appTheme: "system",
};

export function loadPrefs(): UserPrefs {
  try {
    const rec = storage.read<UserPrefs>("prefs");
    if (!rec) return { ...DEFAULT_PREFS };
    const data = rec.data;
    const appTheme = data?.appTheme === "light" || data?.appTheme === "dark" ? data.appTheme : "system";
    return {
      boardLayout:
        data?.boardLayout === "grid" ? "grid" : data?.boardLayout === "quick" ? "quick" : "classic",
      appTheme,
    };
  } catch (err) {
    if (err instanceof StorageCorruptError) {
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

export function applyAppTheme(theme: AppTheme): void {
  const root = document.documentElement;
  if (theme === "system") {
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", theme);
  }
}
