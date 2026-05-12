import type { GameManifest, SettingDefinition } from "@/shared/types/game-module";
import {
  applyThrowKiller,
  getBoardHintsKiller,
  getQuickInputsKiller,
  getTurnHintKiller,
  initKiller,
  selectScoreboardKiller,
  type KillerEngineState,
} from "./engine";
import { ScoreboardPanel } from "./ui/ScoreboardPanel";

const settings: SettingDefinition[] = [
  {
    key: "maxLives",
    label: "Max lives (0 = no limit)",
    type: "integer",
    default: 3,
    constraints: { min: 0, max: 9 },
  },
  {
    key: "targets",
    label: "Targets",
    type: "choice",
    default: "all",
    constraints: {
      choices: [
        { value: "all", label: "All (S / D / T)" },
        { value: "doubles", label: "Doubles only" },
        { value: "trebles", label: "Trebles only" },
      ],
    },
  },
  {
    key: "killerStraightOff",
    label: "Start as killers",
    type: "toggle",
    default: false,
  },
  {
    key: "numberSelection",
    label: "Number selection",
    type: "choice",
    default: "throw",
    constraints: {
      choices: [
        { value: "throw", label: "Throw to claim" },
        { value: "random", label: "Random" },
      ],
    },
  },
];

export const killerManifest: GameManifest<KillerEngineState> = {
  id: "killer",
  displayName: "Killer",
  dartsPerPlayer: 3,
  settingsSchema: settings,
  schemaVersion: 2,
  init: initKiller,
  applyThrow: applyThrowKiller,
  selectScoreboard: selectScoreboardKiller,
  getTurnHint: getTurnHintKiller,
  getBoardHints: getBoardHintsKiller,
  getQuickInputs: getQuickInputsKiller,
  view: (props) => ScoreboardPanel(props),
};
