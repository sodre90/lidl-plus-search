// Opens the on-device SQLite database and applies the schema. A single shared
// connection is reused across the app.

import * as SQLite from "expo-sqlite";
import { SCHEMA } from "./schema";

const DB_NAME = "lidl.db";

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/** Open (once) and return the shared database connection. */
export function getDB(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      await db.execAsync("PRAGMA foreign_keys = ON;");
      await db.execAsync(SCHEMA);
      return db;
    })();
  }
  return dbPromise;
}
