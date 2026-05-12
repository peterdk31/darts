import type { ReactNode } from "react";
import styles from "./CollapsibleScoreboard.module.css";

interface Props {
  summary: ReactNode;
  children: ReactNode;
  expanded?: boolean;
}

export function CollapsibleScoreboard({ summary, children, expanded = true }: Props) {
  return (
    <div className={styles.wrapper} data-expanded={expanded || undefined}>
      <div className={styles.summary}>{summary}</div>
      <div className={styles.details}>{children}</div>
    </div>
  );
}

export function ScoreSummary({
  teams,
}: {
  teams: ReadonlyArray<{ colorId: string; label: string; value: string }>;
}) {
  return (
    <div className={styles.scores}>
      {teams.map((t) => (
        <span key={t.colorId} className={styles.scoreEntry}>
          <span
            className={styles.scoreDot}
            style={{ background: `var(--team-color-${t.colorId})` }}
          />
          <span className={styles.scoreLabel}>{t.label}</span>
          <span className={styles.scoreValue}>{t.value}</span>
        </span>
      ))}
    </div>
  );
}
