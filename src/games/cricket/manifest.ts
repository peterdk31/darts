import type { GameManifest } from "@/shared/types/game-module";
import { shanghaiSetting } from "@/shared/shanghai";
import {
  applyThrowCricket,
  getBoardHintsCricket,
  getQuickInputsCricket,
  getTurnHintCricket,
  initCricket,
  selectScoreboardCricket,
  type CricketEngineState,
} from "./engine";
import { ScoreboardPanel } from "./ui/ScoreboardPanel";

export const cricketManifest: GameManifest<CricketEngineState> = {
  id: "cricket",
  displayName: "Cricket",
  dartsPerPlayer: 3,
  settingsSchema: [shanghaiSetting],
  schemaVersion: 1,
  init: initCricket,
  applyThrow: applyThrowCricket,
  selectScoreboard: selectScoreboardCricket,
  getTurnHint: getTurnHintCricket,
  getBoardHints: getBoardHintsCricket,
  getQuickInputs: getQuickInputsCricket,
  view: (props) => ScoreboardPanel(props),
};
