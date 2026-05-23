import type { Item } from "../api";
import { highlightParts, money, num, shortDate } from "../utils";

interface Props {
  items: Item[];
  query: string;
  loading: boolean;
  onOpen: (id: string) => void;
}

export function ResultsTable({ items, query, loading, onOpen }: Props) {
  if (items.length === 0) {
    return <div className="empty">{loading ? "Searching…" : "No matching items."}</div>;
  }

  return (
    <div className="result-area">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Item</th>
            <th className="num">Qty</th>
            <th className="num">Unit</th>
            <th className="num">Total</th>
            <th>Receipt</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr
              key={`${it.receiptId}-${i}`}
              className="clickable"
              onClick={() => onOpen(it.receiptId)}
              title="Show this receipt"
            >
              <td className="muted">{shortDate(it.date)}</td>
              <td className="item-name">
                {highlightParts(it.name, query).map((p, j) =>
                  p.match ? <mark key={j}>{p.text}</mark> : <span key={j}>{p.text}</span>,
                )}
              </td>
              <td className="num">{num(it.quantity)}</td>
              <td className="num">{money(it.unitPrice, it.currency)}</td>
              <td className="num">{money(it.totalPrice, it.currency)}</td>
              <td>
                <span className="chip">{it.receiptId.slice(0, 8)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
