import { useMemo, useState } from "react";
import { Button } from "@/shared/components/Button";
import { useNavigate } from "@/shared/routing/router";
import { useSessionContext } from "@/shell/session/SessionContext";
import { playerStore } from "./playerStore";
import { computeAllPlayerStats, emptyPlayerStats, type AggregatePlayerStats } from "./playerStats";
import { mpr, percent, x01Line } from "@/shell/stats/formatStats";
import type { RosterPlayer } from "@/shared/types/core";
import styles from "./PlayersPage.module.css";

const MAX_ACTIVE = 20;
const MAX_NAME_LENGTH = 30;

const MARKS_LABELS: Record<string, string> = {
  cricket: "Cricket",
  "mickey-mouse": "Mickey",
};

function formatStats(stats: AggregatePlayerStats): string {
  if (stats.gamesPlayed === 0) return "No games yet";
  const won = `${stats.gamesWon}/${stats.gamesPlayed} won`;
  if (stats.dartsThrown === 0) return won;
  return `${won} · ${percent(stats.dartsHit, stats.dartsThrown)} hit`;
}

function formatGameStats(stats: AggregatePlayerStats): string[] {
  const lines: string[] = [];
  if (stats.x01) lines.push(`X01: ${x01Line(stats.x01)}`);
  for (const [gameTypeId, m] of Object.entries(stats.marks)) {
    if (m.darts === 0) continue;
    lines.push(`${MARKS_LABELS[gameTypeId] ?? gameTypeId}: MPR ${mpr(m.marks, m.darts)}`);
  }
  return lines;
}

export function PlayersPage() {
  const navigate = useNavigate();
  const { activeSession, sessions } = useSessionContext();
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const rerender = () => setTick((t) => t + 1);

  const activePlayers = playerStore.getActive();
  const deletedPlayers = playerStore.getDeleted();

  const statsMap = useMemo(
    () => computeAllPlayerStats(activePlayers.map((p) => p.id), sessions),
    [activePlayers, sessions],
  );

  function handleAdd() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    try {
      playerStore.add(trimmed);
      setNewName("");
      setError(null);
      rerender();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add player");
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleAdd();
  }

  function startRename(player: RosterPlayer) {
    setEditingId(player.id);
    setEditName(player.displayName);
  }

  function commitRename() {
    if (!editingId) return;
    const trimmed = editName.trim();
    if (!trimmed) {
      setEditingId(null);
      return;
    }
    try {
      playerStore.rename(editingId, trimmed);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rename player");
    }
    setEditingId(null);
    rerender();
  }

  function handleRenameKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") commitRename();
    if (e.key === "Escape") setEditingId(null);
  }

  function handleRemove(playerId: string) {
    try {
      playerStore.remove(playerId);
      setError(null);
      rerender();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove player");
    }
  }

  function handleRestore(playerId: string) {
    try {
      playerStore.restore(playerId);
      setError(null);
      rerender();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to restore player");
    }
  }

  function handleHardDelete(playerId: string) {
    try {
      playerStore.hardDelete(playerId);
      setError(null);
      rerender();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete player");
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerRow}>
          <h1>Players</h1>
          <Button variant="ghost" size="sm" onClick={() => navigate(activeSession ? "/games" : "/")}>
            ← Back
          </Button>
        </div>
        <p className={styles.help}>
          Manage your player roster. Add up to {MAX_ACTIVE} players.
        </p>
      </header>

      <div className={styles.addForm}>
        <input
          className={styles.addInput}
          type="text"
          placeholder="New player name"
          maxLength={MAX_NAME_LENGTH}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={handleKeyDown}
          aria-label="New player name"
        />
        <Button
          variant="primary"
          size="sm"
          onClick={handleAdd}
          disabled={!newName.trim() || activePlayers.length >= MAX_ACTIVE}
        >
          Add
        </Button>
      </div>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <span className={styles.count}>
        {activePlayers.length} / {MAX_ACTIVE} players
      </span>

      {activePlayers.length === 0 && deletedPlayers.length === 0 ? (
        <div className={styles.empty}>
          <p>No players yet. Add your first player above!</p>
        </div>
      ) : (
        <ul className={styles.playerList}>
          {activePlayers.map((player) => (
            <li key={player.id} className={styles.playerCard}>
              <div className={styles.playerInfo}>
                {editingId === player.id ? (
                  <input
                    className={styles.playerNameInput}
                    type="text"
                    maxLength={MAX_NAME_LENGTH}
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={handleRenameKeyDown}
                    onBlur={commitRename}
                    autoFocus
                    aria-label="Edit player name"
                  />
                ) : (
                  <span className={styles.playerName}>{player.displayName}</span>
                )}
                <span className={styles.playerMeta}>
                  {formatStats(statsMap.get(player.id) ?? emptyPlayerStats())}
                </span>
                {formatGameStats(statsMap.get(player.id) ?? emptyPlayerStats()).map((line) => (
                  <span key={line} className={styles.playerMeta}>
                    {line}
                  </span>
                ))}
              </div>
              <div className={styles.actions}>
                {editingId !== player.id && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => startRename(player)}
                    aria-label={`Rename ${player.displayName}`}
                  >
                    Rename
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemove(player.id)}
                  aria-label={`Remove ${player.displayName}`}
                >
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {deletedPlayers.length > 0 && (
        <div>
          <button
            type="button"
            className={styles.sectionHeader}
            onClick={() => setShowDeleted(!showDeleted)}
            aria-expanded={showDeleted}
          >
            <span className={showDeleted ? styles.chevronOpen : styles.chevron}>
              ▶
            </span>
            Removed players ({deletedPlayers.length})
          </button>
          {showDeleted && (
            <ul className={styles.playerList}>
              {deletedPlayers.map((player) => (
                <li key={player.id} className={styles.deletedCard}>
                  <span className={styles.playerName}>
                    {player.displayName}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRestore(player.id)}
                    disabled={activePlayers.length >= MAX_ACTIVE}
                    aria-label={`Restore ${player.displayName}`}
                  >
                    Restore
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleHardDelete(player.id)}
                    aria-label={`Delete ${player.displayName} permanently`}
                  >
                    Delete
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
