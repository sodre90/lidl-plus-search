// Authenticated client for the Lidl Plus receipts API, ported from
// internal/lidl/client.go. Keeps the same endpoints and header quirks.

import type { TicketSummary } from "./types";

const TICKETS_HOST = "https://tickets.lidlplus.com/api";

/**
 * Supplies a valid access token. Implemented by the auth layer, which refreshes
 * via the refresh token and persists the rotated tokens.
 */
export interface TokenProvider {
  /** Return a valid access token; if `forceRefresh`, refresh before returning. */
  getAccessToken(forceRefresh?: boolean): Promise<string>;
}

interface TicketListResponse {
  tickets: TicketSummary[];
  size: number;
  page: number;
  totalCount: number;
}

export class LidlClient {
  constructor(
    private readonly tokens: TokenProvider,
    private readonly country: string,
  ) {}

  /** Authenticated GET. On 401 it refreshes once and retries. */
  private async get(url: string): Promise<string> {
    let { body, status } = await this.doGet(url, false);
    if (status === 401) {
      ({ body, status } = await this.doGet(url, true));
    }
    if (status !== 200) {
      throw new Error(`API error (${status}): ${body.trim()}`);
    }
    return body;
  }

  private async doGet(url: string, forceRefresh: boolean): Promise<{ body: string; status: number }> {
    const token = await this.tokens.getAccessToken(forceRefresh);
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        // App-Version "999.99.9" crashes the tickets backend (HTTP/2
        // INTERNAL_ERROR); use a normal version. Accept-Language must be a
        // 2-char code (the country code), or the v3 detail endpoint returns 400.
        "App-Version": "14.21.2",
        "Operating-System": "iOS",
        App: "com.lidl.eci.lidl.plus",
        "Accept-Language": this.country,
        Accept: "application/json",
      },
    });
    const body = await res.text();
    return { body, status: res.status };
  }

  /**
   * Fetch one page of receipt summaries (1-indexed). Also returns the total
   * number of receipts in the account (for progress display).
   */
  async listTicketsPage(page: number): Promise<{ tickets: TicketSummary[]; total: number }> {
    const url = `${TICKETS_HOST}/v2/${this.country}/tickets?pageNumber=${page}&onlyFavorite=false`;
    const body = await this.get(url);
    let resp: TicketListResponse;
    try {
      resp = JSON.parse(body) as TicketListResponse;
    } catch (e) {
      throw new Error(`failed to parse receipt list: ${String(e)}`);
    }
    return { tickets: resp.tickets ?? [], total: resp.totalCount ?? 0 };
  }

  /**
   * Fetch a receipt's full (raw JSON) detail as a string. For HU the line items
   * live inside the htmlPrintedReceipt field (see htmlReceipt.ts).
   */
  ticketDetail(id: string): Promise<string> {
    return this.get(`${TICKETS_HOST}/v3/${this.country}/tickets/${id}`);
  }
}
