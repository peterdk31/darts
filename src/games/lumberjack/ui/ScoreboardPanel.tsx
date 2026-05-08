import type { ResolvedSettings } from "@/shared/types/game-module";
import type { Team } from "@/shared/types/core";
import { getTeamLabel } from "@/shared/teams/teamLabel";
import {
  LUMBERJACK_ROUNDS,
  type LumberjackEngineState,
} from "../engine";
import styles from "./ScoreboardPanel.module.css";

interface Props {
  state: LumberjackEngineState;
  resolvedSettings: ResolvedSettings;
  teams: ReadonlyArray<Team>;
}

function renderCell(
  state: LumberjackEngineState,
  teamId: string,
  roundIdx: number,
): string {
  const log = state.roundLog[teamId] ?? [];

  if (roundIdx < log.length) {
    const entry = log[roundIdx]!;
    if (entry.halved) return "½";
    if (entry.scored === 0) return "–";
    return String(entry.scored);
  }

  if (roundIdx === state.currentRound) {
    const round = LUMBERJACK_ROUNDS[roundIdx]!;
    const currentTeamId = state.turnOrder[state.pointer.teamIdx];
    if (teamId === currentTeamId) {
      if (round.type === "exact41") {
        const chanceTotal = state.r41ChanceTotal[teamId] ?? 0;
        const hitCount = state.r41HitCount[teamId] ?? 0;
        if (chanceTotal > 0) return `${chanceTotal}/41`;
        if (hitCount > 0) return `${hitCount}×41`;
        return "·";
      }
      const pts = state.roundPointsByTeam[teamId] ?? 0;
      if (pts > 0) return String(pts);
      return "·";
    }
    return "";
  }

  return "";
}

export function ScoreboardPanel({ state, teams }: Props) {
  const inProgress = state.currentRound < LUMBERJACK_ROUNDS.length;
  const currentRound = inProgress ? LUMBERJACK_ROUNDS[state.currentRound]! : null;

  return (
    <div className={styles.panel}>
      <div className={styles.chips}>
        {currentRound && (
          <span className={styles.chip}>
            Rd {state.currentRound + 1}/10 &middot; {currentRound.label}
          </span>
        )}
        <span className={styles.chip}>{state.dtAbove15Only ? "D/T 16+" : "D/T any"}</span>
      </div>

      <table className={styles.grid}>
        <thead>
          <tr>
            <th className={styles.targetHeader} aria-label="Round" />
            {teams.map((t) => (
              <th key={t.id} className={styles.teamHeader}>
                <span
                  className={styles.dot}
                  style={{ background: `var(--team-color-${t.colorId})` }}
                />
                <span>{getTeamLabel(t)}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {LUMBERJACK_ROUNDS.map((round, i) => {
            const isActive = i === state.currentRound;
            const isFuture = i > state.currentRound;
            let rowClass = "";
            if (isActive) rowClass = styles.activeRound ?? "";
            else if (isFuture) rowClass = styles.futureRound ?? "";
            return (
              <tr key={i} className={rowClass}>
                <th scope="row" className={styles.targetCell}>
                  {round.label}
                </th>
                {teams.map((t) => {
                  const text = renderCell(state, t.id, i);
                  const isHalved = text === "½";
                  return (
                    <td
                      key={t.id}
                      className={`${styles.scoreCell} ${isHalved ? styles.halved : ""}`}
                    >
                      {text}
                    </td>
                  );
                })}
              </tr>
            );
          })}
          <tr className={styles.totalRow}>
            <th scope="row" className={styles.targetCell}>
              &Sigma;
            </th>
            {teams.map((t) => (
              <td key={t.id} className={styles.totalCell}>
                {state.scoreByTeam[t.id] ?? 0}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
