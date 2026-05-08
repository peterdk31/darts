import type { ResolvedSettings, ScoreboardHit } from "@/shared/types/game-module";
import type { Team } from "@/shared/types/core";
import { getTeamLabel } from "@/shared/teams/teamLabel";
import { CollapsibleScoreboard, ScoreSummary } from "@/shared/components/CollapsibleScoreboard";
import { type CricketEngineState, type CricketTarget, CRICKET_TARGETS } from "../engine";
import styles from "./ScoreboardPanel.module.css";

interface Props {
  state: CricketEngineState;
  resolvedSettings: ResolvedSettings;
  teams: ReadonlyArray<Team>;
  onScoreboardHit?: (hit: ScoreboardHit) => void;
}

function marksGlyph(n: number): string {
  if (n <= 0) return "";
  if (n === 1) return "/";
  if (n === 2) return "X";
  return "Ⓧ";
}

function hitForTarget(tg: CricketTarget): ScoreboardHit {
  if (tg === "bull") return { segment: "outer-bull", multiplier: 1 };
  return { segment: tg, multiplier: 1 };
}

export function ScoreboardPanel({ state, teams, onScoreboardHit }: Props) {
  const allClosed = (tg: CricketTarget) =>
    state.teams.every((t) => (state.marksByTeam[t.id]?.[String(tg)] ?? 0) >= 3);

  return (
    <CollapsibleScoreboard
      summary={
        <ScoreSummary
          teams={teams.map((t) => ({
            colorId: t.colorId,
            label: getTeamLabel(t),
            value: String(state.scoreByTeam[t.id] ?? 0),
          }))}
        />
      }
    >
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
                <span>{getTeamLabel(t)}</span>
                <span className={styles.score}>
                  {state.scoreByTeam[t.id] ?? 0}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {CRICKET_TARGETS.map((tg) => {
            const disabled = allClosed(tg);
            const clickable = !!onScoreboardHit && !disabled;
            return (
              <tr
                key={String(tg)}
                className={`${disabled ? styles.disabled : ""} ${clickable ? styles.clickable : ""}`}
                onClick={clickable ? () => onScoreboardHit(hitForTarget(tg)) : undefined}
              >
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
            );
          })}
        </tbody>
      </table>
    </CollapsibleScoreboard>
  );
}
