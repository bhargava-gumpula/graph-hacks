import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

const path = window.location.pathname;
const root = createRoot(document.getElementById("root")!);

// /judge was the old button page; the dashboard replaced it.
if (path.startsWith("/judge")) {
  window.location.replace("/app");
} else if (path.startsWith("/app")) {
  void Promise.all([import("./app/Dashboard"), import("./theme.css")]).then(([{ Dashboard }]) =>
    root.render(<StrictMode><Dashboard /></StrictMode>),
  );
} else {
  void Promise.all([import("./Landing.js"), import("./theme.css")]).then(([{ Landing }]) =>
    root.render(<StrictMode><Landing /></StrictMode>),
  );
}
