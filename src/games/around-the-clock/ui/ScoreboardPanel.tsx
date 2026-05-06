import type { ResolvedSettings } from "@/shared/types/game-module";
import type { Team } from "@/shared/types/core";
import { type ATCEngineState } from "../engine";
import styles from "./ScoreboardPanel.module.css";

interface Props {
  state: ATCEngineState;
  resolvedSettings: ResolvedSettings;
  teams: ReadonlyArray<Team>;
}

const ATC_LABELS: string[] = [
  ...Array.from({ length: 20 }, (_, i) => String(i + 1)),
  "Bull",
];

export function ScoreboardPanel({ state, teams }: Props) {
  return (
    <div className={styles.panel}>
      {teams.map((t) => {
        const progress = state.progressByTeam[t.id] ?? 0;
        return (
          <div key={t.id} className={styles.row}>
            <div className={styles.head}>
              <span
                className={styles.dot}
                style={{ background: `var(--team-color-${t.colorId})` }}
              />
              <span className={styles.name}>{t.displayName}</span>
              <span className={styles.next}>
                next: {progress < 21 ? ATC_LABELS[progress] : "DONE"}
              </span>
            </div>
            <ol className={styles.strip} aria-label="progress">
              {ATC_LABELS.map((label, i) => (
                <li
                  key={label}
                  className={i < progress ? styles.cellDone : styles.cell}
                >
                  {label}
                </li>
              ))}
            </ol>
          </div>
        );
      })}
    </div>
  );
}
