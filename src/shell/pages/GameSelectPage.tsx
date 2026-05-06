import { listAll } from "@/games/registry";
import { Button } from "@/shared/components/Button";
import { useNavigate } from "@/shared/routing/router";
import { useSession } from "@/shell/session/useSession";
import styles from "./GameSelectPage.module.css";

export function GameSelectPage() {
  const { state } = useSession();
  const navigate = useNavigate();

  const validTeams = state.teams.filter((t) => t.players.length >= 1);
  if (validTeams.length < 2) {
    return (
      <div className={styles.page}>
        <p>You need at least 2 teams before picking a game.</p>
        <Button variant="primary" onClick={() => navigate("/teams")}>
          Back to team setup
        </Button>
      </div>
    );
  }

  const games = listAll();

  return (
    <div className={styles.page}>
      <header>
        <h1>Pick a game</h1>
      </header>
      <ul className={styles.list}>
        {games.map((g) => (
          <li key={g.id}>
            <button
              type="button"
              className={styles.tile}
              onClick={() =>
                navigate(`/game-settings/${encodeURIComponent(g.id)}`)
              }
            >
              <span className={styles.title}>{g.displayName}</span>
              <span className={styles.meta}>
                {g.dartsPerPlayer} darts/player
                {g.settingsSchema.length > 0
                  ? ` • ${g.settingsSchema.length} setting${g.settingsSchema.length === 1 ? "" : "s"}`
                  : ""}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <div className={styles.footer}>
        <Button variant="ghost" onClick={() => navigate("/teams")}>
          ← Back to teams
        </Button>
        <Button variant="ghost" onClick={() => navigate("/history")}>
          View history
        </Button>
      </div>
    </div>
  );
}
