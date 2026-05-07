import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { Dartboard, type ActiveDot, type DartboardThrow } from "@/shared/dartboard/Dartboard";
import { TurnIndicatorCard } from "@/shell/components/TurnIndicatorCard";
import { BustBanner } from "@/shell/components/BustBanner";
import { BoardSettingsMenu } from "@/shell/components/BoardSettingsMenu";
import { AbandonConfirmModal } from "@/shell/components/AbandonConfirmModal";
import { Button } from "@/shared/components/Button";
import { useNavigate } from "@/shared/routing/router";
import { useSession } from "@/shell/session/useSession";
import { getById } from "@/games/registry";
import { applyOne, makeInitContext, replayAll } from "@/shell/session/replay";
import type {
  CompletedGameRecord,
  InProgressGame,
} from "@/shell/session/types";
import type { ThrowEffect } from "@/shared/types/game-module";
import type { ThrowRecord } from "@/shared/types/core";
import styles from "./PlayPage.module.css";

export function PlayPage() {
  const { state, dispatch, prefs, setPrefs, dartsAllotmentForCurrentPlayer } = useSession();
  const navigate = useNavigate();
  const game = state.inProgressGame;
  const [bustBanner, setBustBanner] = useState<{ revertedScore: number } | null>(null);
  const [abandonOpen, setAbandonOpen] = useState(false);
  const [turnDots, setTurnDots] = useState<ActiveDot[]>([]);
  const winRecorded = useRef<string | null>(null);

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
        summary: replay.winSummary,
      };
      dispatch({ type: "recordCompletedGame", record });
      navigate("/end");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.id]);

  if (!game || !manifest) {
    return (
      <div className={styles.page}>
        <p>No game in progress.</p>
        <Button variant="primary" onClick={() => navigate("/game-select")}>
          Pick a game
        </Button>
      </div>
    );
  }

  const currentTeam = game.teams.find((t) => t.id === game.currentTurn.teamId)!;
  const teamNumber = game.turnOrder.indexOf(currentTeam.id) + 1;
  const currentPlayer = currentTeam.players.find(
    (p) => p.id === game.currentTurn.playerId,
  )!;
  const allotment = dartsAllotmentForCurrentPlayer();

  const scoreboard = manifest.selectScoreboard(game.engineState);
  const boardHints = manifest.getBoardHints?.(game.engineState);
  const ViewPanel = manifest.view;

  function handleThrow(t: DartboardThrow) {
    if (!game || !manifest) return;
    if (bustBanner) return; // ignore taps while banner showing

    const newDot: ActiveDot = { cx: t.cx, cy: t.cy, segmentLabel: t.label };
    if (game.currentTurn.dartsThrownThisTurn === 0) {
      setTurnDots([newDot]);
    } else {
      setTurnDots((prev) => [...prev, newDot]);
    }

    const throwRecord: ThrowRecord = {
      teamId: game.currentTurn.teamId,
      playerId: game.currentTurn.playerId,
      segment: t.segment,
      multiplier: t.multiplier,
      score: t.score,
      timestamp: new Date().toISOString(),
    };

    const r = applyOne(manifest, game.engineState, game.currentTurn, throwRecord);
    const won = r.effects.some((e) => e.kind === "gameWon");
    const bust = r.effects.find((e): e is Extract<ThrowEffect, { kind: "bust" }> => e.kind === "bust");

    dispatch({
      type: "appendThrow",
      throw_: throwRecord,
      engineState: r.state,
      currentTurn: r.turn,
    });

    if (bust) {
      // Compute reverted team score from the new state's selectScoreboard if available.
      const sb = manifest.selectScoreboard(r.state);
      const teamRow = sb.rows.find((row) => row.teamId === bust.teamId);
      const score = teamRow ? Number.parseInt(teamRow.primary, 10) : NaN;
      setBustBanner({ revertedScore: Number.isFinite(score) ? score : 0 });
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
          summary: winnerEff.summary,
        };
        dispatch({ type: "recordCompletedGame", record });
        navigate("/end");
      }
    }
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
    setTurnDots([]);
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
    setTurnDots([]);
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
        summary: replay.winSummary,
      };
      dispatch({ type: "recordCompletedGame", record });
      navigate("/end");
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.headerBar}>
        <Button variant="ghost" size="sm" onClick={() => setAbandonOpen(true)}>
          End
        </Button>
        <BoardSettingsMenu
          boardTheme={prefs.boardTheme}
          onChangeTheme={(theme) => setPrefs({ ...prefs, boardTheme: theme })}
        />
      </header>

      <TurnIndicatorCard
        team={currentTeam}
        teamNumber={teamNumber}
        player={currentPlayer}
        dartsThrownThisTurn={game.currentTurn.dartsThrownThisTurn}
        dartsAllotmentForPlayer={allotment}
      />

      <div className={styles.layout}>
        <div className={styles.scoreboardSlot}>
          {ViewPanel ? (
            (ViewPanel({
              state: game.engineState,
              resolvedSettings: game.resolvedSettings,
              teams: game.teams,
            }) as ReactElement | null)
          ) : (
            <DefaultScoreboard rows={scoreboard.rows} game={game} />
          )}
        </div>

        <div className={styles.boardSlot}>
          <Dartboard
            onThrow={handleThrow}
            activeColor={`var(--team-color-${currentTeam.colorId})`}
            turnDots={turnDots}
            boardHints={boardHints}
            boardTheme={prefs.boardTheme}
            disabled={bustBanner !== null}
          />
          <div className={styles.controls}>
            <Button
              variant="secondary"
              onClick={handleUndo}
              disabled={game.throws.length === 0 || bustBanner !== null}
            >
              ← Undo last
            </Button>
            {game.redoStack.length > 0 ? (
              <Button
                variant="secondary"
                onClick={handleRedo}
                disabled={bustBanner !== null}
              >
                Redo →
              </Button>
            ) : null}
          </div>
        </div>

      </div>

      <BustBanner
        open={bustBanner !== null}
        revertedScore={bustBanner?.revertedScore}
        onDismiss={() => setBustBanner(null)}
      />

      <AbandonConfirmModal
        open={abandonOpen}
        onCancel={() => setAbandonOpen(false)}
        onConfirm={() => {
          setAbandonOpen(false);
          dispatch({ type: "discardInProgressGame" });
          navigate("/game-select");
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
            <span className={styles.scoreName}>{team.displayName}</span>
            <span className={styles.scoreValue}>{row.primary}</span>
          </li>
        );
      })}
    </ul>
  );
}

