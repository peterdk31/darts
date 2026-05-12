import { useEffect, useState } from "react";
import type { QuickInputAction, QuickInputGroup } from "@/shared/types/game-module";
import type { DartboardThrow } from "./Dartboard";
import styles from "./QuickBoard.module.css";

interface Props {
  groups: QuickInputGroup[];
  onThrow: (t: DartboardThrow) => void;
  disabled?: boolean;
}

function makeFlashKey(): number {
  return Date.now() + Math.random();
}

export function QuickBoard({ groups, onThrow, disabled = false }: Props) {
  const [flash, setFlash] = useState<{ key: number; label: string } | null>(null);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 800);
    return () => clearTimeout(t);
  }, [flash]);

  function handleClick(action: QuickInputAction) {
    if (disabled) return;
    setFlash({ key: makeFlashKey(), label: action.label });
    onThrow({
      segment: action.segment,
      multiplier: action.multiplier,
      score: action.score,
      cx: 200,
      cy: 200,
      label: action.label,
      intent: action.intent,
    });
  }

  function btnClass(action: QuickInputAction): string {
    const classes = [styles.btn];
    if (action.variant === "meta") classes.push(styles.metaBtn!);
    else if (action.variant === "miss" || action.segment === "miss") classes.push(styles.missBtn!);
    return classes.filter(Boolean).join(" ");
  }

  return (
    <div className={styles.wrapper}>
      <div className={`${styles.container} ${disabled ? styles.disabled : ""}`}>
        {groups.map((group, gi) => (
          <div key={gi} className={styles.group}>
            {group.label && <div className={styles.groupLabel}>{group.label}</div>}
            <div className={styles.buttons}>
              {group.actions.map((action, ai) => (
                <button
                  key={ai}
                  type="button"
                  className={btnClass(action)}
                  onClick={() => handleClick(action)}
                  disabled={disabled}
                >
                  <span>{action.label}</span>
                  {action.marks && (
                    <span className={styles.marks}>
                      {"●".repeat(action.marks.current)}
                      {"○".repeat(action.marks.max - action.marks.current)}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {flash && (
        <div key={flash.key} className={styles.flash}>
          {flash.label}
        </div>
      )}
    </div>
  );
}
