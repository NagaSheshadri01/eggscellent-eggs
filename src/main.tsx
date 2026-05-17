import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Reset any previously-set dark theme preference now that dark mode is removed.
try {
  localStorage.removeItem("theme");
  document.documentElement.classList.remove("dark");
} catch {}

// Prevent accidental scroll-wheel changes on number inputs site-wide
document.addEventListener("wheel", () => {
  const el = document.activeElement as HTMLInputElement | null;
  if (el?.type === "number") el.blur();
}, { passive: true });

createRoot(document.getElementById("root")!).render(<App />);
