/**
 * Contract: Route Map
 *
 * Documents the hash-based routes after this feature.
 * Implemented in src/shell/App.tsx via HashRouter.
 */

/**
 * Route map after this feature:
 *
 * Existing:
 *   /              → TeamSetupPage (home / team composition)
 *   /teams         → TeamSetupPage (alias)
 *   /game-select   → GameSelectPage
 *   /game-settings/:id → GameSettingsPage
 *   /play          → PlayPage
 *   /end           → GameEndPage
 *   /history       → HistoryPage
 *
 * Added:
 *   /players       → PlayersPage (roster management, per-player stats)
 *
 * NavGuard updates:
 *   - /players is allowed when a game is in progress (read-only roster view)
 */
export type AppRoute =
  | "/"
  | "/teams"
  | "/players"
  | "/game-select"
  | `/game-settings/${string}`
  | "/play"
  | "/end"
  | "/history";
