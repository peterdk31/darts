import type { GameManifest } from "@/shared/types/game-module";
import {
  applyThrowATC,
  getBoardHintsATC,
  initATC,
  selectScoreboardATC,
  type ATCEngineState,
} from "./engine";
import { ScoreboardPanel } from "./ui/ScoreboardPanel";

export const aroundTheClockManifest: GameManifest<ATCEngineState> = {
  id: "around-the-clock",
  displayName: "Around the Clock",
  dartsPerPlayer: 3,
  settingsSchema: [],
  schemaVersion: 1,
  init: initATC,
  applyThrow: applyThrowATC,
  selectScoreboard: selectScoreboardATC,
  getBoardHints: getBoardHintsATC,
  view: (props) => ScoreboardPanel(props),
};
