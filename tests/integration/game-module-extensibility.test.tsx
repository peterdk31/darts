import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";

/**
 * Constitutional gate (Principle I): Adding a new game module MUST require only
 *   1. a new directory under `/src/darts/src/games/<phantom>/`
 *   2. a single line in `/src/darts/src/games/registry.ts`
 * No edits to other game modules. This test simulates that delta by mocking the
 * registry with a phantom manifest plus the four real ones, then asserting the
 * phantom appears on the GameSelectPage exactly like the others.
 */

vi.mock("@/games/registry", async () => {
  const actual =
    await vi.importActual<typeof import("@/games/registry")>(
      "@/games/registry",
    );
  const phantom = {
    id: "phantom.example",
    displayName: "Phantom Example",
    dartsPerPlayer: 3,
    settingsSchema: [],
    schemaVersion: 1,
    init: () => ({ done: false }),
    applyThrow: (state: unknown) => ({ state, effects: [] }),
    selectScoreboard: () => ({ rows: [] }),
  };
  const all = [...actual.listAll(), phantom];
  return {
    getById: (id: string) => all.find((m) => m.id === id),
    listAll: () => all,
  };
});

vi.mock("@/shell/session/useSession", () => ({
  useSession: () => ({
    state: {
      teams: [
        {
          id: "A",
          displayName: "Alpha",
          colorId: "red",
          players: [{ id: "A1", displayName: "Alice" }],
        },
        {
          id: "B",
          displayName: "Bravo",
          colorId: "green",
          players: [{ id: "B1", displayName: "Bob" }],
        },
      ],
      inProgressGame: null,
      history: [],
    },
  }),
}));

vi.mock("@/shell/session/SessionContext", () => ({
  useSessionContext: () => ({
    activeSession: { id: "test", name: "Test", createdAt: new Date().toISOString() },
    sessions: [],
    openSession: () => {},
    createSession: () => "test",
    deleteSession: () => {},
    leaveSession: () => {},
    state: { teams: [], inProgressGame: null, history: [] },
    dispatch: () => {},
    prefs: {},
    setPrefs: () => {},
    reportStorageError: () => {},
  }),
}));

vi.mock("@/shared/routing/router", () => ({
  useNavigate: () => () => {},
}));

import { GameSelectPage } from "@/shell/pages/GameSelectPage";
import { listAll } from "@/games/registry";

describe("game module extensibility (Principle I)", () => {
  beforeEach(() => {
    expect(listAll().some((m) => m.id === "phantom.example")).toBe(true);
  });

  it("renders the phantom manifest on GameSelectPage alongside real games", () => {
    render(<GameSelectPage />);
    expect(screen.getByText("X01")).toBeInTheDocument();
    expect(screen.getByText("Cricket")).toBeInTheDocument();
    expect(screen.getByText("Around the Clock")).toBeInTheDocument();
    expect(screen.getByText("Phantom Example")).toBeInTheDocument();
  });

  it("registry's getById resolves the phantom by id", () => {
    const all = listAll();
    expect(all.find((m) => m.id === "phantom.example")).toBeDefined();
    expect(all.find((m) => m.id === "phantom.example")!.displayName).toBe(
      "Phantom Example",
    );
  });
});
