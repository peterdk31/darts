import type { GameManifest, SettingDefinition } from "@/shared/types/game-module";
import {
  applyThrowMinesweeper,
  getBoardHintsMinesweeper,
  getQuickInputsMinesweeper,
  getTurnHintMinesweeper,
  initMinesweeper,
  selectScoreboardMinesweeper,
  type MinesweeperEngineState,
} from "./engine";
import { ScoreboardPanel } from "./ui/ScoreboardPanel";

const settings: SettingDefinition[] = [
  {
    key: "maxLives",
    label: "Lives",
    type: "integer",
    default: 3,
    constraints: { min: 1, max: 9 },
  },
  {
    key: "startingMines",
    label: "Starting mines",
    type: "integer",
    default: 3,
    constraints: { min: 1, max: 10 },
  },
  {
    key: "mineIncrement",
    label: "Mines added per round",
    type: "integer",
    default: 1,
    constraints: { min: 0, max: 5 },
  },
];

export const minesweeperManifest: GameManifest<MinesweeperEngineState> = {
  id: "minesweeper",
  displayName: "Minesweeper",
  dartsPerPlayer: 3,
  settingsSchema: settings,
  schemaVersion: 3,
  init: initMinesweeper,
  applyThrow: applyThrowMinesweeper,
  selectScoreboard: selectScoreboardMinesweeper,
  getTurnHint: getTurnHintMinesweeper,
  getBoardHints: getBoardHintsMinesweeper,
  getQuickInputs: getQuickInputsMinesweeper,
  view: (props) => ScoreboardPanel(props),
};
