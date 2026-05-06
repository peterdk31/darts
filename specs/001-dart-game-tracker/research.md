# Research: Dart Game Tracker

**Feature**: 001-dart-game-tracker
**Date**: 2026-05-06
**Status**: Phase 0 complete — all NEEDS CLARIFICATION resolved.

This document records the research decisions that resolved the unknowns in `plan.md`'s Technical Context. Each entry follows: **Decision / Rationale / Alternatives considered**.

---

## R1. Build tool

**Decision**: Vite 5.x with the React plugin.

**Rationale**: The constitution names Vite explicitly as an acceptable static-build toolchain. Vite produces a fully static `dist/` and supports a `base` config option that maps cleanly to GitHub Pages project sites (`/<repo>/`). Fast dev server (ESM + HMR) keeps the iteration loop short on a UI-heavy project.

**Alternatives considered**:
- **Create React App** — deprecated, slow dev server, harder GH Pages base-path story.
- **Next.js (static export)** — its full power (SSR/ISR/middleware) is wasted here and contradicts Principle II ("no build step that assumes server-side rendering"). Static export works but adds opinions we don't need.
- **Parcel / esbuild-only** — workable but Vite has the most idiomatic React + GH Pages workflow.

---

## R2. Language

**Decision**: TypeScript 5.x, project-wide.

**Rationale**: The constitution recommends TypeScript and forbids per-file adoption. Strong types are especially valuable for the game-module contract (Principle I) — they let the compiler enforce that a new game's manifest matches the registry's expected shape, which is exactly the boundary we want machine-checked.

**Alternatives considered**:
- **JavaScript + JSDoc** — the contract surface is rich enough (engine state, throw events, settings schema) that JSDoc would be high-noise. Rejected.

---

## R3. Routing

**Decision**: Hash-based routing. Start with a tiny in-repo hash router (~50 lines: parse `location.hash`, listen to `hashchange`, expose `navigate(path)`); reach for `react-router-dom` v6 in `HashRouter` mode only if the in-repo solution proves limiting once more than ~6 routes exist.

**Rationale**: Principle II requires routing that survives GH Pages deep links and base paths. Hash routes (`/#/play`) bypass server 404 issues entirely. With ~5 screens and no nested routing needs, an in-repo solution is the YAGNI answer (Principle V) — "each new runtime npm dependency requires a one-line note." Adding `react-router-dom` (~10 KB) before we know we need it would violate that gate.

**Alternatives considered**:
- **`react-router-dom` HashRouter from day 1** — well-known, but heavier than this app needs. Reserved as the upgrade path if scope grows.
- **BrowserRouter with `<base href>`** — works on GH Pages but is fragile under direct URL refresh on subpaths and requires server fallback rules we don't control. Rejected.

---

## R4. State management

**Decision**: React `useReducer` per game engine + `Context` for session-level state (teams, in-progress game pointer, history). No Redux, Zustand, Jotai, or similar.

**Rationale**: Principle V forbids a state-management framework "before two independent modules demonstrably need to share state through it." In this app, each game engine owns its own reducer (state is local to the module — see Principle I), and the only cross-module state is the session-level data that the shell owns. A single Context with a reducer covers it.

**Alternatives considered**:
- **Zustand** — small and pleasant, but introducing a global store implicitly invites games to reach across module boundaries. Rejected on Principle I grounds, not size.
- **Redux Toolkit** — the slice model would technically map well to game modules, but the runtime + ergonomic cost is unjustified for v1.

---

## R5. Storage abstraction shape

**Decision**: A single module `src/shared/storage/` exposing typed get/set/delete/list operations keyed by namespace (e.g., `session`, `inProgressGame`, `history`, `game:x01`, `game:cricket`). Every persisted record is wrapped as `{ schemaVersion: number, data: T }`. The driver behind the abstraction is `localStorage` only in v1; the abstraction is shaped so that swapping in `IndexedDB` later requires no call-site changes.

**Rationale**: Satisfies Gate IV.a (single access surface) and Gate IV.b (versioned records, per-module migrations). The thin namespacing + version envelope is the minimum viable pattern that lets each game module own its migrations without leaking storage primitives.

The abstraction MUST also expose a `QuotaExceededError` distinct from generic write failure so the shell can satisfy FR-027a (surface a non-dismissable-until-acknowledged error prompting the user to clear history).

