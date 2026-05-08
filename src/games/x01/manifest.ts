import type { GameManifest } from "@/shared/types/game-module";
import { shanghaiSetting } from "@/shared/shanghai";
import {
  applyThrowX01,
  getBoardHintsX01,
  getTurnHintX01,
  initX01,
  selectScoreboardX01,
  type X01EngineState,
} from "./engine";
import { ScoreboardPanel } from "./ui/ScoreboardPanel";

export const x01Manifest: GameManifest<X01EngineState> = {
  id: "x01",
  displayName: "X01",
  dartsPerPlayer: 3,
  settingsSchema: [
    {
      key: "startingScore",
      label: "Starting score",
      type: "choice",
      default: "501",
      constraints: {
        choices: [
          { value: "301", label: "301" },
          { value: "501", label: "501" },
          { value: "701", label: "701" },
        ],
      },
    },
    { key: "doubleOut", label: "Double-out", type: "toggle" as const, default: false },
    { key: "doubleIn", label: "Double-in", type: "toggle" as const, default: false },
    shanghaiSetting,
  ],
  schemaVersion: 1,
  init: (ctx) => initX01(ctx, { startingScore: Number(ctx.resolvedSettings["startingScore"]) }),
  applyThrow: applyThrowX01,
  selectScoreboard: selectScoreboardX01,
  getTurnHint: getTurnHintX01,
  getBoardHints: getBoardHintsX01,
  view: (props) => ScoreboardPanel(props),
};
