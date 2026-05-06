import type { GameManifest } from "@/shared/types/game-module";
import {
  applyThrowX01,
  initX01,
  selectScoreboardX01,
  type X01EngineState,
} from "./engine";
import { ScoreboardPanel } from "./ui/ScoreboardPanel";

const X01_SCHEMA_VERSION = 1;

const settings = [
  { key: "doubleOut", label: "Double-out", type: "toggle" as const, default: false },
  { key: "doubleIn", label: "Double-in", type: "toggle" as const, default: false },
];

export const x501Manifest: GameManifest<X01EngineState> = {
  id: "x01.501",
  displayName: "501",
  dartsPerPlayer: 3,
  settingsSchema: settings,
  schemaVersion: X01_SCHEMA_VERSION,
  init: (ctx) => initX01(ctx, { startingScore: 501 }),
  applyThrow: applyThrowX01,
  selectScoreboard: selectScoreboardX01,
  view: (props) => ScoreboardPanel(props),
};

export const x301Manifest: GameManifest<X01EngineState> = {
  id: "x01.301",
  displayName: "301",
  dartsPerPlayer: 3,
  settingsSchema: settings,
  schemaVersion: X01_SCHEMA_VERSION,
  init: (ctx) => initX01(ctx, { startingScore: 301 }),
  applyThrow: applyThrowX01,
  selectScoreboard: selectScoreboardX01,
  view: (props) => ScoreboardPanel(props),
};
