import { useMemo } from "react";
import { useSessionContext } from "./SessionContext";
import { allotmentForPlayer } from "@/shared/dart-allotment";
import { getById } from "@/games/registry";
import type { ScoreboardSummary } from "@/shared/types/game-module";

export function useSession() {
  const { state, dispatch, prefs, setPrefs, reportStorageError } = useSessionContext();

  const selectors = useMemo(() => {
    const ip = state.inProgressGame;

    function currentTeam() {
      if (!ip) return null;
      return ip.teams.find((t) => t.id === ip.currentTurn.teamId) ?? null;
    }

    function currentPlayer() {
      const team = currentTeam();
      if (!team || !ip) return null;
      return team.players.find((p) => p.id === ip.currentTurn.playerId) ?? null;
    }

    function dartsAllotmentForCurrentPlayer(): number {
      if (!ip) return 0;
      const team = currentTeam();
      if (!team) return 0;
      const idx = team.players.findIndex((p) => p.id === ip.currentTurn.playerId);
      if (idx < 0) return 0;
      return allotmentForPlayer(ip.dartsPerPlayer, ip.maxTeamSize, team, idx);
    }

    function dartsThrownThisTurn(): number {
      return ip?.currentTurn.dartsThrownThisTurn ?? 0;
    }

    function scoreboardForGame(): ScoreboardSummary | null {
      if (!ip) return null;
      const manifest = getById(ip.gameTypeId);
      if (!manifest) return null;
      return manifest.selectScoreboard(ip.engineState);
    }

    return {
      currentTeam,
      currentPlayer,
      dartsAllotmentForCurrentPlayer,
      dartsThrownThisTurn,
      scoreboardForGame,
    };
  }, [state]);

  return { state, dispatch, prefs, setPrefs, reportStorageError, ...selectors };
}
