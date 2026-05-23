import { useEffect, useState } from "react";

/** Returns a debounced copy of `value` that only updates after `delay` ms of
 * quiet — used to avoid firing a search request on every keystroke. */
export function useDebounced<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export type Theme = "light" | "dark" | "auto";

/** Persists the chosen theme and reflects it on <html data-theme>. */
export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem("theme") as Theme) || "auto",
  );

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "auto") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Cycle auto -> light -> dark -> auto.
  const cycle = () =>
    setTheme((t) => (t === "auto" ? "light" : t === "light" ? "dark" : "auto"));

  return [theme, cycle];
}
