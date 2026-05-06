import { useMemo, useState } from "react";
import { Button } from "@/shared/components/Button";
import { Modal } from "@/shared/components/Modal";
import { useNavigate } from "@/shared/routing/router";
import { useSession } from "@/shell/session/useSession";
import { SessionTally } from "@/shell/components/SessionTally";
import { getById } from "@/games/registry";
import type { CompletedGameRecord } from "@/shell/session/types";
import type {
  ResolvedSettings,
  SettingDefinition,
} from "@/shared/types/game-module";
import styles from "./HistoryPage.module.css";

type ConfirmStep = "idle" | "first" | "second";

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function summarizeSettings(
  schema: ReadonlyArray<SettingDefinition> | undefined,
  resolved: ResolvedSettings,
): string {
  if (!schema || schema.length === 0) return "";
  const parts: string[] = [];
  for (const def of schema) {
    const v = resolved[def.key];
    if (def.type === "toggle") {
      if (v === true) parts.push(def.label);
    } else if (v !== undefined && v !== def.default) {
      parts.push(`${def.label}: ${String(v)}`);
    }
  }
  return parts.join(" · ");
}

export function HistoryPage() {
  const { state, dispatch } = useSession();
  const navigate = useNavigate();
  const [confirmStep, setConfirmStep] = useState<ConfirmStep>("idle");

  const reverse = useMemo(() => [...state.history].reverse(), [state.history]);

  function startClear() {
    setConfirmStep("first");
  }
  function dismissClear() {
    setConfirmStep("idle");
  }
  function continueClear() {
    setConfirmStep("second");
  }
  function confirmClear() {
    dispatch({ type: "clearHistory" });
    setConfirmStep("idle");
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Session history</h1>
        <Button
          variant="ghost"
          onClick={() => navigate(state.inProgressGame ? "/play" : "/")}
        >
          ← Back
        </Button>
      </header>

      {state.teams.length > 0 && (
        <SessionTally teams={state.teams} history={state.history} />
      )}

      {reverse.length === 0 ? (
        <p className={styles.empty}>
          No completed games yet. Finish a game and it will appear here.
        </p>
      ) : (
        <ol className={styles.list}>
          {reverse.map((rec) => (
            <HistoryRow key={rec.id} record={rec} />
          ))}
        </ol>
      )}

      {reverse.length > 0 && (
        <div className={styles.actions}>
          <Button variant="danger" onClick={startClear}>
            Clear history
          </Button>
        </div>
      )}

      <Modal
        open={confirmStep === "first"}
        onClose={dismissClear}
        title="Clear session history?"
        labelledBy="clear-history-title-1"
      >
        <p>
          This will permanently remove all {state.history.length} completed
          {state.history.length === 1 ? " game" : " games"} from this device.
          This cannot be undone.
        </p>
        <div className={styles.modalActions}>
          <Button variant="secondary" onClick={dismissClear}>
            Cancel
          </Button>
          <Button variant="danger" onClick={continueClear}>
            Continue
          </Button>
        </div>
      </Modal>

      <Modal
        open={confirmStep === "second"}
        onClose={dismissClear}
        title="Are you sure?"
        labelledBy="clear-history-title-2"
      >
        <p>
          Last chance. Tap "Yes, clear all" to delete every recorded game.
        </p>
        <div className={styles.modalActions}>
          <Button variant="secondary" onClick={dismissClear}>
            Keep history
          </Button>
          <Button variant="danger" onClick={confirmClear}>
            Yes, clear all
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function HistoryRow({ record }: { record: CompletedGameRecord }) {
  const manifest = getById(record.gameTypeId);
  const winners = record.teams.filter((t) =>
    record.winnerTeamIds.includes(t.id),
  );
  const settingsSummary = summarizeSettings(
    manifest?.settingsSchema,
    record.resolvedSettings,
  );

  return (
    <li className={styles.row}>
      <div className={styles.rowHeader}>
        <span className={styles.gameType}>
          {manifest?.displayName ?? record.gameTypeId}
        </span>
        <span className={styles.timestamp}>
          {formatTimestamp(record.completedAt)}
        </span>
      </div>
      <div className={styles.winners}>
        {winners.map((t) => {
          const teamIndex = record.teams.findIndex((tx) => tx.id === t.id);
          return (
            <span
              key={t.id}
              className={styles.winnerChip}
              style={{
                background: `var(--team-color-${t.colorId})`,
                color: `var(--team-color-${t.colorId}-on)`,
              }}
            >
              <span className={styles.winnerBadge}>Team {teamIndex + 1}</span>
              <span className={styles.winnerName}>{t.displayName}</span>
            </span>
          );
        })}
      </div>
      {settingsSummary && (
        <p className={styles.settings}>{settingsSummary}</p>
      )}
    </li>
  );
}
