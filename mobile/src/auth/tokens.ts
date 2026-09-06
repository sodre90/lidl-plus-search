// Secure token storage + an access-token provider that refreshes on demand.
//
// Only the (small) refresh token is persisted in the device keychain/keystore;
// the access token lives in memory and is refreshed from the refresh token when
// it is missing or about to expire. Lidl rotates the refresh token, so the new
// one is persisted whenever the endpoint returns it.

import * as SecureStore from "expo-secure-store";
import { refresh as refreshTokens, type TokenResponse } from "../lidl/auth";
import type { TokenProvider } from "../lidl/client";

const REFRESH_KEY = "lidl_refresh_token";

export async function loadRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_KEY);
}

export async function saveRefreshToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(REFRESH_KEY, token);
}

export async function clearRefreshToken(): Promise<void> {
  await SecureStore.deleteItemAsync(REFRESH_KEY);
}

/** Manages access-token lifetime and refresh-token rotation. */
export class TokenManager implements TokenProvider {
  private accessToken = "";
  private expiresAt = 0; // unix seconds
  private refreshToken: string;
  private refreshing: Promise<string> | null = null;

  private constructor(refreshToken: string) {
    this.refreshToken = refreshToken;
  }

  /** Build from a persisted refresh token, or null if none is stored. */
  static async fromStore(): Promise<TokenManager | null> {
    const rt = await loadRefreshToken();
    return rt ? new TokenManager(rt) : null;
  }

  /** Build from a fresh login response and persist its refresh token. */
  static async fromTokenResponse(tr: TokenResponse): Promise<TokenManager> {
    const tm = new TokenManager(tr.refresh_token);
    tm.accessToken = tr.access_token;
    tm.expiresAt = Math.floor(Date.now() / 1000) + tr.expires_in;
    await saveRefreshToken(tr.refresh_token);
    return tm;
  }

  async getAccessToken(forceRefresh = false): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    if (!forceRefresh && this.accessToken && now < this.expiresAt - 30) {
      return this.accessToken;
    }
    // Coalesce concurrent refreshes into a single request.
    if (!this.refreshing) {
      this.refreshing = this.doRefresh().finally(() => {
        this.refreshing = null;
      });
    }
    return this.refreshing;
  }

  private async doRefresh(): Promise<string> {
    let tr: TokenResponse;
    try {
      tr = await refreshTokens(this.refreshToken);
    } catch (e) {
      throw new Error(`failed to refresh token (sign in again): ${String(e)}`);
    }
    this.accessToken = tr.access_token;
    if (tr.refresh_token) {
      this.refreshToken = tr.refresh_token;
      await saveRefreshToken(this.refreshToken);
    }
    this.expiresAt = Math.floor(Date.now() / 1000) + tr.expires_in;
    return this.accessToken;
  }
}
