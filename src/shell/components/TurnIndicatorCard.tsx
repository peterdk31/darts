import type { Team } from "@/shared/types/core";
import styles from "./TurnIndicatorCard.module.css";

interface Props {
  team: Team;
  player: { id: string; displayName: string };
  dartsThrownThisTurn: number;
  dartsAllotmentForPlayer: number;
}

export function TurnIndicatorCard({
  team,
  player,
  dartsThrownThisTurn,
  dartsAllotmentForPlayer,
}: Props) {
  const remaining = Math.max(0, dartsAllotmentForPlayer - dartsThrownThisTurn);
  const pips: ("filled" | "empty")[] = [];
  for (let i = 0; i < dartsAllotmentForPlayer; i++) {
    pips.push(i < dartsThrownThisTurn ? "filled" : "empty");
  }

  return (
    <div className={styles.card}>
      <span
        className={styles.stripe}
        style={{ background: `var(--team-color-${team.colorId})` }}
        aria-hidden="true"
      />
      <span className={styles.player}>{player.displayName}</span>
      <span
        className={styles.pips}
        aria-label={`${dartsThrownThisTurn} of ${dartsAllotmentForPlayer} darts thrown, ${remaining} left`}
      >
        {pips.map((p, i) => (
          <span
            key={i}
            className={p === "filled" ? styles.pipFilled : styles.pipEmpty}
            aria-hidden="true"
          />
        ))}
      </span>
    </div>
  );
}
