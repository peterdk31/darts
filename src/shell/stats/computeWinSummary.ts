import type { Team, ThrowRecord } from "@/shared/types/core";
import type { ThrowStep } from "@/shell/session/gameRunner";
import type { X01EngineState } from "@/games/x01/engine";
import { computeCheckout } from "@/games/x01/checkout";
import type { CricketEngineState } from "@/games/cricket/engine";
import { CRICKET_TARGETS, countedMarksCricket } from "@/games/cricket/engine";
import type { MickeyEngineState } from "@/games/mickey-mouse/engine";
import { countedMarksMickey } from "@/games/mickey-mouse/engine";
import type { ATCEngineState } from "@/games/around-the-clock/engine";
import type { LumberjackEngineState } from "@/games/lumberjack/engine";
import type { MinesweeperEngineState } from "@/games/minesweeper/engine";

export interface TeamRanking {
  teamId: string;
  rank: number;
  label: string;
}

export interface X01PlayerStat {
  /** Points scored (busted visits count 0) — 3-dart avg = points / darts × 3. */
  points: number;
  /** Visits scoring exactly 180. */
  visits180: number;
  /** Visits scoring 140–179. */
  visits140: number;
  /** Darts thrown with a one-dart finish available. */
  checkoutDarts: number;
  checkouts: number;
  /** Largest finish (the remaining score at the start of the winning visit). */
  highestCheckout: number;
}

export interface PlayerStat {
  playerId: string;
  teamId: string;
  dartsThrown: number;
  /** Darts that gave points or progress (see GameManifest.isScoringThrow). */
  dartsHit: number;
  x01?: X01PlayerStat;
  /** Cricket / Mickey Mouse: marks counted — MPR = marks / darts × 3. */
  marks?: number;
}

/**
 * v2: dartsHit means "gave points or progress" (v1 counted any non-miss),
 * plus per-player x01 and marks stats.
 */
export const WIN_SUMMARY_STATS_VERSION = 2;

export interface WinSummary {
  _type: "win-summary";
  statsVersion?: number;
  rankings: TeamRanking[];
  playerStats: PlayerStat[];
  totalDarts: number;
}

export function isWinSummary(x: unknown): x is WinSummary {
  return (
    !!x &&
    typeof x === "object" &&
    (x as Record<string, unknown>)._type === "win-summary"
  );
}

export function computeWinSummary(
  gameTypeId: string,
  teams: ReadonlyArray<Team>,
  winnerTeamIds: string[],
  steps: ReadonlyArray<ThrowStep>,
  engineState: unknown,
): WinSummary {
  const throws = steps.map((s) => s.throw_);
  const playerStats: PlayerStat[] = [];
  for (const team of teams) {
    for (const player of team.players) {
      const ps = steps.filter((s) => s.throw_.playerId === player.id);
      const stat: PlayerStat = {
        playerId: player.id,
        teamId: team.id,
        dartsThrown: ps.length,
        dartsHit: ps.filter((s) => s.scoring).length,
      };
      if (gameTypeId === "x01") {
        const x = x01PlayerStat(ps);
        stat.x01 = x.stat;
        stat.dartsHit = x.dartsHit;
      } else if (gameTypeId === "cricket") {
        stat.marks = sum(ps, (s) =>
          countedMarksCricket(s.before as CricketEngineState, s.after as CricketEngineState, s.throw_));
      } else if (gameTypeId === "mickey-mouse") {
        stat.marks = sum(ps, (s) =>
          countedMarksMickey(s.before as MickeyEngineState, s.after as MickeyEngineState, s.throw_));
      }
      playerStats.push(stat);
    }
  }

  let rankings: TeamRanking[];
  switch (gameTypeId) {
    case "x01":
      rankings = rankX01(teams, winnerTeamIds, throws, engineState as X01EngineState);
      break;
    case "cricket":
      rankings = rankCricket(teams, winnerTeamIds, engineState as CricketEngineState);
      break;
    case "mickey-mouse":
      rankings = rankMickey(teams, winnerTeamIds, engineState as MickeyEngineState);
      break;
    case "around-the-clock":
      rankings = rankATC(teams, winnerTeamIds, engineState as ATCEngineState);
      break;
    case "lumberjack":
      rankings = rankLumberjack(teams, winnerTeamIds, engineState as LumberjackEngineState);
      break;
    case "minesweeper":
      rankings = rankMinesweeper(teams, winnerTeamIds, engineState as MinesweeperEngineState);
      break;
    default:
      rankings = defaultRank(teams, winnerTeamIds);
  }

  return {
    _type: "win-summary",
    statsVersion: WIN_SUMMARY_STATS_VERSION,
    rankings,
    playerStats,
    totalDarts: throws.length,
  };
}

