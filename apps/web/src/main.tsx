import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import { Judge } from "./Judge.js";
import { Landing } from "./Landing.js";
import "./style.css";

const path = window.location.pathname;
const page = path.startsWith("/judge") ? <Judge /> : path.startsWith("/app") ? <App /> : <Landing />;

createRoot(document.getElementById("root")!).render(<StrictMode>{page}</StrictMode>);
