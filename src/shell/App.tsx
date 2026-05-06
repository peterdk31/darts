import { useEffect } from "react";
import { HashRouter, Route, Routes, useLocation, useNavigate } from "@/shared/routing/router";
import { TeamSetupPage } from "@/shell/pages/TeamSetupPage";
import { GameSelectPage } from "@/shell/pages/GameSelectPage";
import { GameSettingsPage } from "@/shell/pages/GameSettingsPage";
import { PlayPage } from "@/shell/pages/PlayPage";
import { GameEndPage } from "@/shell/pages/GameEndPage";
import { HistoryPage } from "@/shell/pages/HistoryPage";
import { useSession } from "@/shell/session/useSession";

function NavGuard() {
  const { state } = useSession();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // If an in-progress game exists and the user lands on the empty / teams /
    // game-select route, take them to /play. History route is always allowed.
    if (state.inProgressGame) {
      const allowed = ["/play", "/end", "/history"];
      if (!allowed.includes(pathname) && !pathname.startsWith("/game-settings/")) {
        navigate("/play", { replace: true });
      }
    } else {
      // No in-progress game; /play should redirect to game-select.
      if (pathname === "/play") {
        navigate("/game-select", { replace: true });
      }
    }
  }, [state.inProgressGame, pathname, navigate]);

  return null;
}

function NotFoundRedirect() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const known = [
    "/",
    "/teams",
    "/game-select",
    "/play",
    "/end",
    "/history",
  ];
  useEffect(() => {
    if (!known.includes(pathname) && !pathname.startsWith("/game-settings/")) {
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
          <Route path="/" element={<TeamSetupPage />} />
          <Route path="/teams" element={<TeamSetupPage />} />
          <Route path="/game-select" element={<GameSelectPage />} />
          <Route path="/game-settings/:id" element={<GameSettingsPage />} />
          <Route path="/play" element={<PlayPage />} />
          <Route path="/end" element={<GameEndPage />} />
          <Route path="/history" element={<HistoryPage />} />
        </Routes>
      </main>
    </HashRouter>
  );
}
