import type { GameManifest, SettingDefinition } from "@/shared/types/game-module";
import {
  applyThrowMickey,
  getCandidatesForThrow,
  initMickey,
  selectScoreboardMickey,
  type MickeyEngineState,
} from "./engine";
import { ScoreboardPanel } from "./ui/ScoreboardPanel";

const settings: SettingDefinition[] = [
  {
    key: "startingNumber",
    label: "Starting number",
    type: "choice",
    default: "15",
    constraints: {
      choices: [
        { value: "15", label: "15" },
        { value: "12", label: "12" },
      ],
    },
  },
  {
    key: "multipliersScore",
    label: "Multipliers count as 2×/3×",
    type: "toggle",
    default: true,
  },
  {
    key: "dtRequireTargetRange",
    label: "D/T only at or above starting number",
    type: "toggle",
    default: false,
  },
];

export const mickeyMouseManifest: GameManifest<MickeyEngineState> = {
  id: "mickey-mouse",
  displayName: "Mickey Mouse",
  dartsPerPlayer: 3,
  settingsSchema: settings,
  schemaVersion: 1,
  init: initMickey,
  applyThrow: applyThrowMickey,
  selectScoreboard: selectScoreboardMickey,
  getCandidatesForThrow,
  view: (props) => ScoreboardPanel(props),
};
