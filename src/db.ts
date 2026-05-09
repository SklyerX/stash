import Database from "better-sqlite3-multiple-ciphers";
import { mkdirSync } from "node:fs";
import { DB_PATH, STASH_DIR } from "./utils";

export function getDatabase(password: string) {
  mkdirSync(STASH_DIR, { recursive: true });
  const db = new Database(DB_PATH);

  db.pragma("cipher = sqlcipher");
  db.pragma("kdf_iter = 256000");
  db.pragma(`key = '${password}'`);

  try {
    db.exec(`
            CREATE TABLE IF NOT EXISTS collections (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                created_at INTEGER NOT NULL DEFAULT (unixepoch())
            );
    
            CREATE TABLE IF NOT EXISTS saves (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
                url TEXT NOT NULL,
                alias TEXT UNIQUE,
                tags TEXT,
                downloaded_filepath TEXT,
                created_at INTEGER NOT NULL DEFAULT (unixepoch())
            )
        `);
  } catch {
    db.close();
    console.error("Wrong password.");
    process.exit(1);
  }

  return db;
}
