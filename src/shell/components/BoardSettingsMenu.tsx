import { useEffect, useRef, useState } from "react";
import type { AppTheme, BoardLayout } from "@/shared/prefs";
import type { SettingDefinition, ResolvedSettings } from "@/shared/types/game-module";
import styles from "./BoardSettingsMenu.module.css";

interface Props {
  boardLayout: BoardLayout;
  onChangeLayout: (layout: BoardLayout) => void;
  settingsSchema?: ReadonlyArray<SettingDefinition>;
  resolvedSettings?: ResolvedSettings;
  hasQuickInputs?: boolean;
  scoreboardExpanded?: boolean;
  onToggleScoreboard?: () => void;
  appTheme?: AppTheme;
  onChangeAppTheme?: (theme: AppTheme) => void;
}

function formatValue(def: SettingDefinition, v: boolean | number | string): string {
  if (def.type === "toggle") return v ? "On" : "Off";
  if (def.type === "choice") {
    return def.constraints.choices.find((c) => c.value === String(v))?.label ?? String(v);
  }
  return String(v);
}

export function BoardSettingsMenu({
  boardLayout,
  onChangeLayout,
  settingsSchema,
  resolvedSettings,
  hasQuickInputs,
  scoreboardExpanded,
  onToggleScoreboard,
  appTheme,
  onChangeAppTheme,
}: Props) {
  const [open, setOpen] = useState(false);
  const popRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className={styles.wrap} ref={popRef}>
      {open && (
        <div
          className={styles.backdrop}
          onClick={() => setOpen(false)}
          onTouchEnd={(e) => { e.preventDefault(); setOpen(false); }}
        />
      )}
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

          {onToggleScoreboard && (
            <>
              <div className={`${styles.title} ${styles.titleSeparated}`}>Scoreboard</div>
              <button
                type="button"
                className={styles.switchRow}
                onClick={onToggleScoreboard}
              >
                <span>Show details</span>
                <span className={`${styles.switchTrack} ${scoreboardExpanded ? styles.switchOn : ""}`}>
                  <span className={styles.switchThumb} />
                </span>
              </button>
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

          {onChangeAppTheme && appTheme && (
            <>
              <div className={`${styles.title} ${styles.titleSeparated}`}>Theme</div>
              <div className={styles.segmented}>
                <label className={`${styles.seg} ${appTheme === "system" ? styles.segActive : ""}`}>
                  <input type="radio" name="app-theme" value="system" checked={appTheme === "system"} onChange={() => onChangeAppTheme("system")} />
                  Auto
                </label>
                <label className={`${styles.seg} ${appTheme === "light" ? styles.segActive : ""}`}>
                  <input type="radio" name="app-theme" value="light" checked={appTheme === "light"} onChange={() => onChangeAppTheme("light")} />
                  Light
                </label>
                <label className={`${styles.seg} ${appTheme === "dark" ? styles.segActive : ""}`}>
                  <input type="radio" name="app-theme" value="dark" checked={appTheme === "dark"} onChange={() => onChangeAppTheme("dark")} />
                  Dark
                </label>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
