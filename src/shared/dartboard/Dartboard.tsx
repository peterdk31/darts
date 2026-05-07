import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, MouseEvent as ReactMouseEvent, ReactNode } from "react";
import type { BoardHints, DartSegment } from "@/shared/types/game-module";
import type { ThrowSegment } from "@/shared/types/core";
import type { BoardTheme } from "@/shared/prefs";
import styles from "./Dartboard.module.css";

export interface DartboardThrow {
  segment: ThrowSegment;
  multiplier: 1 | 2 | 3;
  score: number;
  /** Tap location in SVG viewBox coords (0..400 for both axes). */
  cx: number;
  cy: number;
  label: string;
}

export interface ActiveDot {
  cx: number;
  cy: number;
  segmentLabel: string;
}

interface Props {
  onThrow: (t: DartboardThrow) => void;
  /** Color used for the active player's persistent per-turn dot markers. */
  activeColor?: string;
  /** Persistent dots for the current turn (cleared by parent on turn advance). */
  turnDots?: ReadonlyArray<ActiveDot>;
  /** When true, the rendered dots animate to opacity 0 (turn just ended). */
  dotsFading?: boolean;
  boardHints?: BoardHints;
  boardTheme?: BoardTheme;
  /** When true, taps are ignored (e.g. while bust banner is active or game won). */
  disabled?: boolean;
  /** Content rendered as a centered modal overlay on top of the board. */
  overlay?: ReactNode;
}

/** Standard dartboard segment number sequence starting from the top (20) clockwise. */
const SEGMENT_ORDER: number[] = [
  20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5,
];

const VIEW = 400;
const CENTER = VIEW / 2;
const PADDING = 18; // viewBox padding to fit number labels outside the doubles ring
const R_OUTER = 190; // outer edge of doubles
const R_DOUBLE_INNER = 175;
const R_TRIPLE_OUTER = 120;
const R_TRIPLE_INNER = 105;
const R_OUTER_BULL = 18;
const R_INNER_BULL = 8;
const R_NUMBER = 207; // baseline for the number labels (clear of doubles ring)

const SEGMENT_DEG = 18;
const ROTATION = -90 - SEGMENT_DEG / 2; // start at top, segment 20 centered up

function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const rad = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

