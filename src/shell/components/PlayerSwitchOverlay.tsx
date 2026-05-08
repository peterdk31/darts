import { useEffect } from "react";
import type { TeamColorId } from "@/shared/types/core";
import { COLOR_LABELS } from "@/shared/teams/colors";
import styles from "./PlayerSwitchOverlay.module.css";

interface Props {
  playerName: string;
  teamColorId: TeamColorId;
  onDismiss: () => void;
}

export function PlayerSwitchOverlay({ playerName, teamColorId, onDismiss }: Props) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 2000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div
      className={styles.overlay}
      onClick={onDismiss}
      role="status"
      aria-live="assertive"
    >
      <span
        className={styles.badge}
        style={{
          background: `var(--team-color-${teamColorId})`,
          color: `var(--team-color-${teamColorId}-on)`,
        }}
      >
        {COLOR_LABELS[teamColorId]} Team
      </span>
      <span className={styles.name}>{playerName}</span>
      <span className={styles.hint}>Tap to continue</span>
    </div>
  );
}
