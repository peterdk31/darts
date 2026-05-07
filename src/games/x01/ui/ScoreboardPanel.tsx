import type { ResolvedSettings } from "@/shared/types/game-module";
import type { Team } from "@/shared/types/core";
import { getTeamLabel } from "@/shared/teams/teamLabel";
import { allotmentForPlayer } from "@/shared/dart-allotment";
import type { X01EngineState } from "../engine";
import { computeCheckout, formatCheckout } from "../checkout";
import styles from "./ScoreboardPanel.module.css";

interface Props {
  state: X01EngineState;
  resolvedSettings: ResolvedSettings;
  teams: ReadonlyArray<Team>;
}

export function ScoreboardPanel({ state, resolvedSettings, teams }: Props) {
  const doubleOut = resolvedSettings["doubleOut"] === true;
  const doubleIn = resolvedSettings["doubleIn"] === true;

  const activeTeamId = state.turnOrder[state.pointer.teamIdx];
  const activeTeam =
    activeTeamId !== undefined
      ? state.teams.find((t) => t.id === activeTeamId)
      : undefined;
  const activeScore =
    activeTeamId !== undefined ? state.scoreByTeam[activeTeamId] : undefined;
  const dartsRemaining =
    activeTeam !== undefined
      ? clampDarts(
          allotmentForPlayer(
            state.dartsPerPlayer,
            state.maxTeamSize,
            activeTeam,
            state.pointer.playerIdxInTeam,
          ) - state.pointer.dartsThrownThisStretch,
        )
      : null;

  const checkout =
    state.status === "in-progress" &&
    doubleOut &&
    activeScore !== undefined &&
    dartsRemaining !== null
      ? computeCheckout(activeScore, dartsRemaining, true)
      : null;

  return (
    <div className={styles.panel}>
      <div className={styles.chips}>
        {doubleOut && <span className={styles.chip}>DO</span>}
        {doubleIn && <span className={styles.chip}>DI</span>}
        {checkout !== null && activeScore !== undefined ? (
          <span className={styles.checkoutChip} aria-label="Checkout suggestion">
            needs {activeScore}: {formatCheckout(checkout)}
          </span>
        ) : null}
      </div>
      <ul className={styles.list}>
        {teams.map((t) => (
          <li key={t.id} className={styles.row}>
            <span
              className={styles.dot}
              style={{ background: `var(--team-color-${t.colorId})` }}
              aria-hidden="true"
            />
            <span className={styles.name}>{getTeamLabel(t)}</span>
            <span className={styles.score}>{state.scoreByTeam[t.id] ?? 0}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function clampDarts(n: number): 1 | 2 | 3 | null {
  if (n === 1 || n === 2 || n === 3) return n;
  return null;
}
