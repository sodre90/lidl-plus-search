import type { ReceiptRow } from "../api";
import { money, shortDate } from "../utils";

interface Props {
  receipts: ReceiptRow[] | null;
  onOpen: (id: string) => void;
}

export function ReceiptsTable({ receipts, onOpen }: Props) {
  if (receipts === null) return <div className="empty">Loading…</div>;
  if (receipts.length === 0)
    return (
      <div className="empty">
        No receipts yet. Run <code>lidlsearch sync</code> to download them.
      </div>
    );

  return (
    <div className="result-area">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th className="num">Total</th>
            <th className="num">Items</th>
            <th>Receipt</th>
          </tr>
        </thead>
        <tbody>
          {receipts.map((r) => (
            <tr
              key={r.id}
              className="clickable"
              onClick={() => onOpen(r.id)}
              title="Show this receipt"
            >
              <td className="muted">{shortDate(r.date)}</td>
              <td className="num">{money(r.totalAmount, r.currency)}</td>
              <td className="num">{r.itemCount}</td>
              <td>
                <span className="chip">{r.id.slice(0, 8)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
