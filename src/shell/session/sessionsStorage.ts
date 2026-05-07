import { storage, StorageCorruptError } from "@/shared/storage";
import type { StorageNamespace } from "@/shared/storage/types";
import {
  SESSIONS_SCHEMA_VERSION,
  type SessionDescriptor,
} from "./sessionDescriptor";
import type { CompletedGameRecord, InProgressGame, SessionState } from "./types";
import {
  HISTORY_RECORD_SCHEMA_VERSION,
  IN_PROGRESS_SCHEMA_VERSION,
  SESSION_SCHEMA_VERSION,
} from "./types";
import type { Team } from "@/shared/types/core";

interface PersistedSessionShellState {
  teams: Team[];
}

function ns(sessionId: string, suffix: string): StorageNamespace {
  return `sess:${sessionId}:${suffix}` as StorageNamespace;
}

function migrateLegacySession(): void {
  const existing = storage.read<SessionDescriptor[]>("sessions");
  if (existing !== null) return;

  let hasLegacyData = false;
  try {
    const sess = storage.read<{ teams: Team[] }>("session");
    if (sess?.data?.teams?.length) hasLegacyData = true;
  } catch { /* ignore */ }
  if (!hasLegacyData) {
    try {
      const ip = storage.read<InProgressGame>("inProgressGame");
      if (ip?.data) hasLegacyData = true;
    } catch { /* ignore */ }
  }
  if (!hasLegacyData) {
    try {
      const list = storage.readList<CompletedGameRecord>("history");
      if (list.length > 0) hasLegacyData = true;
    } catch { /* ignore */ }
  }

  if (!hasLegacyData) return;

  const id = crypto.randomUUID();
  const descriptor: SessionDescriptor = {
    id,
    name: "Previous session",
    createdAt: new Date().toISOString(),
  };

  // Copy legacy keys into the session-scoped namespace
  try {
    const sess = storage.read<{ teams: Team[] }>("session");
    if (sess) storage.write(ns(id, "session"), sess);
  } catch { /* ignore */ }
  try {
    const ip = storage.read<InProgressGame>("inProgressGame");
    if (ip) storage.write(ns(id, "inProgressGame"), ip);
  } catch { /* ignore */ }
  try {
    const raw = storage.readList<CompletedGameRecord>("history");
    if (raw.length > 0) storage.replaceList(ns(id, "history"), raw);
  } catch { /* ignore */ }

  saveSessionList([descriptor]);

  // Clean up legacy keys
  try { storage.remove("session"); } catch { /* ignore */ }
  try { storage.remove("inProgressGame"); } catch { /* ignore */ }
  try { storage.remove("history"); } catch { /* ignore */ }
}

export function loadSessionList(): SessionDescriptor[] {
  migrateLegacySession();
  try {
    const rec = storage.read<SessionDescriptor[]>("sessions");
    if (rec?.data && Array.isArray(rec.data)) return rec.data;
  } catch (err) {
    if (!(err instanceof StorageCorruptError)) throw err;
  }
  return [];
}

export function saveSessionList(sessions: SessionDescriptor[]): void {
  storage.write<SessionDescriptor[]>("sessions", {
    schemaVersion: SESSIONS_SCHEMA_VERSION,
    data: sessions,
  });
}

export function loadSessionById(sessionId: string): SessionState {
  let teams: Team[] = [];
  let inProgressGame: InProgressGame | null = null;
  let history: CompletedGameRecord[] = [];

  try {
    const sess = storage.read<PersistedSessionShellState>(ns(sessionId, "session"));
    if (sess?.data?.teams && Array.isArray(sess.data.teams)) {
      teams = sess.data.teams;
    }
  } catch (err) {
    if (!(err instanceof StorageCorruptError)) throw err;
  }

  try {
    const ip = storage.read<InProgressGame>(ns(sessionId, "inProgressGame"));
    if (ip?.data) inProgressGame = ip.data;
  } catch (err) {
    if (err instanceof StorageCorruptError) {
      try { storage.remove(ns(sessionId, "inProgressGame")); } catch { /* ignore */ }
    } else {
      throw err;
    }
  }

  try {
    const list = storage.readList<CompletedGameRecord>(ns(sessionId, "history"));
    history = list.map((rec) => rec.data);
  } catch (err) {
    if (!(err instanceof StorageCorruptError)) throw err;
  }

  return { teams, inProgressGame, history };
}

export function saveSessionState(sessionId: string, state: SessionState, prev: SessionState | null): void {
  if (!prev || prev.teams !== state.teams) {
    storage.write<PersistedSessionShellState>(ns(sessionId, "session"), {
      schemaVersion: SESSION_SCHEMA_VERSION,
      data: { teams: state.teams },
    });
  }

  if (!prev || prev.inProgressGame !== state.inProgressGame) {
    if (state.inProgressGame) {
      storage.write<InProgressGame>(ns(sessionId, "inProgressGame"), {
        schemaVersion: IN_PROGRESS_SCHEMA_VERSION,
        data: state.inProgressGame,
      });
    } else if (prev?.inProgressGame) {
      storage.remove(ns(sessionId, "inProgressGame"));
    }
  }

  if (!prev || prev.history !== state.history) {
    const wrapped = state.history.map((data) => ({
      schemaVersion: HISTORY_RECORD_SCHEMA_VERSION,
      data,
    }));
    storage.replaceList<CompletedGameRecord>(ns(sessionId, "history"), wrapped);
  }
}

export function loadAllHistory(sessions: SessionDescriptor[]): CompletedGameRecord[] {
  const all: CompletedGameRecord[] = [];
  for (const s of sessions) {
    try {
      const list = storage.readList<CompletedGameRecord>(ns(s.id, "history"));
      for (const rec of list) {
        if (rec.data) all.push(rec.data);
      }
    } catch { /* skip corrupt session */ }
  }
  all.sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  return all;
}

export function deleteSessionData(sessionId: string): void {
  try { storage.remove(ns(sessionId, "session")); } catch { /* ignore */ }
  try { storage.remove(ns(sessionId, "inProgressGame")); } catch { /* ignore */ }
  try { storage.remove(ns(sessionId, "history")); } catch { /* ignore */ }
}