**Alternatives considered**:
- **Direct `localStorage.*` calls** — explicitly forbidden by Gate IV.a.
- **A heavier ORM-style layer (Dexie etc.)** — rejected on YAGNI; localStorage with a thin wrapper is sufficient for v1 payload sizes.

---

## R6. Game-module contract shape

**Decision**: Each game module exports a `GameManifest` object with:
- `id` (string, unique across registry)
- `displayName`
- `settingsSchema` (array of `{ key, label, type, default, constraints }` describing per-match options)
- `init(teams, resolvedSettings)` returning an opaque `EngineState`
- `applyThrow(state, throwEvent)` returning `{ state, effects }` where effects are declarative (e.g., `turnAdvanced`, `gameWon`, `bust`)
- `view` (a React component receiving `{ state, resolvedSettings, teams }`) for game-specific UI panels (e.g., Cricket's number-closure grid). Note: `view` does NOT receive `dispatch` — modules render state-derived UI only and cannot drive shell behaviour from their panel. See R16 for the rationale (Cricket grid stays read-only in v1).
- `selectScoreboard(state)` for the shared scoreboard renderer
- `schemaVersion` and `migrate(prior)` for the module's persisted state

**Rationale**: This is the smallest contract that lets the shell drive the game without knowing its rules. The shell owns turn-pointer rendering, the dartboard, undo/redo (via re-running `applyThrow` over the kept event log), and persistence — the module owns rules and game-specific UI. Captures Principle I cleanly.

The undo/redo strategy is event-sourced: the shell stores the throw log, and on undo it slices the log and replays through `applyThrow` to reconstruct state. This avoids each module having to implement undo separately.

**Alternatives considered**:
- **Each module owns its own undo/redo** — duplicates work across modules and risks subtle inconsistencies. Rejected.
- **Class-based engine with inheritance** — pulls modules toward a shared base class, which becomes a coupling point. Rejected.

---

## R7. Dartboard rendering

**Decision**: SVG. One `<svg>` with `viewBox="0 0 400 400"` (so size is purely CSS-driven), a path per scoring region (single, double, triple, outer-bull, inner-bull) with `pointer-events: fill` on each. The miss control is a separate button outside the SVG.

**Rationale**: SVG gives us:
- Exact, scalable hit regions per Principle III (44×44 minimum is automatic at any reasonable display size since the smallest segment at a 320 px-wide screen is still well above that).
- Native pointer / touch event handling without the complications of canvas hit-testing.
- DOM-level targets that are individually testable (RTL `getByRole('button', { name: 'Triple 20' })`).
- Keyboard reachability for accessibility — each region can be a focusable button.

Sizing rule: dartboard container is `min(100vw, 100vh - var(--play-chrome-height))`. This satisfies III.a's fluid-layout requirement and behaves on foldables in both postures.

**Alternatives considered**:
- **Canvas** — pixel-perfect but hit-testing requires custom math, accessibility/testing are harder, no semantic tree. Rejected.
- **Background image + invisible button overlay** — fragile under scaling, accessibility-poor. Rejected.

---

## R8. Testing stack

**Decision**: **Vitest** for unit + component tests, **React Testing Library** for component behaviour, **Playwright** for the four-breakpoint smoke per Principle III.

**Rationale**:
- Vitest integrates with Vite zero-config, matches Jest API surface, and is fast.
- RTL is the React community standard and pairs naturally with the dartboard's accessible-button approach (R7).
- Playwright is the lightest tool that can render the app at the four required CSS-px viewports (~360, ~430, ~700-850, ≥1200) on the four required browser engines and produce screenshots for the responsive review gate. If Playwright proves heavy for a v1 with no CI yet, manual screenshots at the four breakpoints are an acceptable v1 substitute provided each PR records them.

**Alternatives considered**:
- **Jest** — works but adds Babel/ts-jest overhead Vite avoids. Rejected.
- **Cypress** — heavier than Playwright for breakpoint-only flows; weaker multi-engine support.

---

## R9. 501 vs 301 — one module or two?

**Decision**: One module `src/games/x01/` that registers two distinct game types (`x01.501` and `x01.301`) from a single `manifest.ts`. The engine is one function parameterised by starting score; the manifest exports an array of `GameManifest` entries (or two manifests imported by one registry entry — both are valid).

**Rationale**: Principle I says a new *game module* should require only a new module directory plus a registry entry. It does NOT mandate one module per registered game type — only that each module owns its rules and is decoupled from others. 501 and 301 differ only in starting score; making them separate modules would force duplication or a forbidden cross-module import (Gate I.c). Treating them as one module that registers two types is faithful to Principle I (no shared logic between *modules*; sharing within one module is allowed) and to Principle V (no needless duplication). The registry stays the single registration surface.

**Alternatives considered**:
- **Two modules with x01 logic copied** — violates V and creates a maintenance hazard.
- **A `shared/x01-engine` helper imported by both** — would either be in `shared/` (game-specific logic in the shared layer — Principle I violation in spirit) or imported across modules (Gate I.c violation). Rejected.

---

## R10. Quota / persistence-failure UX

**Decision**: The storage layer throws a typed `StorageQuotaError`. The shell catches it at every write site that involves session-history or in-progress-game persistence and shows a modal that:
1. Names the cause ("Browser storage is full").
2. Lists what is stored (history of N completed games, currently in-progress game).
3. Offers a "Clear history" action (reversible only by reload from a fresh cache, so confirm twice).
4. Cannot be dismissed without acknowledgement (per FR-027a "non-dismissable-until-acknowledged").

The app MUST NOT silently evict history. This is a gate of Principle IV.c ("graceful degrade + clear user message") combined with FR-027a.

**Rationale**: localStorage quota is typically 5 MB per origin. The session-history entry size is tiny (~1 KB JSON per game), so reaching quota likely indicates a corrupted accumulation or another app on the same origin — either way, user-visible action is the right answer.

**Alternatives considered**:
- **Auto-evict oldest history** — explicitly forbidden by FR-027a.
- **Toast warning that auto-dismisses** — FR-027a requires non-dismissable-until-acknowledged.

---

## R11. Foldable / posture handling

**Decision**: Use CSS container queries on the play screen container (`@container (min-width: 700px) { ... }`). No JavaScript posture detection; rely on the browser's resize behaviour when the fold changes.

**Rationale**: Container queries are baseline-supported in all current evergreen browsers (Chrome, Safari, Firefox, Edge) as of 2024+. They handle the foldable case (~700-850 px inner display) more accurately than `@media` because the dartboard component cares about its parent's size, not the viewport's. No JS heuristic is needed.

**Alternatives considered**:
- **`window.matchMedia` + JS layout** — fragile across postures, adds complexity. Rejected.
- **Visual Viewport API** — unnecessary for layout decisions when container queries exist.

---

## R12. Bundle size and offline-first

**Decision**: No service worker in v1. The browser's HTTP cache + Vite's content-hashed asset names provide offline-after-first-load behaviour for the static bundle that is "good enough" — the constitution says "subject to browser cache policies" and "desirable but not strictly required."

**Rationale**: Adding a service worker is non-trivial (cache invalidation, update flow, registration scope under `/<repo>/`) and YAGNI for v1. If users report stale bundles on second load, revisit with Vite PWA plugin.

**Alternatives considered**:
- **Vite PWA plugin from day 1** — premature; reserved for v1.1 if needed.

---

## R13. Visual language

**Decision**: Auto theme via `prefers-color-scheme` (no manual override). Single accent: electric blue (`#2563eb`-ish) for primary actions and active states; destructive red reserved for irreversible prompts (Abandon Game, Clear History). System font stack throughout. Touch-target minimum 48 CSS px (above the constitution's 44 px floor) — "chunky" density for play-while-standing-near-a-dartboard ergonomics.

**Rationale**: Auto theme keeps the UI usable in both lit and dim spaces (a real-world dart-play concern) without spending a UI slot on a toggle. A single accent + a dedicated destructive color reserves color budget for team identity (R15). System fonts cost zero bytes, render fast, and adapt to OS conventions. 48 px targets satisfy III.b with margin and reduce mis-taps on phones held informally during play.

**Alternatives considered**:
- **Manual theme toggle** — extra UI surface; users almost always want OS-aligned theming. Rejected (YAGNI; revisit if demanded).
- **Webfont for headings** — bundling a font conflicts with offline-first goals and adds cold-load weight for marginal aesthetic gain. Rejected.
- **Compact (44 px) targets** — meets the floor but no slack for cold/sweaty fingers around a dartboard. Rejected.

---

## R14. Dartboard visual design

**Decision**:
- Two **board themes**: `traditional` (regulation black/cream/red/green) and `desaturated` (lower-contrast palette for low-light play). `traditional` is the default. Theme is selected by the user via a gear-icon settings menu on the play screen and persisted in the `prefs` storage namespace (data-model.md).
- Number ring (1, 20, 5, 12, …) sits **outside** the doubles ring on a transparent ring; the area outside the doubles ring also serves a second purpose — it is the labelled **"MISS" tap zone**, replacing a separate Miss button (FR-013).
- Hit feedback: a brief (~150 ms) accent-color flash on the tapped segment plus a persistent dot at the tap location for the duration of the current player's turn. Dots are cleared when the turn advances.
- Press / hover: standard `darken-on-press` for touch and `lighten-on-hover` for mouse. No hover-only behaviour (Gate III.d).

**Rationale**: Traditional colours are instantly readable for anyone who has seen a dartboard; a desaturated mode prevents the cream wedges from glowing in dark mode. Numbers outside the doubles ring matches a real board and frees the area outside for the dual-purpose MISS zone — fewer controls, one big tap target for the most common error case ("dart missed entirely"). Per-turn dots help the player visually verify the three darts they just recorded before confirming end-of-player; auto-clear keeps the board uncluttered across turns.

Themes are implemented as a `data-board-theme="traditional|desaturated"` attribute on the dartboard wrapper that swaps a small set of CSS custom properties (segment fills, ring fills). No JS branching inside the SVG.

**Alternatives considered**:
- **Stylized monochrome board** — aesthetically interesting but loses the recognisability of traditional colour wedges. Rejected as default; desaturated mode is the compromise.
- **Numbers inside the doubles ring** — saves a few pixels but breaks visual familiarity. Rejected.
- **Separate Miss button outside the dartboard component** — duplicates intent; the area outside the playing surface is semantically "you missed". Folded into the board.

---

## R15. Team identity and color palette

**Decision**: Each team is identified by (a) a **color** drawn from a fixed 8-hue palette and (b) a **numeric badge** ("Team 1", "Team 2", …) rendered alongside the team's display name everywhere the team is identified.

The palette is: `red, green, orange, purple, teal, pink, yellow, cyan` — chosen to (i) avoid the app accent (electric blue) so primary actions remain distinct, (ii) span the hue wheel for distinguishability, (iii) maintain readable contrast in both light and dark modes when paired with text, and (iv) verify against deuteranopia simulation by giving red and green distinct lightness values (red darker than green) so they remain distinguishable in grayscale.

Colors are auto-assigned in team-creation order; users can override per-team via a swatch picker on the team-setup screen. Color is used **sparingly** — turn-indicator card stripe, scoreboard team-name dot, dart-marker dots in the active team's color — never as a full row/page background.

**Rationale**: Color-only identity fails for color-blind users (~8% of male players); pairing color with a numeric badge satisfies WCAG and matches how players naturally refer to teams when names overlap ("Team 2 just won"). Sparing color use keeps the UI legible with up to 8 distinct team colors on screen — flooding rows in 8 colors makes scanning impossible. Auto-assignment plus override is the fastest setup path that still respects "we're always green" preferences.

**Alternatives considered**:
- **Numbered-only (no color)** — accessible but bland and slower to scan. Rejected.
- **User-pickable emoji** — fun but adds a non-trivial picker UI for a v1 with no demand. YAGNI. Rejected.
- **Including blue as Team 1** — overlaps semantically with the action accent; rejected to keep the accent's "primary action" meaning unambiguous.

---

## R16. Game-specific panel UX

**Decision (per game)**:
- **x01 (501 / 301)** — small chip near the turn indicator showing the active settings (e.g. "DO" badge if `doubleOut` is on). On a `bust` effect from `applyThrow`, the play screen surfaces a brief banner ("BUST — score reverts to N") for 2-3 seconds before the turn advances (FR-030). When the active player's team score is ≤ 170 and `doubleOut` is on, a checkout-hint chip displays a suggested finish (FR-029) computed by an x01-internal helper (`src/games/x01/checkout.ts`). Checkout hints are scheduled in the **Final / Polish iteration** rather than MVP, so the v1 MVP plays correctly without them.
- **Cricket** — a closure grid (rows: 20/19/18/17/16/15/Bull, columns: teams; cells show 0/1/2/3 marks) replaces the standard scoreboard for this game type. Per-team scores are shown in the column header. The grid is **read-only display** in v1 — the dartboard remains the sole input surface. (An interactive grid was considered but introduces a multiplier-choice UX that adds non-trivial complexity for marginal value; deferred.)
- **Around the Clock** — a per-team progress strip showing the 1-20-Bull sequence with completed segments filled, plus the active player's current target highlighted on the shared dartboard via the `getBoardHints` extension (R-extension below).

**Module-contract extension**: `GameManifest` gains an optional method `getBoardHints(state) → { highlight?, dim? }` that returns lists of segment numbers (1-20 plus `"bull"`) the dartboard should visually accentuate. Cricket may use `dim` for numbers closed by every team; Around the Clock uses `highlight` for the active player's target. The shared dartboard renders these declaratively — it never receives game-specific code, preserving Principle I (the board never sees rules, only `number[] | "bull"[]`).

**Rationale**: Each game's idiomatic display differs enough that one generic scoreboard cannot serve all four well. The contract extension for `getBoardHints` is small, optional, and declarative — modules that don't implement it get a plain board. The decision to keep Cricket's grid read-only follows the user's "IFF not too much extra logic" guidance: making cells interactive would force a multiplier-selection UX (S/D/T cycle, popover, or three sub-cells per row) that exceeds the budget for marginal benefit. The existing `view` contract still allows future modules to render their own input surfaces by accepting `dispatch` if the contract is extended later — but v1 doesn't need it.

**Alternatives considered**:
- **One generic scoreboard for all games** — Cricket especially loses critical structure (closure marks). Rejected.
- **Interactive Cricket grid in v1** — extra UX complexity, contract surface change. Deferred per user guidance.
- **Game-specific code in the shared dartboard** — violates Principle I. Rejected; `getBoardHints` is the declarative alternative.

---

## R17. CSS and styling approach

**Decision**: Plain CSS with **CSS Modules** (Vite-native, no plugin) plus **CSS custom properties** for design tokens. A single `src/styles/tokens.css` defines grouped tokens (`--color-*`, `--space-*`, `--font-*`, `--radius-*`, plus team-color and board-theme tokens). Theme switching is **pure CSS** via `@media (prefers-color-scheme: dark) { :root { --... } }` — no JS branching, matching R13's auto-only theming. A small (~20-line) modern CSS reset is hand-copied into `src/styles/reset.css` (Andy Bell / Josh Comeau style). No Tailwind, UnoCSS, or CSS-in-JS.

**Rationale**: Vite ships CSS Modules and `@import` resolution out of the box. Custom properties make theming declarative and make team-color / board-theme overrides trivially scoped via attribute selectors (`[data-board-theme="desaturated"]` swaps a handful of variables). YAGNI gate (Principle V.c) penalises every new runtime npm dep — Tailwind, UnoCSS, and CSS-in-JS each add either build-time tooling or runtime weight beyond what 5 screens warrant. Hand-copying a reset trades a one-time ~20 lines against a runtime dep on `modern-normalize`.

**Alternatives considered**:
- **Tailwind** — utility-first wins at scale; for ~5 screens the toolchain cost dominates. Rejected.
- **UnoCSS** — lighter Tailwind alt; same rationale, rejected at this scope.
- **CSS-in-JS (styled-components / emotion)** — runtime cost (style serialization on every render) without a corresponding ergonomic win for this app. Rejected.
- **`modern-normalize` package** — fine but ~20 lines of reset is stable enough to copy. Rejected on YAGNI.

---

## Summary of dependency additions

Runtime npm dependencies added by this plan:

| Dependency | Reason | Principle gate |
|------------|--------|----------------|
| `react`, `react-dom` | Core framework (constitution-mandated) | II |
| _(no router runtime dep in v1)_ | In-repo hash router; reserve `react-router-dom` for later | V |
| _(no state-mgmt runtime dep)_ | `useReducer` + Context only | V |

Build/test (devDependencies):

| Dependency | Reason |
|------------|--------|
| `vite`, `@vitejs/plugin-react` | Constitution-recommended static toolchain |
| `typescript` | Constitution-recommended language |
| `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom` | Unit + component testing |
| `@playwright/test` _(optional v1)_ | Four-breakpoint screenshots for Principle III gate |

All entries above satisfy Gate V.c (one-line justification per dependency).
