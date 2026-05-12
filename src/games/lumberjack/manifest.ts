import type { GameManifest, SettingDefinition } from "@/shared/types/game-module";
import { shanghaiSetting } from "@/shared/shanghai";
import {
  applyThrowLumberjack,
  getBoardHintsLumberjack,
  getQuickInputsLumberjack,
  getTurnHintLumberjack,
  initLumberjack,
  selectScoreboardLumberjack,
  type LumberjackEngineState,
} from "./engine";
import { ScoreboardPanel } from "./ui/ScoreboardPanel";

const settings: SettingDefinition[] = [
  {
    key: "dtAbove15Only",
    label: "D/T only 15 and above",
    type: "toggle",
    default: false,
  },
  {
    key: "reverseOrder",
    label: "Reverse round order",
    type: "toggle",
    default: false,
  },
  shanghaiSetting,
];

export const lumberjackManifest: GameManifest<LumberjackEngineState> = {
  id: "lumberjack",
  displayName: "Lumberjack",
  dartsPerPlayer: 3,
  settingsSchema: settings,
  schemaVersion: 1,
  init: initLumberjack,
  applyThrow: applyThrowLumberjack,
  selectScoreboard: selectScoreboardLumberjack,
  getTurnHint: getTurnHintLumberjack,
  getBoardHints: getBoardHintsLumberjack,
  getQuickInputs: getQuickInputsLumberjack,
  view: (props) => ScoreboardPanel(props),
};
