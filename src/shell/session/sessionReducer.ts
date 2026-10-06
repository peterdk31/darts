import type { Team } from "@/shared/types/core";
import type {
  CompletedGameRecord,
  InProgressGame,
  SessionState,
} from "./types";

export type SessionAction =
  | { type: "setTeams"; teams: Team[] }
  | { type: "setInProgressGame"; game: InProgressGame }
  | { type: "recordCompletedGame"; record: CompletedGameRecord }
  | { type: "discardInProgressGame" }
  | { type: "clearHistory" }
  | { type: "hydrate"; state: SessionState };

export const initialSessionState: SessionState = {
  teams: [],
  inProgressGame: null,
  history: [],
};

export function sessionReducer(
  state: SessionState,
  action: SessionAction,
): SessionState {
  switch (action.type) {
    case "hydrate":
      return action.state;

    case "setTeams":
      return { ...state, teams: action.teams };

    case "setInProgressGame":
      return { ...state, inProgressGame: action.game };

    case "recordCompletedGame":
      return {
        ...state,
        history: [...state.history, action.record],
        inProgressGame: null,
      };

    case "discardInProgressGame":
      return { ...state, inProgressGame: null };

    case "clearHistory":
      if (state.history.length === 0) return state;
      return { ...state, history: [] };
  }
}
