import { useEffect, useState } from "react";
import type { Team } from "@/shared/types/core";
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

interface LocalTeam {
  id: string;
  displayName: string;
  colorId: Team["colorId"];
  playerIds: string[];
}

function toLocal(teams: ReadonlyArray<Team>): LocalTeam[] {
  return teams.map((t) => ({
    id: t.id,
    displayName: t.displayName,
    colorId: t.colorId,
    playerIds: t.players.map((p) => p.id),
  }));
}

export function TeamSetupPage() {
  const { gameId: rawGameId } = useParams<{ gameId: string }>();
  const gameId = decodeURIComponent(rawGameId ?? "");
  const { state, dispatch } = useSession();
  const navigate = useNavigate();
  const [teams, setLocalTeams] = useState<LocalTeam[]>(() =>
    state.teams.length > 0 ? toLocal(state.teams) : [],
  );

  useEffect(() => {
    if (teams.length === 0 && state.teams.length > 0) {
      setLocalTeams(toLocal(state.teams));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.teams]);

  const rosterPlayers = playerStore.getActive();
  const rosterById = new Map(rosterPlayers.map((p) => [p.id, p]));

  function resolve(lt: LocalTeam): Team {
    return {
      id: lt.id,
      displayName: lt.displayName,
      colorId: lt.colorId,
      players: lt.playerIds
        .filter((pid) => rosterById.has(pid))
        .map((pid) => {
          const rp = rosterById.get(pid)!;
          return { id: rp.id, displayName: rp.displayName };
        }),
    };
  }

  const visibleTeams = teams.map(resolve);
  const assignedPlayerIds = new Set(teams.flatMap((t) => t.playerIds));
  const availablePlayers = rosterPlayers.filter((p) => !assignedPlayerIds.has(p.id));

  function commit(next: LocalTeam[]) {
    setLocalTeams(next);
    dispatch({ type: "setTeams", teams: next.map(resolve) });
  }

  function addTeam() {
    if (teams.length >= MAX_TEAMS) return;
    const newTeam = makeTeam(visibleTeams);
    commit([...teams, { id: newTeam.id, displayName: newTeam.displayName, colorId: newTeam.colorId, playerIds: [] }]);
  }

  function removeTeam(id: string) {
    commit(teams.filter((t) => t.id !== id));
  }

  function moveTeam(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= teams.length) return;
    const next = [...teams];
    [next[index], next[target]] = [next[target]!, next[index]!];
    commit(next);
  }

  function assignPlayer(teamId: string, playerId: string) {
    if (!rosterById.has(playerId)) return;
    commit(
      teams.map((t) =>
        t.id === teamId && t.playerIds.length < MAX_PLAYERS
          ? { ...t, playerIds: [...t.playerIds, playerId] }
          : t,
      ),
    );
  }

  function removePlayer(teamId: string, playerId: string) {
    commit(
      teams.map((t) =>
        t.id === teamId
          ? { ...t, playerIds: t.playerIds.filter((pid) => pid !== playerId) }
          : t,
      ),
    );
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
            to start building teams.
          </p>
        ) : (
          <p className={styles.help}>
            Add 2-8 teams, with 1-4 players per team. Select players from
            your roster.
          </p>
        )}
      </header>

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

            {team.players.length < MAX_PLAYERS && availablePlayers.length > 0 && (
              <div className={styles.assignSection}>
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
