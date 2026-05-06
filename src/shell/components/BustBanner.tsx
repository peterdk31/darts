import { useEffect } from "react";
import styles from "./BustBanner.module.css";

interface Props {
  open: boolean;
  /** The team's score immediately after the bust (i.e., reverted to start-of-turn). */
  revertedScore?: number;
  durationMs?: number;
  onDismiss: () => void;
}

export function BustBanner({ open, revertedScore, durationMs = 2500, onDismiss }: Props) {
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(t);
  }, [open, durationMs, onDismiss]);

  if (!open) return null;

  return (
    <div className={styles.banner} role="alert" aria-live="assertive">
      <span className={styles.label}>BUST</span>
      {typeof revertedScore === "number" && (
        <span className={styles.detail}>score reverts to {revertedScore}</span>
      )}
    </div>
  );
}
