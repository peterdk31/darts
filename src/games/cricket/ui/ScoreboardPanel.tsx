import type { ResolvedSettings } from "@/shared/types/game-module";
import type { Team } from "@/shared/types/core";
import { type CricketEngineState, CRICKET_TARGETS } from "../engine";
import styles from "./ScoreboardPanel.module.css";

interface Props {
  state: CricketEngineState;
  resolvedSettings: ResolvedSettings;
  teams: ReadonlyArray<Team>;
}

function marksGlyph(n: number): string {
  if (n <= 0) return "";
  if (n === 1) return "/";
  if (n === 2) return "X";
  return "Ⓧ"; // closed
}

export function ScoreboardPanel({ state, teams }: Props) {
  return (
    <div className={styles.panel}>
      <table className={styles.grid}>
        <thead>
          <tr>
            <th className={styles.targetHeader} aria-label="Number" />
            {teams.map((t) => (
              <th key={t.id} className={styles.teamHeader}>
                <span
                  className={styles.dot}
                  style={{ background: `var(--team-color-${t.colorId})` }}
                />
                <span>{t.displayName}</span>
                <span className={styles.score}>
                  {state.scoreByTeam[t.id] ?? 0}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {CRICKET_TARGETS.map((tg) => (
            <tr key={String(tg)}>
              <th scope="row" className={styles.targetCell}>
                {tg === "bull" ? "Bull" : tg}
              </th>
              {teams.map((t) => {
                const m = state.marksByTeam[t.id]?.[String(tg)] ?? 0;
                return (
                  <td key={t.id} className={styles.markCell}>
                    {marksGlyph(m)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
