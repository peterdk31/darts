import { useEffect, useMemo, useState } from "react";
import { getById } from "@/games/registry";
import { Button } from "@/shared/components/Button";
import { useNavigate, useParams } from "@/shared/routing/router";
import { useSession } from "@/shell/session/useSession";
import type { ResolvedSettings, SettingDefinition } from "@/shared/types/game-module";
import { maxTeamSize } from "@/shared/turn/turn-helpers";
import { makeInitContext, initialCurrentTurn } from "@/shell/session/replay";
import type { InProgressGame } from "@/shell/session/types";
import { AbandonConfirmModal } from "@/shell/components/AbandonConfirmModal";
import styles from "./GameSettingsPage.module.css";

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

function defaultsFor(schema: ReadonlyArray<SettingDefinition>): ResolvedSettings {
  const out: Record<string, boolean | number | string> = {};
  for (const s of schema) {
    out[s.key] = s.default;
  }
  return out;
}

export function GameSettingsPage() {
  const { id: rawId } = useParams<{ id: string }>();
  const id = decodeURIComponent(rawId ?? "");
  const navigate = useNavigate();
  const { state, dispatch } = useSession();
  const manifest = useMemo(() => getById(id), [id]);
  const [settings, setSettings] = useState<ResolvedSettings>(() =>
    manifest ? defaultsFor(manifest.settingsSchema) : {},
  );
  const [pendingStart, setPendingStart] = useState(false);
  const skipSettings = manifest != null && manifest.settingsSchema.length === 0;

  useEffect(() => {
    if (skipSettings) startGame();
  }, [skipSettings]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!manifest) {
    return (
      <div className={styles.page}>
        <p>Unknown game type: {id}</p>
        <Button variant="primary" onClick={() => navigate("/game-select")}>
          Back to game select
        </Button>
      </div>
    );
  }

  function setKey(key: string, value: boolean | number | string) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  function startGame() {
    if (!manifest) return;
    const teams = state.teams;
    if (teams.length < 2) {
      navigate("/teams");
      return;
    }
    if (state.inProgressGame) {
      setPendingStart(true);
      return;
    }
    doStart();
  }

  function doStart() {
    if (!manifest) return;
    const teams = state.teams;
    const turnOrder = teams.map((t) => t.id);
    const playerRotation: Record<string, string[]> = {};
    for (const t of teams) playerRotation[t.id] = t.players.map((p) => p.id);
    const mts = maxTeamSize(teams);
    const initCtx = makeInitContext(teams, settings, manifest.dartsPerPlayer, mts);
    const engineState = manifest.init(initCtx);

    const game: InProgressGame = {
      id: uid("game"),
      gameTypeId: manifest.id,
      resolvedSettings: settings,
      teams: teams.map((t) => ({
        ...t,
        players: t.players.map((p) => ({ ...p })),
      })),
      dartsPerPlayer: manifest.dartsPerPlayer,
      maxTeamSize: mts,
      turnOrder,
      playerRotation,
      throws: [],
      redoStack: [],
      engineState,
      engineSchemaVersion: manifest.schemaVersion,
      currentTurn: initialCurrentTurn(turnOrder, playerRotation),
      status: "in-progress",
      startedAt: new Date().toISOString(),
    };
    dispatch({ type: "setInProgressGame", game });
    setPendingStart(false);
    navigate("/play");
  }

  if (skipSettings) {
    return (
      <AbandonConfirmModal
        open={pendingStart}
        onConfirm={doStart}
        onCancel={() => {
          setPendingStart(false);
          navigate("/play");
        }}
      />
    );
  }

  return (
    <div className={styles.page}>
      <header>
        <h1>{manifest.displayName} settings</h1>
      </header>

      <ul className={styles.list}>
          {manifest.settingsSchema.map((s) => {
            const val = settings[s.key];
            if (s.type === "toggle") {
              return (
                <li key={s.key} className={styles.row}>
                  <label className={styles.toggleLabel}>
                    <input
                      type="checkbox"
                      checked={val === true}
                      onChange={(e) => setKey(s.key, e.target.checked)}
                    />
                    <span>{s.label}</span>
                  </label>
                </li>
              );
            }
            if (s.type === "integer") {
              return (
                <li key={s.key} className={styles.row}>
                  <label>
                    <span>{s.label}</span>
                    <input
                      type="number"
                      min={s.constraints.min}
                      max={s.constraints.max}
                      step={s.constraints.step ?? 1}
                      value={typeof val === "number" ? val : (s.default as number)}
                      onChange={(e) => setKey(s.key, Number(e.target.value))}
                    />
                  </label>
                </li>
              );
            }
            // choice
            return (
              <li key={s.key} className={styles.row}>
                <label>
                  <span>{s.label}</span>
                  <select
                    value={typeof val === "string" ? val : (s.default as string)}
                    onChange={(e) => setKey(s.key, e.target.value)}
                  >
                    {s.constraints.choices.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>
              </li>
            );
          })}
      </ul>

      <div className={styles.actions}>
        <Button variant="ghost" onClick={() => navigate("/game-select")}>
          ← Back
        </Button>
        <Button variant="primary" onClick={startGame}>
          Start
        </Button>
      </div>

      <AbandonConfirmModal
        open={pendingStart}
        onConfirm={doStart}
        onCancel={() => {
          setPendingStart(false);
          navigate("/play");
        }}
      />
    </div>
  );
}
