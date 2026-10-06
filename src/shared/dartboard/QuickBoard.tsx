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

function isMiss(action: QuickInputAction): boolean {
  return action.variant === "miss" || action.segment === "miss";
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
    return classes.filter(Boolean).join(" ");
  }

  // Miss is rendered by the play page as a pinned bar for every board layout.
  const targetGroups = groups
    .map((g) => ({ ...g, actions: g.actions.filter((a) => !isMiss(a)) }))
    .filter((g) => g.actions.length > 0);

  function renderButton(action: QuickInputAction, key: number) {
    return (
      <button
        key={key}
        type="button"
        className={btnClass(action)}
        onClick={() => handleClick(action)}
        disabled={disabled}
      >
        <span>{action.label}</span>
        {action.marks && (
          <span
            className={styles.marks}
            role="img"
            aria-label={`${action.marks.current} of ${action.marks.max} hits`}
          >
            {Array.from({ length: action.marks.max }, (_, i) => (
              <span
                key={i}
                className={`${styles.markSegment} ${i < action.marks!.current ? styles.markFilled : ""}`}
              />
            ))}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className={styles.wrapper}>
      <div className={`${styles.container} ${disabled ? styles.disabled : ""}`}>
        {targetGroups.map((group, gi) => (
          <div key={gi} className={styles.group}>
            {group.label && <div className={styles.groupLabel}>{group.label}</div>}
            <div className={styles.buttons}>
              {group.actions.map(renderButton)}
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
