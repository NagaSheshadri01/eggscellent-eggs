import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Reset any previously-set dark theme preference now that dark mode is removed.
try {
  localStorage.removeItem("theme");
  document.documentElement.classList.remove("dark");
} catch {}

createRoot(document.getElementById("root")!).render(<App />);
