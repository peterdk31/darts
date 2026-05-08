import { useEffect, useRef, useState } from "react";
import type { BoardLayout, BoardTheme } from "@/shared/prefs";
import type { SettingDefinition, ResolvedSettings } from "@/shared/types/game-module";
import styles from "./BoardSettingsMenu.module.css";

interface Props {
  boardTheme: BoardTheme;
  boardLayout: BoardLayout;
  onChangeTheme: (theme: BoardTheme) => void;
  onChangeLayout: (layout: BoardLayout) => void;
  settingsSchema?: ReadonlyArray<SettingDefinition>;
  resolvedSettings?: ResolvedSettings;
  hasQuickInputs?: boolean;
}

function formatValue(def: SettingDefinition, v: boolean | number | string): string {
  if (def.type === "toggle") return v ? "On" : "Off";
  if (def.type === "choice") {
    return def.constraints.choices.find((c) => c.value === String(v))?.label ?? String(v);
  }
  return String(v);
}

export function BoardSettingsMenu({
  boardTheme,
  boardLayout,
  onChangeTheme,
  onChangeLayout,
  settingsSchema,
  resolvedSettings,
  hasQuickInputs,
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
          <div className={styles.title}>Layout</div>
          <div className={styles.segmented}>
            <label className={`${styles.seg} ${boardLayout === "classic" ? styles.segActive : ""}`}>
              <input type="radio" name="board-layout" value="classic" checked={boardLayout === "classic"} onChange={() => onChangeLayout("classic")} />
              Classic
            </label>
            <label className={`${styles.seg} ${boardLayout === "grid" ? styles.segActive : ""}`}>
              <input type="radio" name="board-layout" value="grid" checked={boardLayout === "grid"} onChange={() => onChangeLayout("grid")} />
              Grid
            </label>
            {hasQuickInputs && (
              <label className={`${styles.seg} ${boardLayout === "quick" ? styles.segActive : ""}`}>
                <input type="radio" name="board-layout" value="quick" checked={boardLayout === "quick"} onChange={() => onChangeLayout("quick")} />
                Quick
              </label>
            )}
          </div>

          {boardLayout === "classic" && (
            <>
              <div className={`${styles.title} ${styles.titleSeparated}`}>Theme</div>
              <div className={styles.segmented}>
                <label className={`${styles.seg} ${boardTheme === "traditional" ? styles.segActive : ""}`}>
                  <input type="radio" name="board-theme" value="traditional" checked={boardTheme === "traditional"} onChange={() => onChangeTheme("traditional")} />
                  Traditional
                </label>
                <label className={`${styles.seg} ${boardTheme === "desaturated" ? styles.segActive : ""}`}>
                  <input type="radio" name="board-theme" value="desaturated" checked={boardTheme === "desaturated"} onChange={() => onChangeTheme("desaturated")} />
                  Desaturated
                </label>
              </div>
            </>
          )}

          {settingsSchema && settingsSchema.length > 0 && resolvedSettings && (
            <>
              <div className={`${styles.title} ${styles.titleSeparated}`}>Game rules</div>
              {settingsSchema.map((def) => {
                const v = resolvedSettings[def.key] ?? def.default;
                if (def.type === "toggle") {
                  return (
                    <div key={def.key} className={`${styles.settingsToggle} ${v ? styles.toggleOn : ""}`}>
                      <span className={styles.toggleMark}>{v ? "✓" : "–"}</span>
                      {def.label}
                    </div>
                  );
                }
                return (
                  <div key={def.key} className={styles.settingsRow}>
                    <span className={styles.settingsLabel}>{def.label}</span>
                    <span className={styles.settingsValue}>{formatValue(def, v)}</span>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
