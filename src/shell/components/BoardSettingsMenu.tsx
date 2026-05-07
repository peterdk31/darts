import { useEffect, useRef, useState } from "react";
import type { BoardLayout, BoardTheme } from "@/shared/prefs";
import styles from "./BoardSettingsMenu.module.css";

interface Props {
  boardTheme: BoardTheme;
  boardLayout: BoardLayout;
  onChangeTheme: (theme: BoardTheme) => void;
  onChangeLayout: (layout: BoardLayout) => void;
}

export function BoardSettingsMenu({
  boardTheme,
  boardLayout,
  onChangeTheme,
  onChangeLayout,
}: Props) {
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
          <div className={styles.title}>Board layout</div>
          <label className={styles.row}>
            <input
              type="radio"
              name="board-layout"
              value="classic"
              checked={boardLayout === "classic"}
              onChange={() => onChangeLayout("classic")}
            />
            Classic
          </label>
          <label className={styles.row}>
            <input
              type="radio"
              name="board-layout"
              value="grid"
              checked={boardLayout === "grid"}
              onChange={() => onChangeLayout("grid")}
            />
            Grid
          </label>

          {boardLayout === "classic" && (
            <>
              <div className={`${styles.title} ${styles.titleSeparated}`}>Board theme</div>
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
            </>
          )}
        </div>
      )}
    </div>
  );
}
