import type { GameManifest } from "@/shared/types/game-module";
import { x501Manifest, x301Manifest } from "./x01/manifest";
import { cricketManifest } from "./cricket/manifest";
import { aroundTheClockManifest } from "./around-the-clock/manifest";

// Manifests have game-specific EngineState; the registry treats them opaquely.
// We widen to GameManifest<any> at the boundary because TS function-arg
// contravariance prevents GameManifest<X> from being assignable to GameManifest<unknown>.
type AnyManifest = GameManifest<any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const MANIFESTS: AnyManifest[] = [
  x501Manifest,
  x301Manifest,
  cricketManifest,
  aroundTheClockManifest,
];

export function getById(id: string): AnyManifest | undefined {
  return MANIFESTS.find((m) => m.id === id);
}

export function listAll(): ReadonlyArray<AnyManifest> {
  return MANIFESTS;
}
