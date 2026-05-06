import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  storage,
  StorageCorruptError,
  StorageQuotaError,
  StorageUnsupportedError,
  type StorageNamespace,
} from "@/shared/storage";
import { loadPrefs, savePrefs, type UserPrefs } from "@/shared/prefs";
import { QuotaExceededModal } from "@/shared/components/QuotaExceededModal";
import {
  initialSessionState,
  sessionReducer,
  type SessionAction,
} from "./sessionReducer";
import {
  HISTORY_RECORD_SCHEMA_VERSION,
  IN_PROGRESS_SCHEMA_VERSION,
  SESSION_SCHEMA_VERSION,
  type CompletedGameRecord,
  type InProgressGame,
  type SessionState,
} from "./types";
import type { Team } from "@/shared/types/core";

interface PersistedSessionShellState {
  teams: Team[];
}

interface SessionContextValue {
  state: SessionState;
  dispatch: (a: SessionAction) => void;
  prefs: UserPrefs;
  setPrefs: (next: UserPrefs) => void;
  /** Surfaces a typed quota error to the modal. */
  reportStorageError: (err: unknown) => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

function loadSessionState(): SessionState {
  let teams: Team[] = [];
  let inProgressGame: InProgressGame | null = null;
  let history: CompletedGameRecord[] = [];

  try {
    const sess = storage.read<PersistedSessionShellState>("session");
    if (sess?.data?.teams && Array.isArray(sess.data.teams)) {
      teams = sess.data.teams;
    }
  } catch (err) {
    if (!(err instanceof StorageCorruptError)) throw err;
  }

  try {
    const ip = storage.read<InProgressGame>("inProgressGame");
    if (ip?.data) inProgressGame = ip.data;
  } catch (err) {
    if (err instanceof StorageCorruptError) {
      // Discard corrupt in-progress game silently — user starts fresh.
      try {
        storage.remove("inProgressGame");
      } catch {
        // ignore
      }
    } else {
      throw err;
    }
  }

  try {
    const list = storage.readList<CompletedGameRecord>("history");
    history = list.map((rec) => rec.data);
  } catch (err) {
    if (!(err instanceof StorageCorruptError)) throw err;
    // Treat corrupt history as empty but DO NOT overwrite (preserve recovery).
  }

  return { teams, inProgressGame, history };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(sessionReducer, initialSessionState);
  const [hydrated, setHydrated] = useState(false);
  const [prefs, setPrefsState] = useState<UserPrefs>(() => loadPrefs());
  const [quotaError, setQuotaError] = useState<{ namespace: StorageNamespace } | null>(null);
  const prevState = useRef<SessionState | null>(null);

  // Hydrate once on mount.
  useEffect(() => {
    try {
      const loaded = loadSessionState();
      dispatch({ type: "hydrate", state: loaded });
    } catch (err) {
      if (err instanceof StorageUnsupportedError) {
        // Persistence unavailable; proceed with in-memory only.
      } else {
        throw err;
      }
    } finally {
      setHydrated(true);
    }
  }, []);

  // Persist whenever state changes (post-hydration).
  useEffect(() => {
    if (!hydrated) {
      prevState.current = state;
      return;
    }
    const prev = prevState.current;
    prevState.current = state;
    try {
      // session
      if (!prev || prev.teams !== state.teams) {
        storage.write<PersistedSessionShellState>("session", {
          schemaVersion: SESSION_SCHEMA_VERSION,
          data: { teams: state.teams },
        });
      }
      // inProgressGame
      if (!prev || prev.inProgressGame !== state.inProgressGame) {
        if (state.inProgressGame) {
          storage.write<InProgressGame>("inProgressGame", {
            schemaVersion: IN_PROGRESS_SCHEMA_VERSION,
            data: state.inProgressGame,
          });
        } else if (prev?.inProgressGame) {
          storage.remove("inProgressGame");
        }
      }
      // history
      if (!prev || prev.history !== state.history) {
        const wrapped = state.history.map((data) => ({
          schemaVersion: HISTORY_RECORD_SCHEMA_VERSION,
          data,
        }));
        storage.replaceList<CompletedGameRecord>("history", wrapped);
      }
    } catch (err) {
      if (err instanceof StorageQuotaError) {
        setQuotaError({ namespace: err.namespace });
      } else if (err instanceof StorageUnsupportedError) {
        // ignore — degrades to in-memory only
      } else {
        throw err;
      }
    }
  }, [state, hydrated]);

  const setPrefs = useCallback((next: UserPrefs) => {
    setPrefsState(next);
    try {
      savePrefs({ ...next });
    } catch (err) {
      if (err instanceof StorageQuotaError) {
        setQuotaError({ namespace: err.namespace });
      }
      // unsupported: ignore
    }
  }, []);

  const reportStorageError = useCallback((err: unknown) => {
    if (err instanceof StorageQuotaError) {
      setQuotaError({ namespace: err.namespace });
    }
  }, []);

  const handleAcknowledgeQuota = useCallback(() => {
    setQuotaError(null);
  }, []);

  const handleClearHistory = useCallback(() => {
    try {
      storage.replaceList("history", []);
    } catch {
      // ignore — best effort
    }
    // Update in-memory state to match.
    dispatch({
      type: "hydrate",
      state: { ...state, history: [] },
    });
    setQuotaError(null);
  }, [state]);

  const value = useMemo<SessionContextValue>(
    () => ({ state, dispatch, prefs, setPrefs, reportStorageError }),
    [state, prefs, setPrefs, reportStorageError],
  );

  return (
    <SessionContext.Provider value={value}>
      {children}
      <QuotaExceededModal
        open={quotaError !== null}
        onAcknowledge={handleAcknowledgeQuota}
        onClearHistory={handleClearHistory}
      />
    </SessionContext.Provider>
  );
}

export function useSessionContext(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSessionContext must be used within SessionProvider");
  return ctx;
}
