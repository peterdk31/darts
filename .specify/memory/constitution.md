<!--
SYNC IMPACT REPORT
==================
Version change: (uninitialized template) → 1.0.0
Bump rationale: Initial ratification. Template placeholders replaced with concrete
principles and governance for the Darts webapp project. MAJOR baseline established.

Modified principles:
- [PRINCIPLE_1_NAME] → I. Module-First Game Architecture
- [PRINCIPLE_2_NAME] → II. Frontend-Only, Static-Deployable
- [PRINCIPLE_3_NAME] → III. Responsive, Mobile-First UI
- [PRINCIPLE_4_NAME] → IV. Local-First Persistence
- [PRINCIPLE_5_NAME] → V. Simplicity & Decoupling (YAGNI)

Added sections:
- Technology & Platform Constraints (replaces [SECTION_2_NAME])
- Development Workflow & Quality Gates (replaces [SECTION_3_NAME])
- Governance (concrete amendment, versioning, and compliance rules)

Removed sections: none

Templates requiring updates:
- ✅ .specify/memory/constitution.md (this file)
- ⚠ .specify/templates/plan-template.md — "Constitution Check" section is empty;
   recommend adding gates derived from Principles I–V on next plan iteration.
- ⚠ .specify/templates/spec-template.md — generic; no constitution-specific
   sections required at this time, but mobile/offline assumptions should be
   reflected in feature specs.
- ⚠ .specify/templates/tasks-template.md — task ladder is principle-agnostic;
   future updates may add module-boundary checks per Principle I.
