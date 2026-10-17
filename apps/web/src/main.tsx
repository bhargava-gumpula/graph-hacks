import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

const path = window.location.pathname;
const root = createRoot(document.getElementById("root")!);

// The landing page is the rebuilt UI (Tailwind + Motion). /app and /judge are rebuilt in phase U3.
if (path.startsWith("/judge")) {
  void Promise.all([import("./Judge.js"), import("./style.css")]).then(([{ Judge }]) =>
    root.render(<StrictMode><Judge /></StrictMode>),
  );
} else if (path.startsWith("/app")) {
  void Promise.all([import("./app/Dashboard"), import("./theme.css")]).then(([{ Dashboard }]) =>
    root.render(<StrictMode><Dashboard /></StrictMode>),
  );
} else {
  void Promise.all([import("./Landing.js"), import("./theme.css")]).then(([{ Landing }]) =>
    root.render(<StrictMode><Landing /></StrictMode>),
  );
}
