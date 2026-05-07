import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { BoardHints, DartSegment } from "@/shared/types/game-module";
import type { DartboardThrow } from "./Dartboard";
import styles from "./GridBoard.module.css";

interface Props {
  onThrow: (t: DartboardThrow) => void;
  boardHints?: BoardHints;
  disabled?: boolean;
  overlay?: ReactNode;
}

const NUMBERS = Array.from({ length: 20 }, (_, i) => i + 1);

function makeFlashKey(): number {
  return Date.now() + Math.random();
}

export function GridBoard({ onThrow, boardHints, disabled = false, overlay }: Props) {
  const [flash, setFlash] = useState<{ key: number; label: string } | null>(null);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 800);
    return () => clearTimeout(t);
  }, [flash]);

  const highlightSet = useMemo(
    () => new Set<DartSegment>(boardHints?.highlight ?? []),
    [boardHints],
  );
  const dimSet = useMemo(
    () => new Set<DartSegment>(boardHints?.dim ?? []),
    [boardHints],
  );
  const highlightDoublesSet = useMemo(
    () => new Set<DartSegment>(boardHints?.highlightDoubles ?? []),
    [boardHints],
  );
  const highlightTriplesSet = useMemo(
    () => new Set<DartSegment>(boardHints?.highlightTriples ?? []),
    [boardHints],
  );
  const highlightBullInner = boardHints?.highlightBullInner ?? false;

  function fire(t: DartboardThrow) {
    if (disabled) return;
    setFlash({ key: makeFlashKey(), label: t.label });
    onThrow(t);
  }

  function handleNumber(num: number, multiplier: 1 | 2 | 3) {
    const label = `${multiplier === 3 ? "Triple " : multiplier === 2 ? "Double " : ""}${num}`;
    fire({ segment: num, multiplier, score: num * multiplier, cx: 200, cy: 200, label });
  }

  function handleBull(kind: "outer" | "inner") {
    if (kind === "outer") {
      fire({ segment: "outer-bull", multiplier: 1, score: 25, cx: 200, cy: 200, label: "Outer Bull" });
    } else {
      fire({ segment: "inner-bull", multiplier: 1, score: 50, cx: 200, cy: 200, label: "Inner Bull" });
    }
  }

  function cellHintClass(num: number, ring: "single" | "double" | "triple"): string {
    const seg = num as DartSegment;
    if (highlightSet.has(seg)) return styles.highlight!;
    if (ring === "double" && highlightDoublesSet.has(seg)) return styles.highlight!;
    if (ring === "triple" && highlightTriplesSet.has(seg)) return styles.highlight!;
    if (dimSet.has(seg)) return styles.dim!;
    return "";
  }

  function bullHintClass(inner?: boolean): string {
    if (highlightSet.has("bull")) return styles.highlight!;
    if (inner && highlightBullInner) return styles.highlight!;
    if (dimSet.has("bull")) return styles.dim!;
    return "";
  }

  function isDimmed(num: number): boolean {
    return dimSet.has(num as DartSegment);
  }

  function isBullDimmed(): boolean {
    return dimSet.has("bull");
  }

  return (
    <div className={styles.wrapper}>
      <div className={`${styles.grid} ${disabled ? styles.disabled : ""}`}>
        {NUMBERS.map((num) => (
          <div key={num} className={`${styles.cell} ${isDimmed(num) ? styles.cellDim : ""}`}>
            <button
              type="button"
              className={`${styles.single} ${cellHintClass(num, "single")}`}
              onClick={() => handleNumber(num, 1)}
              disabled={disabled}
              aria-label={`Single ${num}`}
            >
              {num}
            </button>
            <div className={styles.multipliers}>
              <button
                type="button"
                className={`${styles.multi} ${styles.dbl} ${cellHintClass(num, "double")}`}
                onClick={() => handleNumber(num, 2)}
                disabled={disabled}
                aria-label={`Double ${num}`}
              >
                D
              </button>
              <button
                type="button"
                className={`${styles.multi} ${styles.tpl} ${cellHintClass(num, "triple")}`}
                onClick={() => handleNumber(num, 3)}
                disabled={disabled}
                aria-label={`Triple ${num}`}
              >
                T
              </button>
            </div>
          </div>
        ))}

        <div className={`${styles.cell} ${styles.bullCell} ${isBullDimmed() ? styles.cellDim : ""}`}>
          <button
            type="button"
            className={`${styles.single} ${styles.bullBtn} ${bullHintClass(false)}`}
            onClick={() => handleBull("outer")}
            disabled={disabled}
            aria-label="Outer bull, 25"
          >
            25
          </button>
          <button
            type="button"
            className={`${styles.single} ${styles.bullInnerBtn} ${bullHintClass(true)}`}
            onClick={() => handleBull("inner")}
            disabled={disabled}
            aria-label="Inner bull, 50"
          >
            50
          </button>
        </div>
      </div>

      {flash && (
        <div key={flash.key} className={styles.flash}>
          {flash.label}
        </div>
      )}

      {overlay && <div className={styles.overlay}>{overlay}</div>}
    </div>
  );
}
