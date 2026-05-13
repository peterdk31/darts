import type { ResolvedSettings } from "@/shared/types/game-module";
import type { Team } from "@/shared/types/core";
import { getTeamLabel } from "@/shared/teams/teamLabel";
import {
  CollapsibleScoreboard,
  ScoreSummary,
} from "@/shared/components/CollapsibleScoreboard";
import type { MinesweeperEngineState } from "../engine";
import styles from "./ScoreboardPanel.module.css";

interface Props {
  state: MinesweeperEngineState;
  resolvedSettings: ResolvedSettings;
  teams: ReadonlyArray<Team>;
  scoreboardExpanded?: boolean;
}

export function ScoreboardPanel({ state, teams, scoreboardExpanded }: Props) {
  const safeCount = 20 - state.mines.length + 1;

  return (
    <CollapsibleScoreboard
      expanded={scoreboardExpanded}
      summary={
        <ScoreSummary
          teams={teams.map((t) => {
            const score = state.scores[t.id] ?? 0;
            const lives = state.lives[t.id] ?? 0;
            const eliminated = state.eliminatedTeamIds.includes(t.id);

            let value: string;
            if (eliminated) {
              value = "OUT";
            } else {
              value = `${score} · ${"♥".repeat(lives)}`;
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
      <div className={styles.roundBadge}>
        Round {state.round} — {safeCount} safe · {state.mines.length} mines
      </div>

      <div className={styles.cards}>
        {teams.map((t) => {
          const score = state.scores[t.id] ?? 0;
          const lives = state.lives[t.id] ?? 0;
          const eliminated = state.eliminatedTeamIds.includes(t.id);

          return (
            <div
              key={t.id}
              className={eliminated ? styles.cardEliminated : styles.card}
              style={{
                borderLeftColor: `var(--team-color-${t.colorId})`,
              }}
            >
              <div className={styles.info}>
                <div className={styles.name}>{getTeamLabel(t)}</div>
                {!eliminated && (
                  <div className={styles.livesBar}>
                    {Array.from({ length: state.maxLives }, (_, i) => (
                      <span
                        key={i}
                        className={i < lives ? styles.pip : styles.pipEmpty}
                      />
                    ))}
                  </div>
                )}
                {eliminated && (
                  <div className={styles.outLabel}>ELIMINATED</div>
                )}
              </div>

              <div className={styles.right}>
                <span className={styles.score}>{score}</span>
                {!eliminated && (
                  <span
                    className={lives > 0 ? styles.livesCount : styles.livesZero}
                  >
                    ♥{lives}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </CollapsibleScoreboard>
  );
}
