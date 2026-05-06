import { useEffect, useState } from "react";
import type { Player, Team, TeamColorId } from "@/shared/types/core";
import { TEAM_COLORS, assignNextColor } from "@/shared/teams/colors";
import { Button } from "@/shared/components/Button";
import { useNavigate } from "@/shared/routing/router";
import { useSession } from "@/shell/session/useSession";
import styles from "./TeamSetupPage.module.css";

const MIN_TEAMS = 2;
const MAX_TEAMS = 8;
const MIN_PLAYERS = 1;
const MAX_PLAYERS = 4;

let _idCounter = 0;
function uid(prefix: string): string {
  _idCounter++;
  return `${prefix}-${Date.now().toString(36)}-${_idCounter}`;
}

function makeTeam(existing: ReadonlyArray<Team>, displayName?: string): Team {
  return {
    id: uid("team"),
    displayName: displayName ?? `Team ${existing.length + 1}`,
    colorId: assignNextColor(existing),
    players: [
      { id: uid("player"), displayName: "Player 1" },
    ],
  };
}

function makePlayer(team: Team): Player {
  return {
    id: uid("player"),
    displayName: `Player ${team.players.length + 1}`,
  };
}

export function TeamSetupPage() {
  const { state, dispatch } = useSession();
  const navigate = useNavigate();
  const [teams, setLocalTeams] = useState<Team[]>(() =>
    state.teams.length > 0 ? state.teams : [],
  );

  // If we hydrate session.teams after first render, copy in.
  useEffect(() => {
    if (teams.length === 0 && state.teams.length > 0) {
      setLocalTeams(state.teams);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.teams]);

  function commit(next: Team[]) {
    setLocalTeams(next);
    dispatch({ type: "setTeams", teams: next });
  }

  function addTeam() {
    if (teams.length >= MAX_TEAMS) return;
    commit([...teams, makeTeam(teams)]);
  }

  function removeTeam(id: string) {
    commit(teams.filter((t) => t.id !== id));
  }

  function renameTeam(id: string, displayName: string) {
    commit(teams.map((t) => (t.id === id ? { ...t, displayName } : t)));
  }

  function setTeamColor(id: string, colorId: TeamColorId) {
    commit(teams.map((t) => (t.id === id ? { ...t, colorId } : t)));
  }

  function addPlayer(teamId: string) {
    commit(
      teams.map((t) =>
        t.id === teamId && t.players.length < MAX_PLAYERS
          ? { ...t, players: [...t.players, makePlayer(t)] }
          : t,
      ),
    );
  }

  function removePlayer(teamId: string, playerId: string) {
    commit(
      teams.map((t) =>
        t.id === teamId
          ? { ...t, players: t.players.filter((p) => p.id !== playerId) }
          : t,
      ),
    );
  }

  function renamePlayer(teamId: string, playerId: string, displayName: string) {
    commit(
      teams.map((t) =>
        t.id === teamId
          ? {
              ...t,
              players: t.players.map((p) =>
                p.id === playerId ? { ...p, displayName } : p,
              ),
            }
          : t,
      ),
    );
  }

  function movePlayer(teamId: string, playerId: string, direction: -1 | 1) {
    commit(
      teams.map((t) => {
        if (t.id !== teamId) return t;
        const idx = t.players.findIndex((p) => p.id === playerId);
        const target = idx + direction;
        if (idx < 0 || target < 0 || target >= t.players.length) return t;
        const players = [...t.players];
        const a = players[idx]!;
        const b = players[target]!;
        players[idx] = b;
        players[target] = a;
        return { ...t, players };
      }),
    );
  }

  const validTeams = teams.filter(
    (t) => t.players.length >= MIN_PLAYERS && t.displayName.trim().length > 0,
  );
  const canContinue = validTeams.length >= MIN_TEAMS && validTeams.length === teams.length;

  function onContinue() {
    if (!canContinue) return;
    navigate("/game-select");
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerRow}>
          <h1>Team setup</h1>
          <Button variant="ghost" size="sm" onClick={() => navigate("/history")}>
            View history
          </Button>
        </div>
        <p className={styles.help}>
          Add 2-8 teams, with 1-4 players per team. Colors are assigned
          automatically; tap a swatch to change.
        </p>
      </header>

      <ul className={styles.teamList}>
        {teams.map((team, teamIdx) => (
          <li key={team.id} className={styles.teamCard}>
            <div className={styles.teamHead}>
              <span
                className={styles.badge}
                style={{
                  background: `var(--team-color-${team.colorId})`,
                  color: `var(--team-color-${team.colorId}-on)`,
                }}
              >
                Team {teamIdx + 1}
              </span>
              <input
                aria-label={`Team ${teamIdx + 1} display name`}
                className={styles.teamName}
                type="text"
                maxLength={40}
                value={team.displayName}
                onChange={(e) => renameTeam(team.id, e.target.value)}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeTeam(team.id)}
                aria-label={`Remove ${team.displayName}`}
              >
                Remove
              </Button>
            </div>

            <div className={styles.swatches} role="group" aria-label="Team color">
              {TEAM_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={
                    c === team.colorId
                      ? styles.swatchActive
                      : styles.swatch
                  }
                  style={{ background: `var(--team-color-${c})` }}
                  aria-label={`Color ${c}`}
                  aria-pressed={c === team.colorId}
                  onClick={() => setTeamColor(team.id, c)}
                />
              ))}
            </div>

            <ul className={styles.playerList}>
              {team.players.map((p, pIdx) => (
                <li key={p.id} className={styles.playerRow}>
                  <span className={styles.playerNum}>{pIdx + 1}.</span>
                  <input
                    aria-label={`Player ${pIdx + 1} display name`}
                    className={styles.playerName}
                    type="text"
                    maxLength={30}
                    value={p.displayName}
                    onChange={(e) => renamePlayer(team.id, p.id, e.target.value)}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => movePlayer(team.id, p.id, -1)}
                    disabled={pIdx === 0}
                    aria-label="Move up"
                  >
                    ↑
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => movePlayer(team.id, p.id, 1)}
                    disabled={pIdx === team.players.length - 1}
                    aria-label="Move down"
                  >
                    ↓
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removePlayer(team.id, p.id)}
                    disabled={team.players.length <= 1}
                    aria-label="Remove player"
                  >
                    ×
                  </Button>
                </li>
              ))}
            </ul>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => addPlayer(team.id)}
              disabled={team.players.length >= MAX_PLAYERS}
            >
              + Add player
            </Button>
          </li>
        ))}
      </ul>

      <div className={styles.actions}>
        <Button
          variant="secondary"
          onClick={addTeam}
          disabled={teams.length >= MAX_TEAMS}
        >
          + Add team
        </Button>
        <Button variant="primary" onClick={onContinue} disabled={!canContinue}>
          Continue →
        </Button>
      </div>

      {!canContinue && (
        <p className={styles.error} role="status">
          Need at least {MIN_TEAMS} teams; each team needs a name and at least
          one player.
        </p>
      )}
    </div>
  );
}
