import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

const path = window.location.pathname;
const root = createRoot(document.getElementById("root")!);

// The landing page is the rebuilt UI (Tailwind + Motion). /app and /judge are rebuilt in phase U3.
if (path.startsWith("/judge") || path.startsWith("/app")) {
  void Promise.all([import("./App.js"), import("./Judge.js"), import("./style.css")]).then(([{ App }, { Judge }]) =>
    root.render(<StrictMode>{path.startsWith("/judge") ? <Judge /> : <App />}</StrictMode>),
  );
} else {
  void Promise.all([import("./Landing.js"), import("./theme.css")]).then(([{ Landing }]) =>
    root.render(<StrictMode><Landing /></StrictMode>),
  );
}
