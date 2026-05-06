# Contract: URL Routes

**Feature**: 001-dart-game-tracker
**Audience**: the shell's router and any code that constructs in-app links.
**Authority**: Constitution Principle II (routing MUST work under non-root base path; deep links MUST survive refresh on GitHub Pages).

All routes are **hash-based** (`#/<path>`). The browser path before the `#` is whatever GitHub Pages serves (typically `/<repo>/`); the router only ever inspects `location.hash`.

---

## Route table

| Hash route             | Page                       | Notes |
|------------------------|----------------------------|-------|
| `#/` or empty          | `TeamSetupPage`            | Default landing. If an in-progress game exists, the shell auto-redirects to `#/play` after restoring state (FR-025). |
| `#/teams`              | `TeamSetupPage`            | Explicit alias of `#/`. |
| `#/game-select`        | `GameSelectPage`           | Reachable only after at least 2 valid teams exist (FR-004). Otherwise redirects to `#/teams`. |
| `#/game-settings/:id`  | `GameSettingsPage`         | `:id` is a registered `GameTypeId`. Shows that game's `settingsSchema` populated with defaults; submit starts the match (FR-006a). |
| `#/play`               | `PlayPage`                 | Active only when an in-progress game exists. If none, redirects to `#/game-select`. |
| `#/end`                | `GameEndPage`              | Shown immediately after `gameWon`; lists winner(s) and offers "New Game (keep teams)" / "New Game (new teams)" / "View History" (FR-021, FR-022). |
| `#/history`            | `HistoryPage`              | Renders session history (FR-026). Read-only; offers "Clear history". |

Anything else (unknown route) redirects to `#/`.

---

## Navigation rules

1. **In-progress guard**: If `session.inProgressGameId` is set on app load, the router redirects to `#/play` regardless of the requested route (FR-025), unless the requested route is `#/history` (read-only is always allowed).
2. **New-game-while-in-progress** (FR-022a): Any navigation that would start a new game (e.g., submitting `#/game-settings/:id`) while an in-progress game exists MUST first show a confirmation modal. On confirm, the in-progress game is discarded with no history entry; on cancel, the user is returned to `#/play`.
3. **Win-stops-input** (FR-021): Once `gameWon` has fired for the current match, the router auto-navigates to `#/end` and the dartboard ignores further taps until `#/end` resolves.
4. **Base-path independence**: The router MUST NOT inspect `location.pathname` or `location.origin`. It reads only `location.hash`. This is what makes the app survive being served under `/<repo>/`.

---

## Link construction

In-app links use a single helper:

```ts
// src/shared/routing/href.ts
export function href(path: `/${string}`): string {
  return `#${path}`;  // never includes pathname or origin
}
```

Direct string concatenation of routes elsewhere is forbidden. This guarantees no link accidentally hard-codes the base path.

---

## External / shareable URL behaviour

Because all state of interest is local-only (Constitution Principle IV — no accounts, no sync), there are no shareable deep links to specific game state. The hash routes above are entirely client-navigation labels; sharing a URL only delivers the user to the corresponding screen, where the screen's content depends on local persisted data.

This is consistent with Principle II ("deep links survive refresh") — a refresh on `#/play` while a game is in progress correctly restores the play screen — and with the absence of multi-device sync in v1.
