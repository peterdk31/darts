import type { Team, ThrowRecord } from "@/shared/types/core";
import type { X01EngineState } from "@/games/x01/engine";
import type { CricketEngineState } from "@/games/cricket/engine";
import { CRICKET_TARGETS } from "@/games/cricket/engine";
import type { MickeyEngineState } from "@/games/mickey-mouse/engine";
import type { ATCEngineState } from "@/games/around-the-clock/engine";

export interface TeamRanking {
  teamId: string;
  rank: number;
  label: string;
}

export interface PlayerStat {
  playerId: string;
  teamId: string;
  dartsThrown: number;
  dartsHit: number;
}

export interface WinSummary {
  _type: "win-summary";
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
  throws: ReadonlyArray<ThrowRecord>,
  engineState: unknown,
): WinSummary {
  const playerStats: PlayerStat[] = [];
  for (const team of teams) {
    for (const player of team.players) {
      const pt = throws.filter((t) => t.playerId === player.id);
      playerStats.push({
        playerId: player.id,
        teamId: team.id,
        dartsThrown: pt.length,
        dartsHit: pt.filter((t) => t.segment !== "miss").length,
      });
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
    default:
      rankings = defaultRank(teams, winnerTeamIds);
  }

  return { _type: "win-summary", rankings, playerStats, totalDarts: throws.length };
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