function arcPath(rInner: number, rOuter: number, startDeg: number, endDeg: number): string {
  const [x1, y1] = polar(CENTER, CENTER, rOuter, startDeg);
  const [x2, y2] = polar(CENTER, CENTER, rOuter, endDeg);
  const [x3, y3] = polar(CENTER, CENTER, rInner, endDeg);
  const [x4, y4] = polar(CENTER, CENTER, rInner, startDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return [
    `M ${x1.toFixed(3)} ${y1.toFixed(3)}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${x2.toFixed(3)} ${y2.toFixed(3)}`,
    `L ${x3.toFixed(3)} ${y3.toFixed(3)}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${x4.toFixed(3)} ${y4.toFixed(3)}`,
    "Z",
  ].join(" ");
}

interface SegmentRegion {
  number: number;
  index: number; // 0..19
  startDeg: number;
  endDeg: number;
  midDeg: number;
}

const REGIONS: SegmentRegion[] = SEGMENT_ORDER.map((n, i) => {
  const startDeg = ROTATION + i * SEGMENT_DEG;
  const endDeg = startDeg + SEGMENT_DEG;
  return { number: n, index: i, startDeg, endDeg, midDeg: startDeg + SEGMENT_DEG / 2 };
});

function isLightWedge(idx: number): boolean {
  // Alternate cream/black around the board
  return idx % 2 === 0;
}

function makeFlashKey(): number {
  return Date.now() + Math.random();
}

export function Dartboard({
  onThrow,
  activeColor,
  turnDots = [],
  dotsFading = false,
  boardHints,
  boardTheme = "traditional",
  disabled = false,
  overlay,
}: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [flash, setFlash] = useState<{ key: number; label: string } | null>(null);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 1000);
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

  function svgPointFromEvent(evt: { clientX: number; clientY: number }): {
    cx: number;
    cy: number;
  } {
    const svg = svgRef.current;
    if (!svg) return { cx: CENTER, cy: CENTER };
    const pt = svg.createSVGPoint();
    pt.x = evt.clientX;
    pt.y = evt.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { cx: CENTER, cy: CENTER };
    const p = pt.matrixTransform(ctm.inverse());
    return { cx: p.x, cy: p.y };
  }

  function fire(t: DartboardThrow) {
    if (disabled) return;
    setFlash({ key: makeFlashKey(), label: t.label });
    onThrow(t);
  }

  function handleSegmentClick(
    e: ReactMouseEvent<SVGPathElement>,
    region: SegmentRegion,
    multiplier: 1 | 2 | 3,
  ) {
    const score = region.number * multiplier;
    const label = `${multiplier === 3 ? "Triple " : multiplier === 2 ? "Double " : ""}${region.number}`;
    const { cx, cy } = svgPointFromEvent(e);
    fire({ segment: region.number, multiplier, score, cx, cy, label });
  }

  function handleBullClick(
    e: ReactMouseEvent<SVGCircleElement>,
    kind: "outer" | "inner",
  ) {
    const { cx, cy } = svgPointFromEvent(e);
    if (kind === "outer") {
      fire({ segment: "outer-bull", multiplier: 1, score: 25, cx, cy, label: "Outer Bull" });
    } else {
      fire({ segment: "inner-bull", multiplier: 1, score: 50, cx, cy, label: "Inner Bull" });
    }
  }

  function handleMissClick(e: ReactMouseEvent<HTMLButtonElement>) {
    const { cx, cy } = svgPointFromEvent(e);
    fire({ segment: "miss", multiplier: 1, score: 0, cx, cy, label: "Miss" });
  }

  function classForSegmentHint(
    num: number,
    ring: "single" | "double" | "triple",
    baseClass: string | undefined,
  ): string {
    const seg = num as DartSegment;
    const base = baseClass ?? "";
    if (highlightSet.has(seg)) return `${base} ${styles["hint-highlight"] ?? ""}`;
    if (ring === "double" && highlightDoublesSet.has(seg))
      return `${base} ${styles["hint-highlight"] ?? ""}`;
    if (ring === "triple" && highlightTriplesSet.has(seg))
      return `${base} ${styles["hint-highlight"] ?? ""}`;
    if (dimSet.has(seg)) return `${base} ${styles["hint-dim"] ?? ""}`;
    return base;
  }

  function classForBullHint(baseClass: string | undefined, inner?: boolean): string {
    const base = baseClass ?? "";
    if (highlightSet.has("bull")) return `${base} ${styles["hint-highlight"] ?? ""}`;
    if (inner && highlightBullInner) return `${base} ${styles["hint-highlight"] ?? ""}`;
    if (dimSet.has("bull")) return `${base} ${styles["hint-dim"] ?? ""}`;
    return base;
  }

  return (
    <div
      className={styles.wrapper}
      data-board-theme={boardTheme}
      style={
        {
          "--active-team-color": activeColor ?? "var(--color-accent)",
        } as CSSProperties
      }
    >
      <button
        type="button"
        className={styles.miss}
        aria-label="Miss"
        onClick={handleMissClick}
        disabled={disabled}
      >
        <svg
          ref={svgRef}
          viewBox={`${-PADDING} ${-PADDING} ${VIEW + 2 * PADDING} ${VIEW + 2 * PADDING}`}
          className={styles.svg}
          aria-label="Dartboard"
          role="img"
        >
          {/* Outer black ring (visual only) */}
          <circle cx={CENTER} cy={CENTER} r={R_OUTER} className={styles["board-bg"]} />

          {REGIONS.map((r) => {
            const single1 = arcPath(R_TRIPLE_OUTER, R_DOUBLE_INNER, r.startDeg, r.endDeg);
            const single2 = arcPath(R_OUTER_BULL, R_TRIPLE_INNER, r.startDeg, r.endDeg);
            const dbl = arcPath(R_DOUBLE_INNER, R_OUTER, r.startDeg, r.endDeg);
            const tpl = arcPath(R_TRIPLE_INNER, R_TRIPLE_OUTER, r.startDeg, r.endDeg);
            const lightWedge = isLightWedge(r.index);
            const wedgeClass = lightWedge ? styles["wedge-light"] : styles["wedge-dark"];
            const dblClass = lightWedge
              ? styles["double-light"]
              : styles["double-dark"];
            const tplClass = lightWedge
              ? styles["triple-light"]
              : styles["triple-dark"];

            return (
              <g key={r.number} pointerEvents="visiblePainted">
                <path
                  d={single1}
                  className={classForSegmentHint(r.number, "single", wedgeClass)}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSegmentClick(e, r, 1);
                  }}
                  role="button"
                  aria-label={`Single ${r.number}`}
                />
                <path
                  d={single2}
                  className={classForSegmentHint(r.number, "single", wedgeClass)}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSegmentClick(e, r, 1);
                  }}
                  role="button"
                  aria-label={`Single ${r.number}`}
                />
                <path
                  d={dbl}
                  className={classForSegmentHint(r.number, "double", dblClass)}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSegmentClick(e, r, 2);
                  }}
                  role="button"
                  aria-label={`Double ${r.number}`}
                />
                <path
                  d={tpl}
                  className={classForSegmentHint(r.number, "triple", tplClass)}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSegmentClick(e, r, 3);
                  }}
                  role="button"
                  aria-label={`Triple ${r.number}`}
                />
              </g>
            );
          })}

          {/* Highlight outlines drawn on top so neighbor strokes don't clip them. */}
          {REGIONS.filter((r) => highlightSet.has(r.number as DartSegment)).map((r) => (
            <path
              key={`hl-${r.number}`}
              d={arcPath(R_OUTER_BULL, R_OUTER, r.startDeg, r.endDeg)}
              className={styles["hint-highlight-overlay"]}
              pointerEvents="none"
            />
          ))}
          {REGIONS.filter((r) => highlightDoublesSet.has(r.number as DartSegment)).map((r) => (
            <path
              key={`hl-d-${r.number}`}
              d={arcPath(R_DOUBLE_INNER, R_OUTER, r.startDeg, r.endDeg)}
              className={styles["hint-highlight-overlay"]}
              pointerEvents="none"
            />
          ))}
          {REGIONS.filter((r) => highlightTriplesSet.has(r.number as DartSegment)).map((r) => (
            <path
              key={`hl-t-${r.number}`}
              d={arcPath(R_TRIPLE_INNER, R_TRIPLE_OUTER, r.startDeg, r.endDeg)}
              className={styles["hint-highlight-overlay"]}
              pointerEvents="none"
            />
          ))}

          {/* Bull rings */}
          <circle
            cx={CENTER}
            cy={CENTER}
            r={R_OUTER_BULL}
            className={classForBullHint(styles["bull-outer"])}
            onClick={(e) => {
              e.stopPropagation();
              handleBullClick(e, "outer");
            }}
            role="button"
            aria-label="Outer bull, 25"
          />
          <circle
            cx={CENTER}
            cy={CENTER}
            r={R_INNER_BULL}
            className={classForBullHint(styles["bull-inner"], true)}
            onClick={(e) => {
              e.stopPropagation();
              handleBullClick(e, "inner");
            }}
            role="button"
            aria-label="Inner bull, 50"
          />
          {highlightSet.has("bull") && (
            <circle
              cx={CENTER}
              cy={CENTER}
              r={R_OUTER_BULL}
              className={styles["hint-highlight-overlay"]}
              pointerEvents="none"
            />
          )}
          {highlightBullInner && !highlightSet.has("bull") && (
            <circle
              cx={CENTER}
              cy={CENTER}
              r={R_INNER_BULL}
              className={styles["hint-highlight-overlay"]}
              pointerEvents="none"
            />
          )}

          {/* Number labels — outside the doubles ring */}
          {REGIONS.map((r) => {
            const [tx, ty] = polar(CENTER, CENTER, R_NUMBER, r.midDeg);
            return (
              <text
                key={`label-${r.number}`}
                x={tx}
                y={ty}
                className={styles.number}
                textAnchor="middle"
                dominantBaseline="middle"
                pointerEvents="none"
              >
                {r.number}
              </text>
            );
          })}

          {/* Persistent per-turn dots */}
          {turnDots.map((d, i) => (
            <circle
              key={`dot-${i}`}
              cx={d.cx}
              cy={d.cy}
              r={5}
              className={`${styles.dot} ${dotsFading ? styles["dot-fading"] ?? "" : ""}`}
              pointerEvents="none"
            />
          ))}

          {/* Flash overlay on tap (text feedback for now). */}
          {flash && (
            <g key={flash.key} pointerEvents="none" className={styles["flash-group"]}>
              <rect
                x={CENTER - 90}
                y={CENTER - 18}
                width={180}
                height={36}
                rx={18}
                ry={18}
                className={styles["flash-bg"]}
              />
              <text
                x={CENTER}
                y={CENTER}
                textAnchor="middle"
                dominantBaseline="middle"
                className={styles.flash}
              >
                {flash.label}
              </text>
            </g>
          )}
        </svg>
      </button>
      {overlay && <div className={styles.overlay}>{overlay}</div>}
    </div>
  );
}
