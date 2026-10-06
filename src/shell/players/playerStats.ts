import type { SessionDescriptor } from "@/shell/session/sessionDescriptor";
import { loadAllHistory } from "@/shell/session/sessionsStorage";
import { isWinSummary, WIN_SUMMARY_STATS_VERSION } from "@/shell/stats/computeWinSummary";
import type { CompletedGameRecord } from "@/shell/session/types";

export interface AggregateX01Stats {
  darts: number;
  points: number;
  visits180: number;
  visits140: number;
  checkoutDarts: number;
  checkouts: number;
  highestCheckout: number;
}

export interface AggregateMarks {
  marks: number;
  darts: number;
}

export interface AggregatePlayerStats {
  gamesPlayed: number;
  gamesWon: number;
  /** Darts from games whose summary has the current hit definition. */
  dartsThrown: number;
  dartsHit: number;
  x01: AggregateX01Stats | null;
  /** Marks per game type ("cricket", "mickey-mouse") for MPR. */
  marks: Record<string, AggregateMarks>;
}

export function emptyPlayerStats(): AggregatePlayerStats {
  return { gamesPlayed: 0, gamesWon: 0, dartsThrown: 0, dartsHit: 0, x01: null, marks: {} };
}

function computeForPlayer(
  playerId: string,
  history: CompletedGameRecord[],
): AggregatePlayerStats {
  const out = emptyPlayerStats();

  for (const rec of history) {
    const team = rec.teams.find((t) =>
      t.players.some((p) => p.id === playerId),
    );
    if (!team) continue;

    out.gamesPlayed++;

    if (rec.winnerTeamIds.includes(team.id)) {
      out.gamesWon++;
    }

    // Older summaries counted any non-miss as a hit — skip their dart stats.
    if (
      !isWinSummary(rec.summary) ||
      (rec.summary.statsVersion ?? 1) < WIN_SUMMARY_STATS_VERSION
    ) continue;
    const ps = rec.summary.playerStats.find((s) => s.playerId === playerId);
    if (!ps) continue;

    out.dartsThrown += ps.dartsThrown;
    out.dartsHit += ps.dartsHit;

    if (ps.x01) {
      const x = (out.x01 ??= {
        darts: 0, points: 0, visits180: 0, visits140: 0,
        checkoutDarts: 0, checkouts: 0, highestCheckout: 0,
      });
      x.darts += ps.dartsThrown;
      x.points += ps.x01.points;
      x.visits180 += ps.x01.visits180;
      x.visits140 += ps.x01.visits140;
      x.checkoutDarts += ps.x01.checkoutDarts;
      x.checkouts += ps.x01.checkouts;
      x.highestCheckout = Math.max(x.highestCheckout, ps.x01.highestCheckout);
    }

    if (ps.marks !== undefined) {
      const m = (out.marks[rec.gameTypeId] ??= { marks: 0, darts: 0 });
      m.marks += ps.marks;
      m.darts += ps.dartsThrown;
    }
  }

  return out;
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
