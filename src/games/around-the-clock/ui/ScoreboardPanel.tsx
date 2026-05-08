import type { ResolvedSettings } from "@/shared/types/game-module";
import type { Team } from "@/shared/types/core";
import { getTeamLabel } from "@/shared/teams/teamLabel";
import { CollapsibleScoreboard, ScoreSummary } from "@/shared/components/CollapsibleScoreboard";
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
    <CollapsibleScoreboard
      summary={
        <ScoreSummary
          teams={teams.map((t) => {
            const progress = state.progressByTeam[t.id] ?? 0;
            return {
              colorId: t.colorId,
              label: getTeamLabel(t),
              value: progress < 21 ? `next: ${ATC_LABELS[progress]}` : "DONE",
            };
          })}
        />
      }
    >
      <div className={styles.rows}>
        {teams.map((t) => {
          const progress = state.progressByTeam[t.id] ?? 0;
          return (
            <div key={t.id} className={styles.row}>
              <div className={styles.head}>
                <span
                  className={styles.dot}
                  style={{ background: `var(--team-color-${t.colorId})` }}
                />
                <span className={styles.name}>{getTeamLabel(t)}</span>
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
    </CollapsibleScoreboard>
  );
}
