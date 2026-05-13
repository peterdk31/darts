import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { BoardHints, DartSegment, SegmentRing } from "@/shared/types/game-module";
import type { DartboardThrow } from "./Dartboard";
import styles from "./GridBoard.module.css";

interface Props {
  onThrow: (t: DartboardThrow) => void;
  boardHints?: BoardHints;
  disabled?: boolean;
  overlay?: ReactNode;
}

const NUMBERS = Array.from({ length: 20 }, (_, i) => i + 1);
const ALL_RINGS: SegmentRing[] = ["single", "double", "triple"];

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

  const dimSet = useMemo(
    () => new Set<DartSegment>(boardHints?.dim ?? []),
    [boardHints],
  );

  const colorLookup = useMemo(() => {
    const map = new Map<string, { color: string; opacity: number }>();
    for (const rule of boardHints?.segmentColors ?? []) {
      const rings = rule.rings ?? ALL_RINGS;
      const entry = { color: rule.color, opacity: rule.opacity ?? 1 };
      for (const seg of rule.segments) {
        if (seg === "bull") {
          map.set("bull:outer", entry);
          map.set("bull:inner", entry);
        } else {
          for (const ring of rings) map.set(`${seg}:${ring}`, entry);
        }
      }
      if (rule.bullInner) map.set("bull:inner", entry);
    }
    return map;
  }, [boardHints]);

  const hlLookup = useMemo(() => {
    const set = new Set<string>();
    for (const rule of boardHints?.highlights ?? []) {
      const rings = rule.rings ?? ALL_RINGS;
      for (const seg of rule.segments) {
        if (seg === "bull") {
          set.add("bull:outer");
          set.add("bull:inner");
        } else {
          for (const ring of rings) set.add(`${seg}:${ring}`);
        }
      }
      if (rule.bullInner) set.add("bull:inner");
    }
    return set;
  }, [boardHints]);

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

  function cellHintClass(num: number, ring: SegmentRing): string {
    const key = `${num}:${ring}`;
    if (colorLookup.has(key)) {
      const extra = hlLookup.has(key) ? ` ${styles.highlight}` : "";
      return `${styles.colored}${extra}`;
    }
    if (hlLookup.has(key)) return styles.highlight!;
    if (dimSet.has(num as DartSegment)) return styles.dim!;
    return "";
  }

  function cellHintStyle(num: number, ring: SegmentRing): CSSProperties | undefined {
    const entry = colorLookup.get(`${num}:${ring}`);
    if (!entry) return undefined;
    return { "--hint-color": entry.color, "--hint-opacity": entry.opacity } as CSSProperties;
  }

  function bullHintClass(inner: boolean): string {
    const key = inner ? "bull:inner" : "bull:outer";
    if (colorLookup.has(key)) {
      const extra = hlLookup.has(key) ? ` ${styles.highlight}` : "";
      return `${styles.colored}${extra}`;
    }
    if (hlLookup.has(key)) return styles.highlight!;
    if (dimSet.has("bull")) return styles.dim!;
    return "";
  }

  function bullHintStyle(inner: boolean): CSSProperties | undefined {
    const entry = colorLookup.get(inner ? "bull:inner" : "bull:outer");
    if (!entry) return undefined;
    return { "--hint-color": entry.color, "--hint-opacity": entry.opacity } as CSSProperties;
  }

  function cellWrapperExtra(num: number): string {
    if (dimSet.has(num as DartSegment)) return styles.cellDim!;
    for (const ring of ALL_RINGS) {
      if (colorLookup.has(`${num}:${ring}`)) return styles.cellColored!;
    }
    return "";
  }

  return (
    <div className={styles.wrapper}>
      <div className={`${styles.grid} ${disabled ? styles.disabled : ""}`}>
        {NUMBERS.map((num) => (
          <div key={num} className={`${styles.cell} ${cellWrapperExtra(num)}`}>
            <button
              type="button"
              className={`${styles.single} ${cellHintClass(num, "single")}`}
              style={cellHintStyle(num, "single")}
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
                style={cellHintStyle(num, "double")}
                onClick={() => handleNumber(num, 2)}
                disabled={disabled}
                aria-label={`Double ${num}`}
              >
                D
              </button>
              <button
                type="button"
                className={`${styles.multi} ${styles.tpl} ${cellHintClass(num, "triple")}`}
                style={cellHintStyle(num, "triple")}
                onClick={() => handleNumber(num, 3)}
                disabled={disabled}
                aria-label={`Triple ${num}`}
              >
                T
              </button>
            </div>
          </div>
        ))}

        <div className={`${styles.cell} ${styles.bullCell} ${dimSet.has("bull") ? styles.cellDim : ""}`}>
          <button
            type="button"
            className={`${styles.single} ${styles.bullBtn} ${bullHintClass(false)}`}
            style={bullHintStyle(false)}
            onClick={() => handleBull("outer")}
            disabled={disabled}
            aria-label="Outer bull, 25"
          >
            25
          </button>
          <button
            type="button"
            className={`${styles.single} ${styles.bullInnerBtn} ${bullHintClass(true)}`}
            style={bullHintStyle(true)}
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
