import type { GameManifest, SettingDefinition } from "@/shared/types/game-module";
import {
  applyThrowLumberjack,
  getBoardHintsLumberjack,
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
  getBoardHints: getBoardHintsLumberjack,
  view: (props) => ScoreboardPanel(props),
};
