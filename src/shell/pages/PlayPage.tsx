import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { Dartboard, type ActiveDot, type DartboardThrow } from "@/shared/dartboard/Dartboard";
import { GridBoard } from "@/shared/dartboard/GridBoard";
import { QuickBoard } from "@/shared/dartboard/QuickBoard";
import { TurnIndicatorCard } from "@/shell/components/TurnIndicatorCard";
import { BustBanner } from "@/shell/components/BustBanner";
import { PlayerSwitchOverlay } from "@/shell/components/PlayerSwitchOverlay";
import { BoardSettingsMenu } from "@/shell/components/BoardSettingsMenu";
import { AbandonConfirmModal } from "@/shell/components/AbandonConfirmModal";
import { IntentChooser } from "@/games/mickey-mouse/ui/IntentChooser";
import { Button } from "@/shared/components/Button";
import { useNavigate } from "@/shared/routing/router";
import { useSession } from "@/shell/session/useSession";
import { getById } from "@/games/registry";
import { applyOne, makeInitContext, replayAll } from "@/shell/session/replay";
import type {
  CompletedGameRecord,
  InProgressGame,
} from "@/shell/session/types";
import type { ScoreboardHit, ThrowEffect } from "@/shared/types/game-module";
import type { TeamColorId, ThrowRecord, ThrowSegment } from "@/shared/types/core";
import { getTeamLabel } from "@/shared/teams/teamLabel";
import { computeWinSummary } from "@/shell/stats/computeWinSummary";
import { detectShanghai } from "@/shared/shanghai";
import styles from "./PlayPage.module.css";

function deriveTurnDots(
  throwDots: ReadonlyArray<ActiveDot | null>,
  dartsThrownThisTurn: number,
): ActiveDot[] {
  if (dartsThrownThisTurn === 0) return [];
  return throwDots
    .slice(-dartsThrownThisTurn)
    .filter((d): d is ActiveDot => d !== null);
}

function scoreForSegment(segment: ThrowSegment, multiplier: 1 | 2 | 3): number {
  if (segment === "miss") return 0;
  if (segment === "outer-bull") return 25;
  if (segment === "inner-bull") return 50;
  return (segment as number) * multiplier;
}

