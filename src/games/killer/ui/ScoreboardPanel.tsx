import type { ResolvedSettings } from "@/shared/types/game-module";
import type { Team } from "@/shared/types/core";
import { getTeamLabel } from "@/shared/teams/teamLabel";
import {
  CollapsibleScoreboard,
  ScoreSummary,
} from "@/shared/components/CollapsibleScoreboard";
import { KILLER_THRESHOLD, type KillerEngineState } from "../engine";

function pipCount(state: KillerEngineState, lives: number): number {
  if (state.maxLives > 0) return state.maxLives;
  return Math.max(KILLER_THRESHOLD, lives);
}
import styles from "./ScoreboardPanel.module.css";

interface Props {
  state: KillerEngineState;
  resolvedSettings: ResolvedSettings;
  teams: ReadonlyArray<Team>;
  scoreboardExpanded?: boolean;
}

export function ScoreboardPanel({ state, teams, scoreboardExpanded }: Props) {
  return (
    <CollapsibleScoreboard
      expanded={scoreboardExpanded}
      summary={
        <ScoreSummary
          teams={teams.map((t) => {
            const num = state.assignments[t.id];
            const lives = state.lives[t.id] ?? 0;
            const killer = state.isKiller[t.id] ?? false;
            const eliminated = state.eliminatedTeamIds.includes(t.id);

            let value: string;
            if (state.phase === "number-selection") {
              value = num !== undefined ? `#${num}` : "…";
            } else if (eliminated) {
              value = "OUT";
            } else {
              value = `♥${lives}${killer ? " K" : ""}`;
            }

            return {
              colorId: t.colorId,
              label: getTeamLabel(t),
              value,
            };
          })}
        />
      }
    >
      <div className={styles.cards}>
        {teams.map((t) => {
          const num = state.assignments[t.id];
          const lives = state.lives[t.id] ?? 0;
          const killer = state.isKiller[t.id] ?? false;
          const eliminated = state.eliminatedTeamIds.includes(t.id);

          return (
            <div
              key={t.id}
              className={eliminated ? styles.cardEliminated : styles.card}
              style={{
                borderLeftColor: `var(--team-color-${t.colorId})`,
              }}
            >
              <div className={styles.number}>
                {num !== undefined ? num : "?"}
              </div>

              <div className={styles.info}>
                <div className={styles.name}>{getTeamLabel(t)}</div>
                {state.phase === "playing" && !eliminated && (
                  <div className={styles.livesBar}>
                    {Array.from(
                      { length: pipCount(state, lives) },
                      (_, i) => (
                        <span
                          key={i}
                          className={
                            i < lives ? styles.pip : styles.pipEmpty
                          }
                        />
                      ),
                    )}
                  </div>
                )}
                {eliminated && (
                  <div className={styles.outLabel}>ELIMINATED</div>
                )}
              </div>

              {state.phase === "playing" && !eliminated && (
                <div className={styles.right}>
                  <span
                    className={
                      lives > 0 ? styles.livesCount : styles.livesZero
                    }
                  >
                    ♥{lives}
                  </span>
                  {killer && <span className={styles.killerBadge}>KILLER</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </CollapsibleScoreboard>
  );
}
