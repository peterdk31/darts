import { useEffect } from "react";
import styles from "./BustBanner.module.css";

interface Props {
  open: boolean;
  label?: string;
  detail?: string;
  durationMs?: number;
  onDismiss: () => void;
}

export function BustBanner({ open, label = "BUST", detail, durationMs = 2500, onDismiss }: Props) {
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(t);
  }, [open, durationMs, onDismiss]);

  if (!open) return null;

  return (
    <div className={styles.banner} role="alert" aria-live="assertive">
      <span className={styles.label}>{label}</span>
      {detail && <span className={styles.detail}>{detail}</span>}
    </div>
  );
}
