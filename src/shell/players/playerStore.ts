import { storage } from "@/shared/storage";
import type { RosterPlayer } from "@/shared/types/core";
import type { VersionedRecord } from "@/shared/storage/types";

const SCHEMA_VERSION = 1;
const MAX_ACTIVE_PLAYERS = 20;

let _idCounter = 0;
function uid(): string {
  _idCounter++;
  return `player-${Date.now().toString(36)}-${_idCounter}`;
}

function readAll(): RosterPlayer[] {
  const record = storage.read<RosterPlayer[]>("players");
  if (!record?.data || !Array.isArray(record.data)) return [];
  return record.data;
}

function writeAll(players: RosterPlayer[]): void {
  const record: VersionedRecord<RosterPlayer[]> = {
    schemaVersion: SCHEMA_VERSION,
    data: players,
  };
  storage.write("players", record);
}

export const playerStore = {
  getAll(): RosterPlayer[] {
    return readAll();
  },

  getActive(): RosterPlayer[] {
    return readAll().filter((p) => p.deletedAt === null);
  },

  getDeleted(): RosterPlayer[] {
    return readAll().filter((p) => p.deletedAt !== null);
  },

  add(displayName: string): RosterPlayer {
    const trimmed = displayName.trim();
    if (trimmed.length === 0) throw new Error("Player name cannot be empty");

    const all = readAll();
    const activeCount = all.filter((p) => p.deletedAt === null).length;
    if (activeCount >= MAX_ACTIVE_PLAYERS) {
      throw new Error(`Cannot add player: maximum of ${MAX_ACTIVE_PLAYERS} active players reached`);
    }

    const player: RosterPlayer = {
      id: uid(),
      displayName: trimmed,
      createdAt: new Date().toISOString(),
      deletedAt: null,
    };
    all.push(player);
    writeAll(all);
    return player;
  },

  rename(playerId: string, displayName: string): void {
    const trimmed = displayName.trim();
    if (trimmed.length === 0) throw new Error("Player name cannot be empty");

    const all = readAll();
    const player = all.find((p) => p.id === playerId);
    if (!player) throw new Error(`Player not found: ${playerId}`);

    player.displayName = trimmed;
    writeAll(all);
  },

  remove(playerId: string): void {
    const all = readAll();
    const player = all.find((p) => p.id === playerId);
    if (!player) throw new Error(`Player not found: ${playerId}`);
    if (player.deletedAt !== null) return;

    player.deletedAt = new Date().toISOString();
    writeAll(all);
  },

  restore(playerId: string): void {
    const all = readAll();
    const player = all.find((p) => p.id === playerId);
    if (!player) throw new Error(`Player not found: ${playerId}`);

    const activeCount = all.filter((p) => p.deletedAt === null).length;
    if (activeCount >= MAX_ACTIVE_PLAYERS) {
      throw new Error(`Cannot restore player: maximum of ${MAX_ACTIVE_PLAYERS} active players reached`);
    }

    player.deletedAt = null;
    writeAll(all);
  },

  hardDelete(playerId: string): void {
    const all = readAll();
    const idx = all.findIndex((p) => p.id === playerId);
    if (idx === -1) throw new Error(`Player not found: ${playerId}`);

    all.splice(idx, 1);
    writeAll(all);
  },

  getById(playerId: string): RosterPlayer | undefined {
    return readAll().find((p) => p.id === playerId);
  },
};
