import type { Team, ThrowRecord } from "@/shared/types/core";
import type {
  CompletedGameRecord,
  CurrentTurn,
  InProgressGame,
  SessionState,
} from "./types";

export type SessionAction =
  | { type: "setTeams"; teams: Team[] }
  | { type: "setInProgressGame"; game: InProgressGame }
  | {
      type: "appendThrow";
      throw_: ThrowRecord;
      engineState: unknown;
      currentTurn: CurrentTurn;
    }
  | {
      type: "popThrow";
      engineState: unknown;
      currentTurn: CurrentTurn;
    }
  | {
      type: "popRedo";
      engineState: unknown;
      currentTurn: CurrentTurn;
    }
  | { type: "pushRedo"; throw_: ThrowRecord }
  | { type: "clearRedo" }
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

    case "appendThrow": {
      if (!state.inProgressGame) return state;
      const next: InProgressGame = {
        ...state.inProgressGame,
        throws: [...state.inProgressGame.throws, action.throw_],
        redoStack: [], // recording a new throw clears redo stack (FR-024)
        engineState: action.engineState,
        currentTurn: action.currentTurn,
      };
      return { ...state, inProgressGame: next };
    }

    case "popThrow": {
      if (!state.inProgressGame) return state;
      const ip = state.inProgressGame;
      if (ip.throws.length === 0) return state;
      const popped = ip.throws[ip.throws.length - 1]!;
      const next: InProgressGame = {
        ...ip,
        throws: ip.throws.slice(0, -1),
        redoStack: [...ip.redoStack, popped],
        engineState: action.engineState,
        currentTurn: action.currentTurn,
      };
      return { ...state, inProgressGame: next };
    }

    case "popRedo": {
      if (!state.inProgressGame) return state;
      const ip = state.inProgressGame;
      if (ip.redoStack.length === 0) return state;
      const popped = ip.redoStack[ip.redoStack.length - 1]!;
      const next: InProgressGame = {
        ...ip,
        throws: [...ip.throws, popped],
        redoStack: ip.redoStack.slice(0, -1),
        engineState: action.engineState,
        currentTurn: action.currentTurn,
      };
      return { ...state, inProgressGame: next };
    }

    case "pushRedo": {
      if (!state.inProgressGame) return state;
      return {
        ...state,
        inProgressGame: {
          ...state.inProgressGame,
          redoStack: [...state.inProgressGame.redoStack, action.throw_],
        },
      };
    }

    case "clearRedo": {
      if (!state.inProgressGame) return state;
      if (state.inProgressGame.redoStack.length === 0) return state;
      return {
        ...state,
        inProgressGame: { ...state.inProgressGame, redoStack: [] },
      };
    }

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
