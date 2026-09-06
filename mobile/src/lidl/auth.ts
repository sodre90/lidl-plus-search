// Lidl Plus OAuth2 (PKCE) login + token handling, ported from internal/auth.
//
// Login mimics the official mobile app: the user signs in via a WebView
// (password + 2FA), and the authorization code captured from the
// `com.lidlplus.app://callback?code=...` redirect is exchanged for tokens.

import * as Crypto from "expo-crypto";

export const AUTH_BASE = "https://accounts.lidl.com";
const CLIENT_ID = "LidlPlusNativeClient";
const CLIENT_SECRET = "secret";
export const REDIRECT_URI = "com.lidlplus.app://callback";
const SCOPE = "openid profile offline_access lpprofile lpapis";

/** The /connect/token endpoint response. */
export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

/** A Proof Key for Code Exchange verifier/challenge pair. */
export interface PKCE {
  verifier: string;
  challenge: string;
}

const B64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Standard base64 of raw bytes (used for the HTTP Basic auth header). */
function base64FromBytes(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    out += B64_CHARS[b0 >> 2];
    out += B64_CHARS[((b0 & 3) << 4) | (b1 >> 4)];
    out += i + 1 < bytes.length ? B64_CHARS[((b1 & 15) << 2) | (b2 >> 6)] : "=";
    out += i + 2 < bytes.length ? B64_CHARS[b2 & 63] : "=";
  }
  return out;
}

/** URL-safe base64 without padding (RFC 4648 §5), matching Go's RawURLEncoding. */
function base64UrlFromBytes(bytes: Uint8Array): string {
  return base64FromBytes(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64ToUrl(b64: string): string {
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function asciiBytes(s: string): Uint8Array {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
}

/** Generate a fresh PKCE pair (S256). */
export async function newPKCE(): Promise<PKCE> {
  const random = await Crypto.getRandomBytesAsync(64);
  const verifier = base64UrlFromBytes(random);
  const digestB64 = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    verifier,
    { encoding: Crypto.CryptoEncoding.BASE64 },
  );
  return { verifier, challenge: base64ToUrl(digestB64) };
}

/** A URL-safe random state string (CSRF protection). */
export async function randomState(): Promise<string> {
  return base64UrlFromBytes(await Crypto.getRandomBytesAsync(16));
}

/** Build the authorize endpoint URL for the browser-based login. */
export function authorizeURL(p: PKCE, country: string, language: string, state: string): string {
  const v = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    scope: SCOPE,
    redirect_uri: REDIRECT_URI,
    code_challenge: p.challenge,
    code_challenge_method: "S256",
    state,
    Country: country,
    language,
  });
  return `${AUTH_BASE}/connect/authorize?${v.toString()}`;
}

async function postToken(form: URLSearchParams): Promise<TokenResponse> {
  const basic = base64FromBytes(asciiBytes(`${CLIENT_ID}:${CLIENT_SECRET}`));
  const res = await fetch(`${AUTH_BASE}/connect/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: form.toString(),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`token endpoint error (${res.status}): ${text.trim()}`);
  }
  return JSON.parse(text) as TokenResponse;
}

/** Exchange the authorization code for access/refresh tokens. */
export function exchangeCode(code: string, verifier: string): Promise<TokenResponse> {
  return postToken(
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
    }),
  );
}

/**
 * Request a new access token using the refresh token. Lidl may rotate the
 * refresh token, so persist the one in the response when it is non-empty.
 */
export function refresh(refreshToken: string): Promise<TokenResponse> {
  return postToken(
    new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
  );
}

/**
 * Pull the authorization code from the callback URL and verify the state.
 * Throws if Lidl returned an error, the code is missing, or state mismatches.
 */
export function extractCode(callbackURL: string, wantState: string): string {
  const qIndex = callbackURL.indexOf("?");
  const query = qIndex >= 0 ? callbackURL.slice(qIndex + 1) : "";
  const q = new URLSearchParams(query);

  const err = q.get("error");
  if (err) {
    throw new Error(`login error: ${err} ${q.get("error_description") ?? ""}`.trim());
  }
  const code = q.get("code");
  if (!code) throw new Error("callback did not contain a code");
  const st = q.get("state");
  if (st && wantState && st !== wantState) {
    throw new Error("state mismatch – possible CSRF, please try again");
  }
  return code;
}

/** True if a navigation URL is the OAuth callback we need to intercept. */
export function isCallbackURL(url: string): boolean {
  return url.startsWith(REDIRECT_URI);
}
