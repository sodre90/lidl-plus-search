import type { Stats } from "../api";
import { useTheme } from "../hooks";
import { SyncButton } from "./SyncButton";

const THEME_ICON = { auto: "◐", light: "☀", dark: "☾" } as const;

export function Header({ stats, onSynced }: { stats: Stats | null; onSynced: () => void }) {
  const [theme, cycleTheme] = useTheme();
  return (
    <header className="topbar">
      <div className="brand">
        <span className="logo" aria-hidden="true">
          <span className="sq sq-blue" />
          <span className="sq sq-yellow" />
          <span className="sq sq-red" />
        </span>
        <div className="brand-text">
          <h1>lidlsearch</h1>
          <p className="tagline">Search your Lidl Plus receipts</p>
        </div>
      </div>
      <div className="topbar-right">
        {stats && (
          <span className="stats" title="What's in your local database">
            {stats.receipts.toLocaleString()} receipts · {stats.items.toLocaleString()} items
          </span>
        )}
        <SyncButton onSynced={onSynced} />
        <button
          className="icon-btn"
          onClick={cycleTheme}
          title={`Theme: ${theme} (click to change)`}
          aria-label="Toggle theme"
        >
          {THEME_ICON[theme]}
        </button>
      </div>
    </header>
  );
}
