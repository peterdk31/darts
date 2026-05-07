import { useMemo } from "react";
import type { Team } from "@/shared/types/core";
import { getTeamLabel } from "@/shared/teams/teamLabel";
import { COLOR_LABELS } from "@/shared/teams/colors";
import type { CompletedGameRecord } from "@/shell/session/types";
import styles from "./SessionTally.module.css";

interface Props {
  teams: ReadonlyArray<Team>;
  history: ReadonlyArray<CompletedGameRecord>;
  title?: string;
}

export function SessionTally({ teams, history, title = "Session wins" }: Props) {
  const wins = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of teams) counts[t.id] = 0;
    for (const rec of history) {
      for (const winnerId of rec.winnerTeamIds) {
        if (winnerId in counts) counts[winnerId] = (counts[winnerId] ?? 0) + 1;
      }
    }
    return counts;
  }, [teams, history]);

  if (teams.length === 0) return null;

  return (
    <section className={styles.tally} aria-label={title}>
      <h2 className={styles.title}>{title}</h2>
      <ul className={styles.list}>
        {teams.map((t) => (
          <li key={t.id} className={styles.row}>
            <span
              className={styles.stripe}
              style={{ background: `var(--team-color-${t.colorId})` }}
              aria-hidden="true"
            />
            <span
              className={styles.badge}
              style={{
                background: `var(--team-color-${t.colorId})`,
                color: `var(--team-color-${t.colorId}-on)`,
              }}
            >
              {COLOR_LABELS[t.colorId]}
            </span>
            <span className={styles.name}>{getTeamLabel(t)}</span>
            <span className={styles.count} aria-label={`${wins[t.id] ?? 0} wins`}>
              {wins[t.id] ?? 0}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
