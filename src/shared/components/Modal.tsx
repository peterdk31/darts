import { useEffect, type ReactNode } from "react";
import styles from "./Modal.module.css";

interface Props {
  open: boolean;
  onClose?: () => void;
  title?: string;
  children: ReactNode;
  /** When true, clicks outside / Escape do nothing. Used for non-dismissable-until-acknowledged. */
  forceAcknowledge?: boolean;
  labelledBy?: string;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  forceAcknowledge = false,
  labelledBy,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (forceAcknowledge) return;
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, forceAcknowledge]);

  if (!open) return null;

  return (
    <div
      className={styles.overlay}
      onClick={(e) => {
        if (forceAcknowledge) return;
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={styles.dialog}
      >
        {title && (
          <h2 id={labelledBy} className={styles.title}>
            {title}
          </h2>
        )}
        {children}
      </div>
    </div>
  );
}
