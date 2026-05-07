import { useEffect } from "react";
import { HashRouter, Route, Routes, useLocation, useNavigate } from "@/shared/routing/router";
import { SessionListPage } from "@/shell/pages/SessionListPage";
import { TeamSetupPage } from "@/shell/pages/TeamSetupPage";
import { GameSelectPage } from "@/shell/pages/GameSelectPage";
import { GameSettingsPage } from "@/shell/pages/GameSettingsPage";
import { PlayPage } from "@/shell/pages/PlayPage";
import { GameEndPage } from "@/shell/pages/GameEndPage";
import { HistoryPage } from "@/shell/pages/HistoryPage";
import { PlayersPage } from "@/shell/players/PlayersPage";
import { useSession } from "@/shell/session/useSession";
import { useSessionContext } from "@/shell/session/SessionContext";

function NavGuard() {
  const { activeSession } = useSessionContext();
  const { state } = useSession();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // No active session — allow session list and players
    if (!activeSession) {
      const globalRoutes = ["/", "/players"];
      if (!globalRoutes.includes(pathname)) {
        navigate("/", { replace: true });
      }
      return;
    }

    // Active session exists — don't allow landing on session list
    if (pathname === "/") {
      navigate("/games", { replace: true });
      return;
    }

    if (state.inProgressGame) {
      const allowed = ["/games", "/play", "/end", "/history", "/players"];
      if (!allowed.includes(pathname) && !pathname.startsWith("/game-settings/") && !pathname.startsWith("/teams/")) {
        navigate("/play", { replace: true });
      }
    } else {
      if (pathname === "/play") {
        navigate("/games", { replace: true });
      }
    }
  }, [activeSession, state.inProgressGame, pathname, navigate]);

  return null;
}

function NotFoundRedirect() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const known = [
    "/",
    "/games",
    "/players",
    "/play",
    "/end",
    "/history",
  ];
  useEffect(() => {
    if (!known.includes(pathname) && !pathname.startsWith("/game-settings/") && !pathname.startsWith("/teams/")) {
      navigate("/", { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);
  return null;
}

export function App() {
  return (
    <HashRouter>
      <NavGuard />
      <NotFoundRedirect />
      <main className="app-shell">
        <Routes>
          <Route path="/" element={<SessionListPage />} />
          <Route path="/games" element={<GameSelectPage />} />
          <Route path="/teams/:gameId" element={<TeamSetupPage />} />
          <Route path="/game-settings/:id" element={<GameSettingsPage />} />
          <Route path="/play" element={<PlayPage />} />
          <Route path="/end" element={<GameEndPage />} />
          <Route path="/players" element={<PlayersPage />} />
          <Route path="/history" element={<HistoryPage />} />
        </Routes>
      </main>
    </HashRouter>
  );
}