function sum<T>(xs: ReadonlyArray<T>, f: (x: T) => number): number {
  return xs.reduce((acc, x) => acc + f(x), 0);
}

/** Can `remaining` be finished with a single dart? */
function isOneDartFinish(remaining: number, doubleOut: boolean): boolean {
  if (doubleOut) return computeCheckout(remaining, 1, true) !== null;
  return (
    (remaining >= 1 && remaining <= 20) ||
    remaining === 25 ||
    remaining === 50 ||
    (remaining <= 40 && remaining % 2 === 0) ||
    (remaining <= 60 && remaining % 3 === 0)
  );
}

/** `steps` are one player's darts, in order. */
function x01PlayerStat(steps: ReadonlyArray<ThrowStep>): { stat: X01PlayerStat; dartsHit: number } {
  const stat: X01PlayerStat = {
    points: 0, visits180: 0, visits140: 0, checkoutDarts: 0, checkouts: 0, highestCheckout: 0,
  };
  let dartsHit = 0;

  // Split into visits; a bust wipes the whole visit's score.
  const visits: ThrowStep[][] = [];
  for (const s of steps) {
    if (s.visitStart || visits.length === 0) visits.push([]);
    visits[visits.length - 1]!.push(s);
  }

  for (const visit of visits) {
    const busted = visit.some((s) => s.effects.some((e) => e.kind === "bust"));
    const won = visit.some((s) => s.effects.some((e) => e.kind === "gameWon"));
    const points = busted
      ? 0
      : sum(visit, (s) => sum(s.effects, (e) => (e.kind === "scored" ? e.delta : 0)));
    stat.points += points;
    if (points === 180) stat.visits180++;
    else if (points >= 140) stat.visits140++;
    if (!busted) dartsHit += visit.filter((s) => s.scoring).length;
    if (won) {
      stat.checkouts++;
      stat.highestCheckout = Math.max(stat.highestCheckout, points);
    }

    for (const s of visit) {
      const st = s.before as X01EngineState;
      const teamId = s.throw_.teamId;
      const opened = !st.doubleIn || st.doubleInAchieved[teamId] === true;
      if (opened && isOneDartFinish(st.scoreByTeam[teamId] ?? 0, st.doubleOut)) {
        stat.checkoutDarts++;
      }
    }
  }
  return { stat, dartsHit };
}

function rankX01(
  teams: ReadonlyArray<Team>,
  winnerTeamIds: string[],
  throws: ReadonlyArray<ThrowRecord>,
  state: X01EngineState,
): TeamRanking[] {
  const entries = teams.map((t) => {
    const score = state.scoreByTeam[t.id] ?? 0;
    const isWinner = winnerTeamIds.includes(t.id);
    const teamDarts = throws.filter((tr) => tr.teamId === t.id).length;
    const pointsScored = state.startingScore - score;
    const avg3 = teamDarts > 0 ? (pointsScored / teamDarts) * 3 : 0;
    return { teamId: t.id, score, isWinner, avg3 };
  });

  entries.sort((a, b) => {
    if (a.isWinner !== b.isWinner) return a.isWinner ? -1 : 1;
    return a.score - b.score;
  });

  let rank = 1;
  return entries.map((e, i) => {
    if (i > 0 && entries[i - 1]!.score !== e.score) rank = i + 1;
    const label = e.isWinner
      ? `Checked out · avg ${e.avg3.toFixed(1)}`
      : `${e.score} left · avg ${e.avg3.toFixed(1)}`;
    return { teamId: e.teamId, rank, label };
  });
}

