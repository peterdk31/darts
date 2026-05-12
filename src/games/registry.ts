import type { GameManifest } from "@/shared/types/game-module";
import { x01Manifest } from "./x01/manifest";
import { cricketManifest } from "./cricket/manifest";
import { aroundTheClockManifest } from "./around-the-clock/manifest";
import { mickeyMouseManifest } from "./mickey-mouse/manifest";
import { lumberjackManifest } from "./lumberjack/manifest";
import { killerManifest } from "./killer/manifest";

// Manifests have game-specific EngineState; the registry treats them opaquely.
// We widen to GameManifest<any> at the boundary because TS function-arg
// contravariance prevents GameManifest<X> from being assignable to GameManifest<unknown>.
type AnyManifest = GameManifest<any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const MANIFESTS: AnyManifest[] = [
  x01Manifest,
  cricketManifest,
  aroundTheClockManifest,
  mickeyMouseManifest,
  lumberjackManifest,
  killerManifest,
];

export function getById(id: string): AnyManifest | undefined {
  return MANIFESTS.find((m) => m.id === id);
}

export function listAll(): ReadonlyArray<AnyManifest> {
  return MANIFESTS;
}
