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
                  className={`${styles.btn} ${action.segment === "miss" ? styles.missBtn : ""}`}
                  onClick={() => handleClick(action)}
                  disabled={disabled}
                >
                  {action.label}
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
