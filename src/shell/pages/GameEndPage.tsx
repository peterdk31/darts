import { useMemo } from "react";
import { Button } from "@/shared/components/Button";
import { useNavigate } from "@/shared/routing/router";
import { useSession } from "@/shell/session/useSession";
import { SessionTally } from "@/shell/components/SessionTally";
import { getById } from "@/games/registry";
import type { Team } from "@/shared/types/core";
import { isWinSummary, type WinSummary } from "@/shell/stats/computeWinSummary";
import { getTeamLabel } from "@/shared/teams/teamLabel";
import styles from "./GameEndPage.module.css";

function ordinal(n: number): string {
  if (n === 1) return "1st";
  if (n === 2) return "2nd";
  if (n === 3) return "3rd";
  return `${n}th`;
}

export function GameEndPage() {
  const { state, dispatch } = useSession();
  const navigate = useNavigate();

  const lastRecord = useMemo(() => {
    return state.history.length > 0
      ? state.history[state.history.length - 1]
      : null;
  }, [state.history]);

  if (!lastRecord) {
    return (
      <div className={styles.page}>
        <p>No completed game to display.</p>
        <Button variant="primary" onClick={() => navigate("/games")}>
          Back to start
        </Button>
      </div>
    );
  }

  const manifest = getById(lastRecord.gameTypeId);
  const summary: WinSummary | null = isWinSummary(lastRecord.summary)
    ? lastRecord.summary
    : null;

  function newGameKeepingTeams() {
    dispatch({ type: "discardInProgressGame" });
    if (state.teams.length < 2) {
      dispatch({ type: "setTeams", teams: lastRecord!.teams });
    }
    navigate("/games");
  }

  function newGameFreshTeams() {
    dispatch({ type: "discardInProgressGame" });
    dispatch({ type: "setTeams", teams: [] });
    navigate("/games");
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <p className={styles.kicker}>
          {manifest?.displayName ?? lastRecord.gameTypeId}
        </p>
        <h1 className={styles.headline}>Final Results</h1>
        {summary && (
          <p className={styles.dartCount}>{summary.totalDarts} darts thrown</p>
        )}
      </header>

      {summary ? (
        <RichResults
          summary={summary}
          teams={lastRecord.teams}
          winnerTeamIds={lastRecord.winnerTeamIds}
        />
      ) : (
        <FallbackWinners
          teams={lastRecord.teams}
          winnerTeamIds={lastRecord.winnerTeamIds}
        />
      )}

      <SessionTally
        teams={state.teams.length > 0 ? state.teams : lastRecord.teams}
        history={state.history}
      />

      <div className={styles.actions}>
        <Button variant="primary" onClick={newGameKeepingTeams}>
          New game (keep teams)
        </Button>
        <Button variant="secondary" onClick={newGameFreshTeams}>
          New game (new teams)
        </Button>
        <Button variant="ghost" onClick={() => navigate("/history")}>
          View history
        </Button>
      </div>
    </div>
  );
}

function RichResults({
  summary,
  teams,
  winnerTeamIds,
}: {
  summary: WinSummary;
  teams: ReadonlyArray<Team>;
  winnerTeamIds: string[];
}) {
  return (
    <section className={styles.rankings} aria-label="Game results">
      {summary.rankings.map((ranking) => {
        const team = teams.find((t) => t.id === ranking.teamId);
        if (!team) return null;
        const isWinner = winnerTeamIds.includes(ranking.teamId);
        const teamPlayers = summary.playerStats.filter(
          (p) => p.teamId === ranking.teamId,
        );

        return (
          <div
            key={ranking.teamId}
            className={`${styles.rankCard} ${isWinner ? styles.winner : ""}`}
            style={{
              borderColor: `var(--team-color-${team.colorId})`,
            }}
          >
            <div className={styles.rankHeader}>
              <span
                className={styles.rankOrdinal}
                style={
                  isWinner
                    ? {
                        background: `var(--team-color-${team.colorId})`,
                        color: `var(--team-color-${team.colorId}-on)`,
                      }
                    : undefined
                }
              >
                {ordinal(ranking.rank)}
              </span>
              <span className={styles.teamName}>{getTeamLabel(team)}</span>
              {isWinner && (
                <span className={styles.crown} aria-label="Winner">
                  &#9733;
                </span>
              )}
            </div>
            <p className={styles.rankLabel}>{ranking.label}</p>
            <ul className={styles.playerList}>
              {teamPlayers.map((ps) => {
                const player = team.players.find((p) => p.id === ps.playerId);
                if (!player) return null;
                const pct =
                  ps.dartsThrown > 0
                    ? Math.round((100 * ps.dartsHit) / ps.dartsThrown)
                    : 0;
                return (
                  <li key={ps.playerId} className={styles.playerRow}>
                    <span className={styles.playerName}>
                      {player.displayName}
                    </span>
                    <span className={styles.playerStats}>
                      {ps.dartsThrown} thrown &middot; {ps.dartsHit} hit ({pct}
                      %)
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </section>
  );
}

function FallbackWinners({
  teams,
  winnerTeamIds,
}: {
  teams: ReadonlyArray<Team>;
  winnerTeamIds: string[];
}) {
  const winners = teams.filter((t) => winnerTeamIds.includes(t.id));
  return (
    <div className={styles.fallbackWinners}>
      <h2 className={styles.fallbackTitle}>
        {winners.length === 1 ? "Winner" : "Winners"}
      </h2>
      {winners.map((t) => (
        <div
          key={t.id}
          className={styles.winnerCard}
          style={{ borderColor: `var(--team-color-${t.colorId})` }}
        >
          <span
            className={styles.badge}
            style={{
              background: `var(--team-color-${t.colorId})`,
              color: `var(--team-color-${t.colorId}-on)`,
            }}
          >
            {getTeamLabel(t)}
          </span>
          <span className={styles.crown} aria-hidden="true">
            &#9733;
          </span>
        </div>
      ))}
    </div>
  );
}
