import type { GameManifest } from "@/shared/types/game-module";
import { shanghaiSetting } from "@/shared/shanghai";
import {
  applyThrowATC,
  getBoardHintsATC,
  getQuickInputsATC,
  getTurnHintATC,
  initATC,
  selectScoreboardATC,
  type ATCEngineState,
} from "./engine";
import { ScoreboardPanel } from "./ui/ScoreboardPanel";

export const aroundTheClockManifest: GameManifest<ATCEngineState> = {
  id: "around-the-clock",
  displayName: "Around the Clock",
  dartsPerPlayer: 3,
  settingsSchema: [shanghaiSetting],
  schemaVersion: 1,
  init: initATC,
  applyThrow: applyThrowATC,
  selectScoreboard: selectScoreboardATC,
  getTurnHint: getTurnHintATC,
  getBoardHints: getBoardHintsATC,
  getQuickInputs: getQuickInputsATC,
  view: (props) => ScoreboardPanel(props),
};
