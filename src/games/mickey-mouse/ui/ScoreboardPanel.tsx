import type { ResolvedSettings, ScoreboardHit } from "@/shared/types/game-module";
import type { Team } from "@/shared/types/core";
import { type MickeyEngineState, type MickeyTarget } from "../engine";
import styles from "./ScoreboardPanel.module.css";

interface Props {
  state: MickeyEngineState;
  resolvedSettings: ResolvedSettings;
  teams: ReadonlyArray<Team>;
  onScoreboardHit?: (hit: ScoreboardHit) => void;
}

function targetLabel(tg: number | string): string {
  if (tg === "double") return "D";
  if (tg === "triple") return "T";
  if (tg === "bull") return "B";
  return String(tg);
}

function marksGlyph(n: number): { text: string; closed: boolean } {
  const clamped = Math.min(n, 3);
  if (clamped <= 0) return { text: "", closed: false };
  return { text: "x".repeat(clamped), closed: clamped >= 3 };
}

function hitForTarget(tg: MickeyTarget): ScoreboardHit {
  if (tg === "double") return { segment: 20, multiplier: 2, intent: "double" };
  if (tg === "triple") return { segment: 20, multiplier: 3, intent: "triple" };
  if (tg === "bull") return { segment: "outer-bull", multiplier: 1 };
  return { segment: tg, multiplier: 1 };
}

function settingsChipText(state: MickeyEngineState): string {
  const parts: string[] = [String(state.startingNumber)];
  parts.push(state.multipliersScore ? "mult" : "×1");
  parts.push(state.dtRequireTargetRange ? "+D/T range" : "+D/T any");
  return parts.join(" · ");
}

export function ScoreboardPanel({ state, teams, onScoreboardHit }: Props) {
  const currentTeamId = state.turnOrder[state.pointer.teamIdx];
  const currentMarks = state.marksByTeam[currentTeamId!] ?? {};

  return (
    <div className={styles.panel}>
      <div className={styles.chips}>
        <span className={styles.chip}>{settingsChipText(state)}</span>
      </div>
      <table className={styles.grid}>
        <thead>
          <tr>
            <th className={styles.targetHeader} aria-label="Target" />
            {teams.map((t) => (
              <th key={t.id} className={styles.teamHeader}>
                <span
                  className={styles.dot}
                  style={{ background: `var(--team-color-${t.colorId})` }}
                />
                <span>{t.displayName}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {state.targets.map((tg) => {
            const disabled = (currentMarks[String(tg)] ?? 0) >= 3;
            const clickable = !!onScoreboardHit && !disabled;
            return (
              <tr
                key={String(tg)}
                className={`${disabled ? styles.disabled : ""} ${clickable ? styles.clickable : ""}`}
                onClick={clickable ? () => onScoreboardHit(hitForTarget(tg)) : undefined}
              >
                <th scope="row" className={styles.targetCell}>
                  {targetLabel(tg)}
                </th>
                {teams.map((t) => {
                  const m = state.marksByTeam[t.id]?.[String(tg)] ?? 0;
                  const { text, closed } = marksGlyph(m);
                  return (
                    <td key={t.id} className={styles.markCell}>
                      {closed ? <s>{text}</s> : text}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