function rankCricket(
  teams: ReadonlyArray<Team>,
  winnerTeamIds: string[],
  state: CricketEngineState,
): TeamRanking[] {
  const entries = teams.map((t) => {
    const marks = state.marksByTeam[t.id] ?? {};
    const closed = CRICKET_TARGETS.filter(
      (tg) => (marks[String(tg)] ?? 0) >= 3,
    ).length;
    const score = state.scoreByTeam[t.id] ?? 0;
    return { teamId: t.id, closed, score, isWinner: winnerTeamIds.includes(t.id) };
  });

  entries.sort((a, b) => {
    if (a.isWinner !== b.isWinner) return a.isWinner ? -1 : 1;
    if (a.closed !== b.closed) return b.closed - a.closed;
    return b.score - a.score;
  });

  let rank = 1;
  return entries.map((e, i) => {
    if (i > 0) rank = i + 1;
    return {
      teamId: e.teamId,
      rank,
      label: `${e.closed}/7 closed · ${e.score} pts`,
    };
  });
}

function rankMickey(
  teams: ReadonlyArray<Team>,
  winnerTeamIds: string[],
  state: MickeyEngineState,
): TeamRanking[] {
  const total = state.targets.length;
  const entries = teams.map((t) => {
    const marks = state.marksByTeam[t.id] ?? {};
    const closed = state.targets.filter(
      (tg) => (marks[String(tg)] ?? 0) >= 3,
    ).length;
    return { teamId: t.id, closed, isWinner: winnerTeamIds.includes(t.id) };
  });

  entries.sort((a, b) => {
    if (a.isWinner !== b.isWinner) return a.isWinner ? -1 : 1;
    return b.closed - a.closed;
  });

  let rank = 1;
  return entries.map((e, i) => {
    if (i > 0) rank = i + 1;
    return {
      teamId: e.teamId,
      rank,
      label: `${e.closed}/${total} closed`,
    };
  });
}

function rankATC(
  teams: ReadonlyArray<Team>,
  winnerTeamIds: string[],
  state: ATCEngineState,
): TeamRanking[] {
  const entries = teams.map((t) => ({
    teamId: t.id,
    progress: state.progressByTeam[t.id] ?? 0,
    isWinner: winnerTeamIds.includes(t.id),
  }));

  entries.sort((a, b) => {
    if (a.isWinner !== b.isWinner) return a.isWinner ? -1 : 1;
    return b.progress - a.progress;
  });

  let rank = 1;
  return entries.map((e, i) => {
    if (i > 0) rank = i + 1;
    const label = e.progress >= 21 ? "Completed" : `Reached ${e.progress}/21`;
    return { teamId: e.teamId, rank, label };
  });
}

function rankLumberjack(
  teams: ReadonlyArray<Team>,
  winnerTeamIds: string[],
  state: LumberjackEngineState,
): TeamRanking[] {
  const entries = teams.map((t) => ({
    teamId: t.id,
    score: state.scoreByTeam[t.id] ?? 0,
    isWinner: winnerTeamIds.includes(t.id),
  }));

  entries.sort((a, b) => {
    if (a.isWinner !== b.isWinner) return a.isWinner ? -1 : 1;
    return b.score - a.score;
  });

  let rank = 1;
  return entries.map((e, i) => {
    if (i > 0 && entries[i - 1]!.score !== e.score) rank = i + 1;
    return { teamId: e.teamId, rank, label: `${e.score} pts` };
  });
}

function rankMinesweeper(
  teams: ReadonlyArray<Team>,
  winnerTeamIds: string[],
  state: MinesweeperEngineState,
): TeamRanking[] {
  const entries = teams.map((t) => ({
    teamId: t.id,
    score: state.scores[t.id] ?? 0,
    isWinner: winnerTeamIds.includes(t.id),
  }));

  entries.sort((a, b) => {
    if (a.isWinner !== b.isWinner) return a.isWinner ? -1 : 1;
    return b.score - a.score;
  });

  let rank = 1;
  return entries.map((e, i) => {
    if (i > 0 && entries[i - 1]!.score !== e.score) rank = i + 1;
    return { teamId: e.teamId, rank, label: `${e.score} pts` };
  });
}

function defaultRank(
  teams: ReadonlyArray<Team>,
  winnerTeamIds: string[],
): TeamRanking[] {
  const sorted = [...teams].sort((a, b) => {
    const aw = winnerTeamIds.includes(a.id) ? 0 : 1;
    const bw = winnerTeamIds.includes(b.id) ? 0 : 1;
    return aw - bw;
  });
  return sorted.map((t, i) => ({
    teamId: t.id,
    rank: i + 1,
    label: winnerTeamIds.includes(t.id) ? "Winner" : "",
  }));
}