- N/A .specify/templates/commands/*.md — directory does not exist.
- N/A README.md / docs/quickstart.md — not present in repo.

Deferred TODOs: none.
-->

# Darts Constitution

## Core Principles

### I. Module-First Game Architecture

Every game (e.g. 501, Cricket, Around the Clock, future variants) MUST be
implemented as a self-contained module with a stable, declared interface for
the host shell. A game module MUST own its rules, state shape, scoring logic,
and game-specific UI; it MUST NOT reach into the internals of other modules
or of the shell. The shell discovers modules through a single registration
point (e.g. a manifest or registry export) and treats each as a black box
behind its public contract.

**Non‑negotiable rules:**

- A new game MUST be addable by creating one new module directory plus one
  registry entry — no edits to other game modules MUST be required.
- Cross-module imports between game modules are FORBIDDEN. Shared logic MUST
  live in a clearly named shared layer (e.g. `src/shared/` or `src/core/`).
- Each module MUST define its persisted state schema and a version field so
  storage migrations stay local to the module.

**Rationale:** The whole project exists to make adding new games easy.
Anything that lets a game leak into the shell or another game directly
breaks that promise and is therefore a violation, not a shortcut.

### II. Frontend-Only, Static-Deployable

The application MUST run as a pure client-side React app, deployable as
static assets to GitHub Pages with no server, no API calls to a backend
owned by this project, and no build step that assumes server-side rendering.

**Non‑negotiable rules:**

- No code paths MUST require a backend service belonging to this project.
- The production build MUST work when served from a non-root path (GitHub
  Pages project sites serve under `/<repo>/`). Routing and asset URLs MUST
  respect a configurable base path.
- The app MUST function fully offline after first load (subject to
  browser cache policies). No feature MAY hard-fail without network.

**Rationale:** Constrains scope, keeps deployment trivial, and removes a
whole class of architectural decisions (auth, hosting, secrets) that this
project does not need.

### III. Responsive, Mobile-First UI

The UI MUST be designed mobile-first and MUST remain usable on every screen
size from a small phone (≥320 CSS px wide) up to desktop, including foldable
devices in both folded and unfolded postures.

**Non‑negotiable rules:**

- Layouts MUST use fluid/responsive techniques (flex, grid, container
  queries, relative units). Fixed pixel widths that break below 360px or
  above 1200px are FORBIDDEN.
- All primary interactions MUST be reachable via touch with a minimum
  touch target of 44×44 CSS px.
- The app MUST be tested at minimum on: small phone (~360px), large phone
  (~430px), foldable inner display (~700–850px), and desktop (≥1200px),
  before any release-tagged change.
- No feature may rely on hover-only interaction; every hover affordance
  MUST have a touch-equivalent path.

**Rationale:** The owner uses a foldable device; "works on my phone" is
not enough. Treating responsiveness as a first-class constraint prevents
retrofits later.

### IV. Local-First Persistence

User data (game state, history, settings, player profiles) MUST be persisted
exclusively to browser storage on the user's device — primarily
`localStorage`, with `IndexedDB` permitted only when payload size or
structure justifies it.

**Non‑negotiable rules:**

- Persistence access MUST go through a single storage abstraction layer.
  Direct `localStorage.*` calls outside that layer are FORBIDDEN.
- Every persisted record MUST carry a schema version. Each module MUST
  provide forward migrations for its own data.
- The app MUST tolerate corrupted, missing, or quota-exceeded storage
  without crashing: degrade gracefully and surface a clear user message.
- No PII or secret MAY be transmitted off-device. There is no telemetry
  endpoint by default.

**Rationale:** Local-first means the user owns their data, the app works
offline, and there is no privacy/regulatory surface area. Centralizing
storage access is what makes future migrations and a possible future
sync layer feasible without rewriting every module.

### V. Simplicity & Decoupling (YAGNI)

Architecture decisions MUST favor the simplest design that preserves module
decoupling. Abstractions MUST be introduced only when there is a concrete,
present need (typically: a second concrete consumer exists, or a clear
module boundary is being violated without one).

**Non‑negotiable rules:**

- No state-management or DI framework MAY be introduced before two
  independent modules demonstrably need to share state through it.
- Speculative extension points ("we might want to swap X later") are
  FORBIDDEN unless they are required to satisfy Principle I.
- Dependencies MUST be justified: each new runtime npm dependency requires
  a one-line note in the PR explaining why a small in-repo solution is
  insufficient.
- Dead code, unused exports, and disabled feature flags MUST be removed,
  not commented out.

**Rationale:** Decoupling is the goal; complexity is the enemy of
decoupling. Premature abstractions create coupling to the abstraction
itself, which is exactly what Principle I is trying to prevent.

## Technology & Platform Constraints

- **Language/Framework:** React (functional components + hooks). TypeScript
  is RECOMMENDED; if adopted it MUST be adopted project-wide, not per-file.
- **Build/Tooling:** A static-build toolchain compatible with GitHub Pages
  (e.g. Vite). The build MUST emit a fully static `dist/` directory with
  correct relative or base-path-aware asset URLs.
- **Storage:** `localStorage` by default; `IndexedDB` allowed for binary
  or large structured data, accessed only via the storage abstraction.
- **Routing:** Client-side routing MUST use hash-based routes or a router
  configured for GitHub Pages base paths so deep links survive refresh.
- **Browser support:** Latest two major versions of Chrome, Safari, Firefox,
  and Edge, including mobile variants. Foldable postures on Chrome/Android
  MUST be verified.
- **No backend services** owned by this project. Third-party static CDNs
  for assets are permitted; third-party APIs requiring secrets are
  FORBIDDEN (no key can be kept secret in a static client).

## Development Workflow & Quality Gates

- **Module boundary review:** Every PR that adds or modifies a game module
  MUST be reviewed against Principle I. A reviewer MUST confirm no
  cross-module imports were introduced.
- **Responsive review:** PRs touching UI MUST include verification (note
  or screenshot) that the change was checked at the four required
  breakpoints (Principle III).
- **Storage review:** PRs that touch persisted data MUST update the
  affected module's schema version and migration path (Principle IV).
- **Deployability gate:** The production build MUST succeed and the
  resulting static bundle MUST load correctly under a non-root base path
  before any change is merged to the deploy branch.
- **Simplicity gate:** New abstractions, new dependencies, and new shared
  layers MUST be justified in the PR description against Principle V.

## Governance

This constitution supersedes ad-hoc conventions and informal preferences.
Where this document and code disagree, this document wins and the code
MUST be updated.

**Amendment procedure:**

1. Open a PR that edits `.specify/memory/constitution.md` and the Sync
   Impact Report at the top of that file.
2. Describe the motivation and the version bump (MAJOR / MINOR / PATCH)
   with reasoning.
3. Update dependent templates (`.specify/templates/*.md`) in the same PR
   when the change affects them; otherwise list them as ⚠ pending in the
   Sync Impact Report.
4. Merge requires the project owner's approval.

**Versioning policy** (semantic):

- **MAJOR:** A principle is removed, redefined incompatibly, or a
  governance rule changes in a way that invalidates prior decisions.
- **MINOR:** A new principle or section is added, or an existing one is
  materially expanded.
- **PATCH:** Wording, clarifications, typo fixes, or non-semantic
  refinements that do not change what is required of contributors.

**Compliance review:** On any release-tagged change, the owner MUST do a
short pass against Principles I–V and confirm no regressions. Violations
that are knowingly accepted MUST be recorded in the corresponding plan's
Complexity Tracking section with justification.

**Version**: 1.0.0 | **Ratified**: 2026-05-06 | **Last Amended**: 2026-05-06