export function PlayPage() {
  const { state, dispatch, prefs, setPrefs, dartsAllotmentForCurrentPlayer } = useSession();
  const navigate = useNavigate();
  const game = state.inProgressGame;
  const [bustBanner, setBustBanner] = useState<{ label?: string; detail?: string } | null>(null);
  const [abandonOpen, setAbandonOpen] = useState(false);
  const [pendingIntent, setPendingIntent] = useState<{
    record: ThrowRecord;
    candidates: ReadonlyArray<{ intent: string; label: string }>;
  } | null>(null);
  const [switchOverlay, setSwitchOverlay] = useState<{
    playerName: string;
    teamColorId: TeamColorId;
  } | null>(null);
  const [turnDots, setTurnDots] = useState<ActiveDot[]>([]);
  const [dotsFading, setDotsFading] = useState(false);
  const fadeTimerRef = useRef<number | null>(null);
  const prevDartsCountRef = useRef<number>(game?.currentTurn.dartsThrownThisTurn ?? 0);
  // Parallel to game.throws / game.redoStack, holds the tap coords for each
  // throw so undo/redo can restore the active turn's dots. In-memory only —
  // throws restored from persistence start as nulls (no remembered position).
  const throwDotsRef = useRef<Array<ActiveDot | null>>([]);
  const redoDotsRef = useRef<Array<ActiveDot | null>>([]);
  const dotsGameIdRef = useRef<string | null>(null);
  const winRecorded = useRef<string | null>(null);
  const pendingOverlayRef = useRef<{ playerName: string; teamColorId: TeamColorId } | null>(null);

  if (game && dotsGameIdRef.current !== game.id) {
    dotsGameIdRef.current = game.id;
    throwDotsRef.current = Array(game.throws.length).fill(null);
    redoDotsRef.current = Array(game.redoStack.length).fill(null);
  }

  useEffect(() => {
    const cur = game?.currentTurn.dartsThrownThisTurn ?? 0;
    const prev = prevDartsCountRef.current;
    prevDartsCountRef.current = cur;
    // Turn flipped: dart count just reset from > 0 back to 0. Fade out the
    // previous turn's dots so the next team starts with a clean board.
    if (prev > 0 && cur === 0) {
      setDotsFading(true);
      if (fadeTimerRef.current !== null) window.clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = window.setTimeout(() => {
        setTurnDots([]);
        setDotsFading(false);
        fadeTimerRef.current = null;
      }, 600);
    }
  }, [game?.currentTurn.dartsThrownThisTurn]);

  useEffect(() => () => {
    if (fadeTimerRef.current !== null) window.clearTimeout(fadeTimerRef.current);
  }, []);

  const manifest = useMemo(
    () => (game ? getById(game.gameTypeId) : null),
    [game?.gameTypeId],
  );

  // Safety net for restored sessions where the win was already in throws[]
  // — handleThrow captures live wins synchronously.
  useEffect(() => {
    if (!game || !manifest) return;
    const initCtx = makeInitContext(
      game.teams,
      game.resolvedSettings,
      game.dartsPerPlayer,
      game.maxTeamSize,
    );
    const replay = replayAll(
      manifest,
      initCtx,
      game.turnOrder,
      game.playerRotation,
      game.throws,
    );
    if (replay.winnerTeamIds && winRecorded.current !== game.id) {
      winRecorded.current = game.id;
      const record: CompletedGameRecord = {
        id: game.id,
        gameTypeId: game.gameTypeId,
        resolvedSettings: game.resolvedSettings,
        teams: game.teams,
        winnerTeamIds: replay.winnerTeamIds,
        completedAt: new Date().toISOString(),
        summary: computeWinSummary(
          game.gameTypeId, game.teams, replay.winnerTeamIds, game.throws, replay.engineState,
        ),
        finalEngineState: replay.engineState,
      };
      dispatch({ type: "recordCompletedGame", record });
      navigate("/end", { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.id]);

  if (!game || !manifest) {
    return (
      <div className={styles.page}>
        <p>No game in progress.</p>
        <Button variant="primary" onClick={() => navigate("/games")}>
          Pick a game
        </Button>
      </div>
    );
  }

  const currentTeam = game.teams.find((t) => t.id === game.currentTurn.teamId)!;
  const currentPlayer = currentTeam.players.find(
    (p) => p.id === game.currentTurn.playerId,
  )!;
  const allotment = dartsAllotmentForCurrentPlayer();

  const scoreboard = manifest.selectScoreboard(game.engineState);
  const boardHints = manifest.getBoardHints(game.engineState);
  const turnHint = manifest.getTurnHint(game.engineState, game.currentTurn.teamId);
  const ViewPanel = manifest.view;
  const hasQuickInputs = !!manifest.getQuickInputs;
  const quickInputs = manifest.getQuickInputs?.(game.engineState) ?? null;
  const useQuickBoard = prefs.boardLayout === "quick" && hasQuickInputs && quickInputs !== null;
  const effectiveLayout = useQuickBoard ? "quick" : prefs.boardLayout === "quick" ? "grid" : prefs.boardLayout;

  function handleMiss() {
    handleThrow({
      segment: "miss",
      multiplier: 1,
      score: 0,
      cx: 0,
      cy: 0,
      label: "Miss",
    });
  }

  function proceedWithThrow(throwRecord: ThrowRecord) {
    if (!game || !manifest) return;

    const r = applyOne(manifest, game.engineState, game.currentTurn, throwRecord);
    let won = r.effects.some((e) => e.kind === "gameWon");
    const bust = r.effects.find((e): e is Extract<ThrowEffect, { kind: "bust" }> => e.kind === "bust");

    const allThrows = [...game.throws, throwRecord];
    const shanghaiEnabled = game.resolvedSettings["shanghai"] === true;
    let shanghaiWin = false;
    if (shanghaiEnabled && game.currentTurn.dartsThrownThisTurn === 2) {
      const last3 = allThrows.slice(-3).filter((t) => t.playerId === throwRecord.playerId);
      if (last3.length === 3 && detectShanghai(last3)) {
        shanghaiWin = true;
        won = true;
      }
    }

    dispatch({
      type: "appendThrow",
      throw_: throwRecord,
      engineState: r.state,
      currentTurn: r.turn,
    });

    if (shanghaiWin) {
      winRecorded.current = game.id;
      const record: CompletedGameRecord = {
        id: game.id,
        gameTypeId: game.gameTypeId,
        resolvedSettings: game.resolvedSettings,
        teams: game.teams,
        winnerTeamIds: [game.currentTurn.teamId],
        completedAt: new Date().toISOString(),
        summary: computeWinSummary(
          game.gameTypeId, game.teams, [game.currentTurn.teamId], allThrows, r.state,
        ),
        finalEngineState: r.state,
      };
      dispatch({ type: "recordCompletedGame", record });
      navigate("/end", { replace: true });
      return;
    }

    const turnAdvance = r.effects.find(
      (e): e is Extract<ThrowEffect, { kind: "turnAdvance" }> => e.kind === "turnAdvance",
    );
    if (turnAdvance && turnAdvance.nextTeamId !== game.currentTurn.teamId && !won) {
      const nextTeam = game.teams.find((t) => t.id === turnAdvance.nextTeamId);
      const nextPlayer = nextTeam?.players.find((p) => p.id === turnAdvance.nextPlayerId);
      if (nextTeam && nextPlayer) {
        const overlayData = { playerName: nextPlayer.displayName, teamColorId: nextTeam.colorId };
        if (bust) {
          pendingOverlayRef.current = overlayData;
        } else {
          setSwitchOverlay(overlayData);
        }
      }
    }

    if (bust) {
      setTurnDots([]);
      setDotsFading(false);
      if (fadeTimerRef.current !== null) {
        window.clearTimeout(fadeTimerRef.current);
        fadeTimerRef.current = null;
      }
      if (bust.label || bust.detail) {
        setBustBanner({ label: bust.label, detail: bust.detail });
      } else {
        const sb = manifest.selectScoreboard(r.state);
        const teamRow = sb.rows.find((row) => row.teamId === bust.teamId);
        const score = teamRow ? Number.parseInt(teamRow.primary, 10) : NaN;
        setBustBanner({
          detail: Number.isFinite(score) ? `score reverts to ${score}` : undefined,
        });
      }
    }

    if (won) {
      const winnerEff = r.effects.find(
        (e): e is Extract<ThrowEffect, { kind: "gameWon" }> => e.kind === "gameWon",
      );
      if (winnerEff) {
        winRecorded.current = game.id;
        const record: CompletedGameRecord = {
          id: game.id,
          gameTypeId: game.gameTypeId,
          resolvedSettings: game.resolvedSettings,
          teams: game.teams,
          winnerTeamIds: winnerEff.winnerTeamIds,
          completedAt: new Date().toISOString(),
          summary: computeWinSummary(
            game.gameTypeId, game.teams, winnerEff.winnerTeamIds, allThrows, r.state,
          ),
          finalEngineState: r.state,
        };
        dispatch({ type: "recordCompletedGame", record });
        navigate("/end", { replace: true });
      }
    }
  }

  function handleThrow(t: DartboardThrow) {
    if (!game || !manifest) return;
    if (bustBanner || pendingIntent) return;

    if (fadeTimerRef.current !== null) {
      window.clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
    setDotsFading(false);

    const newEntry: ActiveDot | null =
      t.segment === "miss" ? null : { cx: t.cx, cy: t.cy, segmentLabel: t.label };
    throwDotsRef.current = [...throwDotsRef.current, newEntry];
    redoDotsRef.current = [];

    if (t.segment !== "miss") {
      const newDot = newEntry as ActiveDot;
      if (game.currentTurn.dartsThrownThisTurn === 0) {
        setTurnDots([newDot]);
      } else {
        setTurnDots((prev) => [...prev, newDot]);
      }
    } else if (game.currentTurn.dartsThrownThisTurn === 0) {
      setTurnDots([]);
    }

    const throwRecord: ThrowRecord = {
      teamId: game.currentTurn.teamId,
      playerId: game.currentTurn.playerId,
      segment: t.segment,
      multiplier: t.multiplier,
      score: t.score,
      timestamp: new Date().toISOString(),
      ...(t.intent ? { intent: t.intent } : {}),
    };

    if (!t.intent) {
      const candidates = manifest.getCandidatesForThrow?.(game.engineState, throwRecord) ?? [];
      if (candidates.length === 2) {
        setPendingIntent({ record: throwRecord, candidates });
        return;
      }
    }

    proceedWithThrow(throwRecord);
  }

  function handleIntentChosen(intent: string) {
    if (!pendingIntent) return;
    const record = { ...pendingIntent.record, intent };
    setPendingIntent(null);
    proceedWithThrow(record);
  }

  function handleScoreboardHit(hit: ScoreboardHit) {
    if (!game || !manifest) return;
    if (bustBanner || pendingIntent) return;

    if (fadeTimerRef.current !== null) {
      window.clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
    setDotsFading(false);

    throwDotsRef.current = [...throwDotsRef.current, null];
    redoDotsRef.current = [];
    if (game.currentTurn.dartsThrownThisTurn === 0) {
      setTurnDots([]);
    }

    const score = scoreForSegment(hit.segment, hit.multiplier);
    const throwRecord: ThrowRecord = {
      teamId: game.currentTurn.teamId,
      playerId: game.currentTurn.playerId,
      segment: hit.segment,
      multiplier: hit.multiplier,
      score,
      timestamp: new Date().toISOString(),
      ...(hit.intent ? { intent: hit.intent } : {}),
    };

    if (!hit.intent) {
      const candidates = manifest.getCandidatesForThrow?.(game.engineState, throwRecord) ?? [];
      if (candidates.length === 2) {
        setPendingIntent({ record: throwRecord, candidates });
        return;
      }
    }

    proceedWithThrow(throwRecord);
  }

  function handleUndo() {
    if (!game || !manifest) return;
    if (game.throws.length === 0) return;
    if (bustBanner) return;
    // Replay from start through throws[0..n-1].
    const initCtx = makeInitContext(
      game.teams,
      game.resolvedSettings,
      game.dartsPerPlayer,
      game.maxTeamSize,
    );
    const newThrows = game.throws.slice(0, -1);
    const replay = replayAll(
      manifest,
      initCtx,
      game.turnOrder,
      game.playerRotation,
      newThrows,
    );
    if (fadeTimerRef.current !== null) {
      window.clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
    setDotsFading(false);
    const poppedDot =
      throwDotsRef.current[throwDotsRef.current.length - 1] ?? null;
    throwDotsRef.current = throwDotsRef.current.slice(0, -1);
    redoDotsRef.current = [...redoDotsRef.current, poppedDot];
    setTurnDots(deriveTurnDots(throwDotsRef.current, replay.currentTurn.dartsThrownThisTurn));
    // Pre-empt the turn-flip fade effect: this transition is from undo,
    // not a natural turn end, so the previous count baseline tracks the new state.
    prevDartsCountRef.current = replay.currentTurn.dartsThrownThisTurn;
    dispatch({
      type: "popThrow",
      engineState: replay.engineState,
      currentTurn: replay.currentTurn,
    });
  }

  function handleRedo() {
    if (!game || !manifest) return;
    if (game.redoStack.length === 0) return;
    if (bustBanner) return;
    const popped = game.redoStack[game.redoStack.length - 1]!;
    const initCtx = makeInitContext(
      game.teams,
      game.resolvedSettings,
      game.dartsPerPlayer,
      game.maxTeamSize,
    );
    const newThrows = [...game.throws, popped];
    const replay = replayAll(
      manifest,
      initCtx,
      game.turnOrder,
      game.playerRotation,
      newThrows,
    );
    if (fadeTimerRef.current !== null) {
      window.clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
    setDotsFading(false);
    const restoredDot =
      redoDotsRef.current[redoDotsRef.current.length - 1] ?? null;
    redoDotsRef.current = redoDotsRef.current.slice(0, -1);
    throwDotsRef.current = [...throwDotsRef.current, restoredDot];
    setTurnDots(deriveTurnDots(throwDotsRef.current, replay.currentTurn.dartsThrownThisTurn));
    prevDartsCountRef.current = replay.currentTurn.dartsThrownThisTurn;
    dispatch({
      type: "popRedo",
      engineState: replay.engineState,
      currentTurn: replay.currentTurn,
    });
    if (replay.winnerTeamIds && winRecorded.current !== game.id) {
      winRecorded.current = game.id;
      const record: CompletedGameRecord = {
        id: game.id,
        gameTypeId: game.gameTypeId,
        resolvedSettings: game.resolvedSettings,
        teams: game.teams,
        winnerTeamIds: replay.winnerTeamIds,
        completedAt: new Date().toISOString(),
        summary: computeWinSummary(
          game.gameTypeId, game.teams, replay.winnerTeamIds, newThrows, replay.engineState,
        ),
        finalEngineState: replay.engineState,
      };
      dispatch({ type: "recordCompletedGame", record });
      navigate("/end", { replace: true });
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.topRow}>
        <TurnIndicatorCard
          team={currentTeam}
          player={currentPlayer}
          dartsThrownThisTurn={game.currentTurn.dartsThrownThisTurn}
          dartsAllotmentForPlayer={allotment}
        />
        <button
          type="button"
          className={styles.iconBtn}
          aria-label="End game"
          onClick={() => setAbandonOpen(true)}
        >
          ×
        </button>
        <BoardSettingsMenu
          boardTheme={prefs.boardTheme}
          boardLayout={effectiveLayout}
          onChangeTheme={(theme) => setPrefs({ ...prefs, boardTheme: theme })}
          onChangeLayout={(layout) => setPrefs({ ...prefs, boardLayout: layout })}
          settingsSchema={manifest.settingsSchema}
          resolvedSettings={game.resolvedSettings}
          hasQuickInputs={hasQuickInputs}
        />
      </div>

      <div className={styles.layout}>
        <div className={styles.scoreboardSlot}>
          {ViewPanel ? (
            (ViewPanel({
              state: game.engineState,
              resolvedSettings: game.resolvedSettings,
              teams: game.teams,
              onScoreboardHit: bustBanner || pendingIntent || switchOverlay ? undefined : handleScoreboardHit,
            }) as ReactElement | null)
          ) : (
            <DefaultScoreboard rows={scoreboard.rows} game={game} />
          )}
        </div>

        <div className={styles.boardSlot}>
          {turnHint && (
            <div
              className={styles.turnHint}
              style={{ "--turn-color": `var(--team-color-${currentTeam.colorId})` } as React.CSSProperties}
            >
              <span className={styles.turnHintLabel}>{turnHint.label}</span>
              <span className={styles.turnHintValue}>{turnHint.value}</span>
            </div>
          )}
          {useQuickBoard ? (
            <QuickBoard
              groups={quickInputs!}
              onThrow={handleThrow}
              disabled={bustBanner !== null || pendingIntent !== null || switchOverlay !== null}
            />
          ) : effectiveLayout === "grid" ? (
            <GridBoard
              onThrow={handleThrow}
              boardHints={boardHints}
              disabled={bustBanner !== null || pendingIntent !== null || switchOverlay !== null}
              overlay={
                pendingIntent ? (
                  <IntentChooser
                    candidates={pendingIntent.candidates}
                    onChoose={handleIntentChosen}
                  />
                ) : undefined
              }
            />
          ) : (
            <Dartboard
              onThrow={handleThrow}
              activeColor={`var(--team-color-${currentTeam.colorId})`}
              turnDots={turnDots}
              dotsFading={dotsFading}
              boardHints={boardHints}
              boardTheme={prefs.boardTheme}
              disabled={bustBanner !== null || pendingIntent !== null || switchOverlay !== null}
              overlay={
                pendingIntent ? (
                  <IntentChooser
                    candidates={pendingIntent.candidates}
                    onChoose={handleIntentChosen}
                  />
                ) : undefined
              }
            />
          )}
          {!useQuickBoard && (
            <div className={styles.boardActions}>
              <Button
                variant="secondary"
                onClick={handleMiss}
                disabled={bustBanner !== null || pendingIntent !== null || switchOverlay !== null}
                className={styles.missBtn}
              >
                Miss
              </Button>
            </div>
          )}
          <div className={styles.controls}>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleUndo}
              disabled={game.throws.length === 0 || bustBanner !== null || pendingIntent !== null || switchOverlay !== null}
            >
              ← Undo last
            </Button>
            {game.redoStack.length > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRedo}
                disabled={bustBanner !== null || pendingIntent !== null || switchOverlay !== null}
              >
                Redo →
              </Button>
            ) : null}
          </div>
        </div>

      </div>

      <BustBanner
        open={bustBanner !== null}
        label={bustBanner?.label}
        detail={bustBanner?.detail}
        onDismiss={() => {
          setBustBanner(null);
          if (pendingOverlayRef.current) {
            setSwitchOverlay(pendingOverlayRef.current);
            pendingOverlayRef.current = null;
          }
        }}
      />

      {switchOverlay && (
        <PlayerSwitchOverlay
          playerName={switchOverlay.playerName}
          teamColorId={switchOverlay.teamColorId}
          onDismiss={() => setSwitchOverlay(null)}
        />
      )}

      <AbandonConfirmModal
        open={abandonOpen}
        onCancel={() => setAbandonOpen(false)}
        onConfirm={() => {
          setAbandonOpen(false);
          dispatch({ type: "discardInProgressGame" });
          navigate("/games");
        }}
      />

    </div>
  );
}

function DefaultScoreboard({
  rows,
  game,
}: {
  rows: ReturnType<NonNullable<ReturnType<typeof getById>>["selectScoreboard"]>["rows"];
  game: InProgressGame;
}) {
  return (
    <ul className={styles.scoreboard}>
      {rows.map((row) => {
        const team = game.teams.find((t) => t.id === row.teamId);
        if (!team) return null;
        return (
          <li key={row.teamId} className={styles.scoreRow}>
            <span
              className={styles.scoreDot}
              style={{ background: `var(--team-color-${team.colorId})` }}
            />
            <span className={styles.scoreName}>{getTeamLabel(team)}</span>
            <span className={styles.scoreValue}>{row.primary}</span>
          </li>
        );
      })}
    </ul>
  );
}

