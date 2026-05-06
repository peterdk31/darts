import { useMemo } from "react";
import { Button } from "@/shared/components/Button";
import { useNavigate } from "@/shared/routing/router";
import { useSession } from "@/shell/session/useSession";
import { SessionTally } from "@/shell/components/SessionTally";
import { getById } from "@/games/registry";
import styles from "./GameEndPage.module.css";

export function GameEndPage() {
  const { state, dispatch } = useSession();
  const navigate = useNavigate();

  // Most recent completed game (the one we just finished).
  const lastRecord = useMemo(() => {
    return state.history.length > 0
      ? state.history[state.history.length - 1]
      : null;
  }, [state.history]);

  if (!lastRecord) {
    return (
      <div className={styles.page}>
        <p>No completed game to display.</p>
        <Button variant="primary" onClick={() => navigate("/teams")}>
          Back to start
        </Button>
      </div>
    );
  }

  const manifest = getById(lastRecord.gameTypeId);
  const winners = lastRecord.teams.filter((t) =>
    lastRecord.winnerTeamIds.includes(t.id),
  );

  function newGameKeepingTeams() {
    dispatch({ type: "discardInProgressGame" });
    if (state.teams.length < 2) {
      // Defensive: if the live team list was already cleared (e.g. user wiped
      // it before reaching this page), restore from the snapshot.
      dispatch({ type: "setTeams", teams: lastRecord!.teams });
    }
    navigate("/game-select");
  }

  function newGameFreshTeams() {
    dispatch({ type: "discardInProgressGame" });
    dispatch({ type: "setTeams", teams: [] });
    navigate("/teams");
  }

  function viewHistory() {
    navigate("/history");
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <p className={styles.kicker}>
          {manifest?.displayName ?? lastRecord.gameTypeId}
        </p>
        <h1 className={styles.headline}>
          {winners.length === 1 ? "Winner" : "Winners"}
        </h1>
        <div className={styles.winners}>
          {winners.map((t, i) => (
            <div
              key={t.id}
              className={styles.winnerCard}
              style={{
                borderColor: `var(--team-color-${t.colorId})`,
              }}
            >
              <span
                className={styles.badge}
                style={{
                  background: `var(--team-color-${t.colorId})`,
                  color: `var(--team-color-${t.colorId}-on)`,
                }}
              >
                Team {lastRecord.teams.findIndex((tx) => tx.id === t.id) + 1}
              </span>
              <span className={styles.name}>{t.displayName}</span>
              {i === 0 && winners.length === 1 && (
                <span className={styles.crown} aria-hidden="true">
                  ★
                </span>
              )}
            </div>
          ))}
        </div>
      </header>

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
        <Button variant="ghost" onClick={viewHistory}>
          View history
        </Button>
      </div>
    </div>
  );
}
