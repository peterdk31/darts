import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@/shell/App";
import { SessionProvider } from "@/shell/session/SessionContext";
import "@/styles/global.css";

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("Root element not found");
}

createRoot(rootEl).render(
  <StrictMode>
    <SessionProvider>
      <App />
    </SessionProvider>
  </StrictMode>,
);
