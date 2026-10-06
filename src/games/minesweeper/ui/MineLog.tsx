import type { Team } from "@/shared/types/core";
import type { MinesweeperEngineState } from "../engine";
import styles from "./MineLog.module.css";

interface Props {
  state: MinesweeperEngineState;
  teams: ReadonlyArray<Team>;
}

/** Round-by-round list of where the mines were and who stepped on them. */
export function MineLog({ state, teams }: Props) {
  const history = state.mineHistory ?? [];
  if (history.length === 0) return null;

  const playerName = (teamId: string, playerId: string) => {
    const team = teams.find((t) => t.id === teamId);
    return team?.players.find((p) => p.id === playerId)?.displayName ?? "?";
  };
  const teamColor = (teamId: string) =>
    teams.find((t) => t.id === teamId)?.colorId;

  return (
    <section className={styles.log} aria-label="Mines per round">
      <h2 className={styles.title}>Mines</h2>
      <ol className={styles.rounds}>
        {history.map((r) => {
          const hitSegments = new Set(r.hits.map((h) => h.segment));
          return (
            <li key={r.round} className={styles.round}>
              <span className={styles.roundLabel}>R{r.round}</span>
              <span className={styles.mines}>
                {r.mines.map((m) => (
                  <span
                    key={m}
                    className={hitSegments.has(m) ? styles.mineHit : styles.mine}
                  >
                    {m}
                  </span>
                ))}
              </span>
              {r.hits.length > 0 && (
                <span className={styles.hits}>
                  {r.hits.map((h, i) => (
                    <span
                      key={i}
                      className={styles.hit}
                      style={{
                        borderColor: `var(--team-color-${teamColor(h.teamId)})`,
                      }}
                    >
                      {playerName(h.teamId, h.playerId)} 💥 {h.segment}
                    </span>
                  ))}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
