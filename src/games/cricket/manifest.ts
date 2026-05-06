import type { GameManifest } from "@/shared/types/game-module";
import {
  applyThrowCricket,
  getBoardHintsCricket,
  initCricket,
  selectScoreboardCricket,
  type CricketEngineState,
} from "./engine";
import { ScoreboardPanel } from "./ui/ScoreboardPanel";

export const cricketManifest: GameManifest<CricketEngineState> = {
  id: "cricket",
  displayName: "Cricket",
  dartsPerPlayer: 3,
  settingsSchema: [],
  schemaVersion: 1,
  init: initCricket,
  applyThrow: applyThrowCricket,
  selectScoreboard: selectScoreboardCricket,
  getBoardHints: getBoardHintsCricket,
  view: (props) => ScoreboardPanel(props),
};
