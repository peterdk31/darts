# Quickstart: Dart Game Tracker

**Feature**: 001-dart-game-tracker
**Audience**: a developer setting up the project on a fresh machine and verifying it builds, tests, runs, and deploys correctly under a GitHub Pages base path.

---

## Prerequisites

- Node.js 20+ (LTS) and npm 10+.
- A modern evergreen browser for manual smoke testing.

---

## First-time setup

```bash
# from the repo root (/src/darts)
npm install
```

Project layout (post-Phase 1 — see plan.md "Project Structure"):

```text
src/
├── shell/        # host: routes, layout, session state
├── shared/       # storage, dartboard, types, routing — only allowed import surface for game modules
├── games/        # one folder per game module + registry.ts
└── styles/
tests/
├── unit/
├── integration/
└── e2e/          # optional Playwright at the four breakpoints
```

---

## Run the dev server

```bash
npm run dev
```

Open the printed URL (usually http://localhost:5173/). The dev server serves at root (`/`) — base-path correctness is verified at build time, not in dev.

---

## Run tests

```bash
# unit + component tests
npm run test            # vitest in watch mode
npm run test:run        # one-shot CI mode

# four-breakpoint screenshots (optional, requires Playwright install)
npm run test:e2e
```

Required test coverage (per `contracts/game-module.md` "Test obligations"):
- Each game module has a normal-play-to-win test.
- Each game module with bust semantics has a bust-path test.
- Each game module has an undo-equivalence test (replay equivalence after undo back to start).
- The storage layer has tests for round-trip, quota error, and corrupt-payload behaviour.

---

## Type check

```bash
npm run typecheck       # tsc --noEmit
```

Required to pass before merge. The game-module contract (`src/shared/types/game-module.ts`) is the project's most important type — any change to it requires lock-step updates in every module's `manifest.ts`.

---

## Production build

```bash
npm run build
```

Outputs to `dist/`. **Important**: `vite.config.ts` MUST set `base` to the GitHub Pages project path (e.g. `base: '/darts/'`) so asset URLs resolve correctly. Without this set, the deployed site loads a blank page on GitHub Pages — that is the canonical Principle II failure mode.

To verify the build under a non-root base locally:

```bash
npm run build && npx http-server dist -p 8080 --proxy http://localhost:8080?
# then open http://localhost:8080/<configured-base>/
```

If routing or assets break under the non-root base, the deploy gate has failed (see Constitution "Development Workflow & Quality Gates → Deployability gate").

---

## Manual smoke test (acceptance flow for User Story 1)

This walks through the P1 acceptance scenarios end-to-end. Do this before any release-tagged change.

1. Open the app fresh (clear localStorage first via DevTools → Application → Storage → Clear site data).
2. **Team setup**:
   - Add Team A with 2 players.
   - Add Team B with 1 player.
   - Click "Continue".
   - ✅ Both teams appear; the app routes to `#/game-select`.
3. **Game selection**:
   - Pick "501".
   - ✅ The settings screen shows "double-out" off and "double-in" off as defaults.
   - Leave defaults; click "Start".
4. **Play**:
   - ✅ The header shows: Team A • <player 1 name> • 6 darts remaining (3 darts/player × max-team-size 2 = 6 per team; team A's 2 players split 3-3).
   - Wait — actually with team A having 2 players, allotment is 6, and each player gets 3. Team B has 1 player, so they throw all 6.
   - Tap a triple-20.
   - ✅ Score updates by 60. Dart count decrements. Indicator stays on player 1 of Team A.
   - Continue tapping until player 1's allotment is consumed.
   - ✅ End-of-player confirmation appears; on confirm the indicator advances.
   - Tap the labelled MISS area surrounding the dartboard once during play (per FR-013, the outer ring of the dartboard component is the labelled MISS tap zone — there is no separate Miss button).
   - ✅ Dart counts as thrown but score does not change.
   - Tap "Undo".
   - ✅ The most recent throw is reversed (score, dart count, turn indicator).
   - Continue play until a team reaches 0.
   - ✅ App halts further input, displays the winner prominently, and writes a history entry.
5. **History**:
   - Navigate to `#/history`.
   - ✅ The completed game is listed with team, game type, and timestamp.
6. **Reload mid-game** (verifies FR-025):
   - Start a fresh game and throw a few darts.
   - Reload the browser (F5).
   - ✅ The play screen is restored within ~2s; the same player is up; scores match.
7. **Quota error simulation** (verifies FR-027a):
   - In DevTools, fill localStorage to near-quota with a junk key, then complete a game.
   - ✅ The app shows a clear, non-dismissable-until-acknowledged error naming the quota issue and offering to clear history.

---

## Adding a new game module (smoke test of Principle I)

Every six months, or whenever the contract changes, do this exercise to confirm the architecture still holds:

1. Create `src/games/dummy-game/` with a `manifest.ts`, an `engine.ts` whose `applyThrow` always emits `gameWon` after the first throw, and a one-line `view`.
2. Add the manifest import + entry to `src/games/registry.ts` (single edit).
3. Run `npm run typecheck` and `npm run dev`.
4. Pick "Dummy Game" from game-select and throw a dart.
5. ✅ The shell drives the module without any other edits. If you needed to edit any other game module's files, **the architecture has regressed and the change must be reverted**.

---

## Deployment

GitHub Pages deployment is a static-asset upload of `dist/`:

1. Confirm `vite.config.ts` has `base: '/<repo-name>/'`.
2. `npm run build`.
3. Deploy `dist/` via your preferred mechanism (GitHub Action, `gh-pages` branch push, etc. — out of scope for this plan).
4. Visit the deployed URL on a real mobile device. Verify at minimum: small phone (~360 px), large phone (~430 px), foldable inner (~700-850 px), and desktop (≥1200 px) — the four breakpoints required by Principle III.
