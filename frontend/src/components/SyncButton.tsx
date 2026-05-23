import { useRef, useState } from "react";
import { streamSync, type SyncEvent } from "../api";

type Status =
  | { kind: "idle" }
  | { kind: "running"; text: string }
  | { kind: "done"; text: string }
  | { kind: "error"; text: string };

/** Triggers a receipt sync and shows live progress streamed from the server.
 * Calls onSynced() when a sync finishes so the app can refresh its data. */
export function SyncButton({ onSynced }: { onSynced: () => void }) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const clearTimer = useRef<number | undefined>(undefined);

  const running = status.kind === "running";

  const handle = (e: SyncEvent) => {
    switch (e.type) {
      case "progress": {
        const pct = e.total > 0 ? ` · ${Math.min(100, Math.round(((e.fetched + e.skipped) / e.total) * 100))}%` : "";
        setStatus({
          kind: "running",
          text: `${e.fetched} new · ${e.skipped} checked${pct}`,
        });
        break;
      }
      case "done": {
        setStatus({
          kind: "done",
          text: e.fetched > 0 ? `✓ ${e.fetched} new receipt${e.fetched === 1 ? "" : "s"}` : "✓ up to date",
        });
        onSynced();
        break;
      }
      case "error":
        setStatus({ kind: "error", text: e.message });
        break;
      // "note" warnings are not surfaced in the button to keep it compact.
    }
  };

  const start = async () => {
    if (running) return;
    window.clearTimeout(clearTimer.current);
    setStatus({ kind: "running", text: "starting…" });
    try {
      await streamSync(handle);
    } catch (err) {
      setStatus({ kind: "error", text: String((err as Error).message ?? err) });
    }
    // Fade the result back to idle after a few seconds.
    clearTimer.current = window.setTimeout(() => setStatus({ kind: "idle" }), 6000);
  };

  return (
    <div className="sync">
      <button
        className="sync-btn"
        onClick={start}
        disabled={running}
        title="Download new receipts from Lidl Plus"
      >
        <span className={running ? "spin" : ""} aria-hidden="true">
          ⟳
        </span>
        {running ? "Syncing…" : "Sync"}
      </button>
      {status.kind !== "idle" && (
        <span className={`sync-status sync-${status.kind}`}>{status.text}</span>
      )}
    </div>
  );
}
