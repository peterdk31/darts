import { listAll } from "@/games/registry";
import { Button } from "@/shared/components/Button";
import { useNavigate } from "@/shared/routing/router";
import { useSessionContext } from "@/shell/session/SessionContext";
import styles from "./GameSelectPage.module.css";

export function GameSelectPage() {
  const navigate = useNavigate();
  const { activeSession, leaveSession } = useSessionContext();
  const games = listAll();

  return (
    <div className={styles.page}>
      <header className={styles.headerRow}>
        <div>
          <h1>{activeSession?.name ?? "Pick a game"}</h1>
          {activeSession && (
            <p className={styles.sessionDate}>
              {new Date(activeSession.createdAt).toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </p>
          )}
        </div>
        <div style={{ display: "flex", gap: "var(--space-2)" }}>
          <Button variant="ghost" size="sm" onClick={() => navigate("/players")}>
            Players
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate("/history")}>
            History
          </Button>
          <Button variant="ghost" size="sm" onClick={() => { leaveSession(); navigate("/"); }}>
            ← Back
          </Button>
        </div>
      </header>
      <ul className={styles.list}>
        {games.map((g) => (
          <li key={g.id}>
            <button
              type="button"
              className={styles.tile}
              onClick={() =>
                navigate(`/teams/${encodeURIComponent(g.id)}`)
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
    </div>
  );
}
