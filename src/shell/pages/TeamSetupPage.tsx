import { useEffect, useState } from "react";
import type { Player, Team } from "@/shared/types/core";
import { assignNextColor, COLOR_LABELS } from "@/shared/teams/colors";
import { Button } from "@/shared/components/Button";
import { useNavigate, useParams } from "@/shared/routing/router";
import { useSession } from "@/shell/session/useSession";
import { playerStore } from "@/shell/players/playerStore";
import styles from "./TeamSetupPage.module.css";

const MIN_TEAMS = 2;
const MAX_TEAMS = 8;
const MAX_PLAYERS = 4;

let _idCounter = 0;
function uid(prefix: string): string {
  _idCounter++;
  return `${prefix}-${Date.now().toString(36)}-${_idCounter}`;
}

function makeTeam(existing: ReadonlyArray<Team>): Team {
  const colorId = assignNextColor(existing);
  return {
    id: uid("team"),
    displayName: `${COLOR_LABELS[colorId]} Team`,
    colorId,
    players: [],
  };
}

function pruneDeletedPlayers(teams: Team[], activeIds: Set<string>): Team[] {
  return teams.map((t) => ({
    ...t,
    players: t.players.filter((p) => activeIds.has(p.id)),
  }));
}

export function TeamSetupPage() {
  const { gameId: rawGameId } = useParams<{ gameId: string }>();
  const gameId = decodeURIComponent(rawGameId ?? "");
  const { state, dispatch } = useSession();
  const navigate = useNavigate();
  const [teams, setLocalTeams] = useState<Team[]>(() =>
    state.teams.length > 0 ? state.teams : [],
  );
  const [quickAddTeamId, setQuickAddTeamId] = useState<string | null>(null);
  const [quickAddName, setQuickAddName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (teams.length === 0 && state.teams.length > 0) {
      setLocalTeams(state.teams);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.teams]);

  const rosterPlayers = playerStore.getActive();
  const activeIds = new Set(rosterPlayers.map((p) => p.id));

  useEffect(() => {
    const pruned = pruneDeletedPlayers(teams, activeIds);
    if (pruned.some((t, i) => t.players.length !== teams[i]!.players.length)) {
      setLocalTeams(pruned);
      dispatch({ type: "setTeams", teams: pruned });
    }
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const visibleTeams = pruneDeletedPlayers(teams, activeIds);
  const assignedPlayerIds = new Set(visibleTeams.flatMap((t) => t.players.map((p) => p.id)));
  const availablePlayers = rosterPlayers.filter((p) => !assignedPlayerIds.has(p.id));

  function commit(next: Team[]) {
    setLocalTeams(next);
    dispatch({ type: "setTeams", teams: next });
  }

  function addTeam() {
    if (visibleTeams.length >= MAX_TEAMS) return;
    commit([...visibleTeams, makeTeam(visibleTeams)]);
  }

  function removeTeam(id: string) {
    commit(visibleTeams.filter((t) => t.id !== id));
  }

  function moveTeam(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= visibleTeams.length) return;
    const next = [...visibleTeams];
    [next[index], next[target]] = [next[target]!, next[index]!];
    commit(next);
  }

  function assignPlayer(teamId: string, playerId: string) {
    const rp = rosterPlayers.find((p) => p.id === playerId);
    if (!rp) return;
    const player: Player = { id: rp.id, displayName: rp.displayName };
    commit(
      visibleTeams.map((t) =>
        t.id === teamId && t.players.length < MAX_PLAYERS
          ? { ...t, players: [...t.players, player] }
          : t,
      ),
    );
  }

  function removePlayer(teamId: string, playerId: string) {
    commit(
      visibleTeams.map((t) =>
        t.id === teamId
          ? { ...t, players: t.players.filter((p) => p.id !== playerId) }
          : t,
      ),
    );
  }

  function startQuickAdd(teamId: string) {
    setQuickAddTeamId(teamId);
    setQuickAddName("");
  }

  function commitQuickAdd() {
    if (!quickAddTeamId) return;
    const trimmed = quickAddName.trim();
    if (!trimmed) {
      setQuickAddTeamId(null);
      return;
    }
    try {
      const rp = playerStore.add(trimmed);
      const player: Player = { id: rp.id, displayName: rp.displayName };
      commit(
        visibleTeams.map((t) =>
          t.id === quickAddTeamId && t.players.length < MAX_PLAYERS
            ? { ...t, players: [...t.players, player] }
            : t,
        ),
      );
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add player");
    }
    setQuickAddTeamId(null);
    setQuickAddName("");
  }

  function handleQuickAddKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") commitQuickAdd();
    if (e.key === "Escape") setQuickAddTeamId(null);
  }

  const validTeams = visibleTeams.filter(
    (t) => t.players.length >= 1,
  );
  const canContinue = validTeams.length >= MIN_TEAMS && validTeams.length === visibleTeams.length;

  function onContinue() {
    if (!canContinue) return;
    navigate(`/game-settings/${encodeURIComponent(gameId)}`);
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerRow}>
          <h1>Team setup</h1>
          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            <Button variant="ghost" size="sm" onClick={() => navigate("/players")}>
              Players
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate("/games")}>
              ← Back
            </Button>
          </div>
        </div>
        {rosterPlayers.length === 0 ? (
          <p className={styles.help}>
            No players in the roster yet.{" "}
            <button
              type="button"
              className={styles.linkButton}
              onClick={() => navigate("/players")}
            >
              Add players first
            </button>{" "}
            or use quick-add below to create players as you build teams.
          </p>
        ) : (
          <p className={styles.help}>
            Add 2-8 teams, with 1-4 players per team. Select players from
            your roster or quick-add new ones.
          </p>
        )}
      </header>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <ul className={styles.teamList}>
        {visibleTeams.map((team, teamIdx) => (
          <li key={team.id} className={styles.teamCard}>
            <div className={styles.teamHead}>
              <span
                className={styles.badge}
                style={{
                  background: `var(--team-color-${team.colorId})`,
                  color: `var(--team-color-${team.colorId}-on)`,
                }}
              >
                {COLOR_LABELS[team.colorId]} Team
              </span>
              <span className={styles.headSpacer} />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => moveTeam(teamIdx, -1)}
                disabled={teamIdx === 0}
                aria-label="Move up"
              >
                ↑
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => moveTeam(teamIdx, 1)}
                disabled={teamIdx === visibleTeams.length - 1}
                aria-label="Move down"
              >
                ↓
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeTeam(team.id)}
                aria-label={`Remove ${COLOR_LABELS[team.colorId]} team`}
              >
                Remove
              </Button>
            </div>

            {team.players.length > 0 ? (
              <ul className={styles.playerList}>
                {team.players.map((p, pIdx) => (
                  <li key={p.id} className={styles.playerRow}>
                    <span className={styles.playerNum}>{pIdx + 1}.</span>
                    <span className={styles.assignedPlayerName}>
                      {p.displayName}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removePlayer(team.id, p.id)}
                      aria-label={`Remove ${p.displayName} from team`}
                    >
                      ×
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.emptyRoster}>No players assigned yet.</p>
            )}

            {team.players.length < MAX_PLAYERS && (
              <div className={styles.assignSection}>
                {availablePlayers.length > 0 && (
                  <select
                    className={styles.playerSelect}
                    value=""
                    onChange={(e) => {
                      if (e.target.value) assignPlayer(team.id, e.target.value);
                    }}
                    aria-label={`Add player to team ${teamIdx + 1}`}
                  >
                    <option value="">Select a player...</option>
                    {availablePlayers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.displayName}
                      </option>
                    ))}
                  </select>
                )}
                {quickAddTeamId === team.id ? (
                  <div className={styles.quickAddForm}>
                    <input
                      className={styles.quickAddInput}
                      type="text"
                      placeholder="New player name"
                      maxLength={30}
                      value={quickAddName}
                      onChange={(e) => setQuickAddName(e.target.value)}
                      onKeyDown={handleQuickAddKeyDown}
                      onBlur={commitQuickAdd}
                      autoFocus
                      aria-label="Quick add player name"
                    />
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => startQuickAdd(team.id)}
                  >
                    + Quick add player
                  </Button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className={styles.actions}>
        <Button
          variant="secondary"
          onClick={addTeam}
          disabled={visibleTeams.length >= MAX_TEAMS}
        >
          + Add team
        </Button>
        <Button variant="primary" onClick={onContinue} disabled={!canContinue}>
          Start →
        </Button>
      </div>

      {!canContinue && visibleTeams.length > 0 && (
        <p className={styles.error} role="status">
          Need at least {MIN_TEAMS} teams, each with at least one player.
        </p>
      )}
    </div>
  );
}
