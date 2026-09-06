// App settings stored in the local DB's key/value meta table, with defaults from
// app.config.ts. Country is the 2-char Lidl account code (e.g. "HU"); language
// is the full code sent to the authorize endpoint (e.g. "hu-HU").

import Constants from "expo-constants";
import { getMeta, setMeta } from "./db/queries";

const extra = (Constants.expoConfig?.extra ?? {}) as {
  defaultCountry?: string;
  defaultLanguage?: string;
};

export const DEFAULT_COUNTRY = extra.defaultCountry ?? "HU";
export const DEFAULT_LANGUAGE = extra.defaultLanguage ?? "hu-HU";

export const META_LAST_SYNCED = "last_synced_at";

export async function getCountry(): Promise<string> {
  return (await getMeta("country")) ?? DEFAULT_COUNTRY;
}

export async function getLanguage(): Promise<string> {
  return (await getMeta("language")) ?? DEFAULT_LANGUAGE;
}

export async function setCountry(c: string): Promise<void> {
  await setMeta("country", c.trim());
}

export async function setLanguage(l: string): Promise<void> {
  await setMeta("language", l.trim());
}

export async function getLastSynced(): Promise<string | null> {
  return getMeta(META_LAST_SYNCED);
}

export async function setLastSynced(iso: string): Promise<void> {
  await setMeta(META_LAST_SYNCED, iso);
}
