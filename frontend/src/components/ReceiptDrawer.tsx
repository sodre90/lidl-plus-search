import { useEffect, useState } from "react";
import { fetchReceipt, type ReceiptDetail } from "../api";
import { money, num, shortDate } from "../utils";

export function ReceiptDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const [data, setData] = useState<ReceiptDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    setData(null);
    setError(null);
    fetchReceipt(id, ctrl.signal)
      .then(setData)
      .catch((e) => {
        if (e.name !== "AbortError") setError(String(e.message ?? e));
      });
    return () => ctrl.abort();
  }, [id]);

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <aside className="drawer" aria-label="Receipt detail">
        <header className="drawer-head">
          <div>
            <h2>Receipt</h2>
            <p className="drawer-sub">
              {data ? shortDate(data.date) : ""} · <span className="chip">{id.slice(0, 12)}</span>
            </p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>
        <div className="drawer-body">
          {error && <div className="error">⚠ {error}</div>}
          {!data && !error && <div className="empty">Loading…</div>}
          {data && (
            <>
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th className="num">Qty</th>
                    <th className="num">Unit</th>
                    <th className="num">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((it, i) => (
                    <tr key={i}>
                      <td className="item-name">{it.name}</td>
                      <td className="num">{num(it.quantity)}</td>
                      <td className="num">{money(it.unitPrice, it.currency)}</td>
                      <td className="num">{money(it.totalPrice, it.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="drawer-total">
                <span>Total</span>
                <span>{money(data.total, data.currency)}</span>
              </div>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
