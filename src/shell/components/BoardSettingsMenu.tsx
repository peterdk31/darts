import { useEffect, useRef, useState } from "react";
import type { BoardTheme } from "@/shared/prefs";
import styles from "./BoardSettingsMenu.module.css";

interface Props {
  boardTheme: BoardTheme;
  onChangeTheme: (theme: BoardTheme) => void;
}

export function BoardSettingsMenu({ boardTheme, onChangeTheme }: Props) {
  const [open, setOpen] = useState(false);
  const popRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className={styles.wrap} ref={popRef}>
      <button
        type="button"
        className={styles.gear}
        aria-label="Board settings"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        ⚙
      </button>
      {open && (
        <div role="menu" className={styles.popover}>
          <div className={styles.title}>Board theme</div>
          <label className={styles.row}>
            <input
              type="radio"
              name="board-theme"
              value="traditional"
              checked={boardTheme === "traditional"}
              onChange={() => onChangeTheme("traditional")}
            />
            Traditional
          </label>
          <label className={styles.row}>
            <input
              type="radio"
              name="board-theme"
              value="desaturated"
              checked={boardTheme === "desaturated"}
              onChange={() => onChangeTheme("desaturated")}
            />
            Desaturated
          </label>
        </div>
      )}
    </div>
  );
}
