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
import type { SessionState } from "./types";
import type { SessionDescriptor } from "./sessionDescriptor";
import {
  loadSessionById,
  loadSessionList,
  saveSessionList,
  saveSessionState,
  deleteSessionData,
} from "./sessionsStorage";

interface SessionContextValue {
  activeSession: SessionDescriptor | null;
  sessions: SessionDescriptor[];
  openSession: (id: string) => void;
  createSession: (name: string) => string;
  deleteSession: (id: string) => void;
  leaveSession: () => void;
  state: SessionState;
  dispatch: (a: SessionAction) => void;
  prefs: UserPrefs;
  setPrefs: (next: UserPrefs) => void;
  reportStorageError: (err: unknown) => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

const ACTIVE_SESSION_KEY = "darts:activeSessionId";

export function SessionProvider({ children }: { children: ReactNode }) {
  const [initialData] = useState(() => {
    const sessions = loadSessionList();
    let restore: { id: string; state: SessionState } | null = null;
    try {
      const id = localStorage.getItem(ACTIVE_SESSION_KEY);
      if (id && sessions.some((s) => s.id === id)) {
        restore = { id, state: loadSessionById(id) };
      } else if (id) {
        localStorage.removeItem(ACTIVE_SESSION_KEY);
      }
    } catch { /* ignore */ }
    return { sessions, restore };
  });

  const [sessions, setSessions] = useState(initialData.sessions);
  const [activeSessionId, setActiveSessionIdRaw] = useState<string | null>(
    initialData.restore?.id ?? null,
  );
  const [state, dispatch] = useReducer(
    sessionReducer,
    initialData.restore?.state ?? initialSessionState,
  );
  const [hydrated, setHydrated] = useState(initialData.restore !== null);
  const [prefs, setPrefsState] = useState<UserPrefs>(() => loadPrefs());
  const [quotaError, setQuotaError] = useState<{ namespace: StorageNamespace } | null>(null);
  const prevState = useRef<SessionState | null>(
    initialData.restore?.state ?? null,
  );

  const setActiveSessionId = useCallback((id: string | null) => {
    setActiveSessionIdRaw(id);
    try {
      if (id) localStorage.setItem(ACTIVE_SESSION_KEY, id);
      else localStorage.removeItem(ACTIVE_SESSION_KEY);
    } catch { /* ignore */ }
  }, []);

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId) ?? null,
    [sessions, activeSessionId],
  );

  const openSession = useCallback((id: string) => {
    try {
      const loaded = loadSessionById(id);
      dispatch({ type: "hydrate", state: loaded });
    } catch (err) {
      if (!(err instanceof StorageUnsupportedError)) throw err;
    }
    setActiveSessionId(id);
    setHydrated(true);
    prevState.current = null;
  }, [setActiveSessionId]);

  const createSession = useCallback((name: string): string => {
    const id = crypto.randomUUID();
    const descriptor: SessionDescriptor = {
      id,
      name,
      createdAt: new Date().toISOString(),
    };
    const next = [descriptor, ...sessions];
    setSessions(next);
    try {
      saveSessionList(next);
    } catch (err) {
      if (err instanceof StorageQuotaError) {
        setQuotaError({ namespace: err.namespace });
      }
    }
    dispatch({ type: "hydrate", state: initialSessionState });
    setActiveSessionId(id);
    setHydrated(true);
    prevState.current = null;
    return id;
  }, [sessions, setActiveSessionId]);

  const deleteSession = useCallback((id: string) => {
    deleteSessionData(id);
    const next = sessions.filter((s) => s.id !== id);
    setSessions(next);
    try {
      saveSessionList(next);
    } catch { /* ignore */ }
    if (activeSessionId === id) {
      setActiveSessionId(null);
      dispatch({ type: "hydrate", state: initialSessionState });
      setHydrated(false);
      prevState.current = null;
    }
  }, [sessions, activeSessionId, setActiveSessionId]);

  const leaveSession = useCallback(() => {
    setActiveSessionId(null);
    dispatch({ type: "hydrate", state: initialSessionState });
    setHydrated(false);
    prevState.current = null;
  }, [setActiveSessionId]);

  // Persist session state changes.
  useEffect(() => {
    if (!hydrated || !activeSessionId) {
      prevState.current = state;
      return;
    }
    const prev = prevState.current;
    prevState.current = state;
    try {
      saveSessionState(activeSessionId, state, prev);
    } catch (err) {
      if (err instanceof StorageQuotaError) {
        setQuotaError({ namespace: err.namespace });
      } else if (err instanceof StorageUnsupportedError) {
        // ignore
      } else {
        throw err;
      }
    }
  }, [state, hydrated, activeSessionId]);

  const setPrefs = useCallback((next: UserPrefs) => {
    setPrefsState(next);
    try {
      savePrefs({ ...next });
    } catch (err) {
      if (err instanceof StorageQuotaError) {
        setQuotaError({ namespace: err.namespace });
      }
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
    if (activeSessionId) {
      try {
        storage.replaceList(`sess:${activeSessionId}:history` as StorageNamespace, []);
      } catch { /* ignore */ }
    }
    dispatch({
      type: "hydrate",
      state: { ...state, history: [] },
    });
    setQuotaError(null);
  }, [state, activeSessionId]);

  const value = useMemo<SessionContextValue>(
    () => ({
      activeSession,
      sessions,
      openSession,
      createSession,
      deleteSession,
      leaveSession,
      state,
      dispatch,
      prefs,
      setPrefs,
      reportStorageError,
    }),
    [activeSession, sessions, openSession, createSession, deleteSession, leaveSession, state, prefs, setPrefs, reportStorageError],
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
