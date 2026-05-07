import type { SessionDescriptor } from "@/shell/session/sessionDescriptor";
import { loadAllHistory } from "@/shell/session/sessionsStorage";
import { isWinSummary } from "@/shell/stats/computeWinSummary";
import type { CompletedGameRecord } from "@/shell/session/types";

export interface AggregatePlayerStats {
  gamesPlayed: number;
  gamesWon: number;
  dartsThrown: number;
  dartsHit: number;
}

function computeForPlayer(
  playerId: string,
  history: CompletedGameRecord[],
): AggregatePlayerStats {
  let gamesPlayed = 0;
  let gamesWon = 0;
  let dartsThrown = 0;
  let dartsHit = 0;

  for (const rec of history) {
    const team = rec.teams.find((t) =>
      t.players.some((p) => p.id === playerId),
    );
    if (!team) continue;

    gamesPlayed++;

    if (rec.winnerTeamIds.includes(team.id)) {
      gamesWon++;
    }

    if (isWinSummary(rec.summary)) {
      const ps = rec.summary.playerStats.find(
        (s) => s.playerId === playerId,
      );
      if (ps) {
        dartsThrown += ps.dartsThrown;
        dartsHit += ps.dartsHit;
      }
    }
  }

  return { gamesPlayed, gamesWon, dartsThrown, dartsHit };
}

export function computeAllPlayerStats(
  playerIds: string[],
  sessions: SessionDescriptor[],
): Map<string, AggregatePlayerStats> {
  const history = loadAllHistory(sessions);
  const result = new Map<string, AggregatePlayerStats>();
  for (const id of playerIds) {
    result.set(id, computeForPlayer(id, history));
  }
  return result;
}
