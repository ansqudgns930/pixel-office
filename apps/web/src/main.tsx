import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import { SessionProvider } from "./auth/SessionContext.tsx";
import "./styles.css";

const buildVersion =
  (import.meta as ImportMeta & { env?: Record<string, string> }).env
    ?.VITE_BUILD_VERSION || "development";
let buildVersionMeta = document.querySelector<HTMLMetaElement>(
  'meta[name="agent-company-build-version"]',
);
if (!buildVersionMeta) {
  buildVersionMeta = document.createElement("meta");
  buildVersionMeta.name = "agent-company-build-version";
  document.head.append(buildVersionMeta);
}
buildVersionMeta.content = buildVersion;

const container = document.getElementById("root");
if (!container) throw new Error("root element missing");
createRoot(container).render(
  <StrictMode>
    <BrowserRouter>
      <SessionProvider>
        <App />
      </SessionProvider>
    </BrowserRouter>
  </StrictMode>
);
