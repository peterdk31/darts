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

function isNumberTile(group: QuickInputGroup): boolean {
  return group.layout === "tile" && group.actions.length > 1;
}

type Block =
  | { kind: "tiles"; label?: string; groups: QuickInputGroup[] }
  | { kind: "group"; group: QuickInputGroup };

function toBlocks(groups: QuickInputGroup[]): Block[] {
  const blocks: Block[] = [];
  for (const group of groups) {
    const last = blocks[blocks.length - 1];
    if (!isNumberTile(group)) blocks.push({ kind: "group", group });
    // A labelled tile group starts a new grid headed by its label.
    else if (last?.kind === "tiles" && !group.label) last.groups.push(group);
    else blocks.push({ kind: "tiles", label: group.label, groups: [group] });
  }
  return blocks;
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

  function renderMarks(marks: QuickInputAction["marks"]) {
    if (!marks) return null;
    return (
      <span
        className={styles.marks}
        role="img"
        aria-label={`${marks.current} of ${marks.max} hits`}
      >
        {Array.from({ length: marks.max }, (_, i) => (
          <span
            key={i}
            className={`${styles.markSegment} ${i < marks.current ? styles.markFilled : ""}`}
          />
        ))}
      </span>
    );
  }

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
        {renderMarks(action.marks)}
      </button>
    );
  }

  function renderTile(group: QuickInputGroup, key: number) {
    const [single, ...mods] = group.actions;
    return (
      <div key={key} className={styles.tile}>
        <button
          type="button"
          className={styles.tileMain}
          onClick={() => handleClick(single!)}
          disabled={disabled}
        >
          <span>{single!.label}</span>
          {renderMarks(single!.marks)}
        </button>
        <div className={styles.tileMods}>
          {mods.map((action, i) => (
            <button
              key={i}
              type="button"
              className={styles.tileMod}
              onClick={() => handleClick(action)}
              disabled={disabled}
              aria-label={action.label}
            >
              {action.multiplier === 2 ? "D" : "T"}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <div className={`${styles.container} ${disabled ? styles.disabled : ""}`}>
        {toBlocks(targetGroups).map((block, bi) =>
          block.kind === "tiles" ? (
            <div key={bi} className={styles.group}>
              {block.label && <div className={styles.groupLabel}>{block.label}</div>}
              <div className={styles.tiles}>
                {block.groups.map(renderTile)}
              </div>
            </div>
          ) : (
            <div key={bi} className={styles.group}>
              {block.group.label && <div className={styles.groupLabel}>{block.group.label}</div>}
              <div className={styles.buttons}>
                {block.group.actions.map(renderButton)}
              </div>
            </div>
          ),
        )}
      </div>

      {flash && (
        <div key={flash.key} className={styles.flash}>
          {flash.label}
        </div>
      )}
    </div>
  );
}
