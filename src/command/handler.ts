import { type Database } from "better-sqlite3-multiple-ciphers";
import { CommandError } from "./parser";
import { downloadContentWithYTDLP } from "../download";
import { nativeSync } from "rimraf";
import open from "open";
import { DESKTOP_PATH, DOWNLOAD_PATH, STASH_DIR } from "../utils";
import { printCollectionsTable, printLinksTable, printSearchTable } from "../tables";
import { prompt } from "..";
import chalk from "chalk";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ExportSchema } from "../validation";
import { ZodError } from "zod";

export class CommandHandler {
  private readonly db: Database;
  private readonly PAGE_SIZE = 50;

  constructor(db: Database) {
    this.db = db;
  }

  flushall() {
    this.db.exec("DELETE FROM collections; DELETE FROM saves;");
    nativeSync(DOWNLOAD_PATH);
  }

  wipe() {
    nativeSync(STASH_DIR);
  }

  makeCollection(name: string) {
    const existing = this.db
      .prepare("SELECT 1 FROM collections WHERE name = ?")
      .get(name);

    if (existing) {
      throw new CommandError(
        "A collection with this name already exists!",
        1000,
      );
    }

    try {
      this.db.prepare("INSERT INTO collections (name) VALUES (?)").run(name);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong";
      console.error("Database error:", message);
      throw err;
    }
  }
  deleteCollection(name: string) {
    const existing = this.db
      .prepare("SELECT id FROM collections WHERE name = ?")
      .get(name) as { id: string };

    if (!existing) {
      throw new CommandError("A collection with this name does not exist!");
    }

    try {
      const rows = this.db
        .prepare(
          "SELECT * from saves WHERE collection_id = ? AND downloaded_filepath IS NOT NULL",
        )
        .all(existing.id) as { downloaded_filepath: string }[];

      console.log(`Deleting ${rows.length} `);

      for (const row of rows) {
        nativeSync(row.downloaded_filepath);
      }

      this.db.prepare("DELETE FROM collections WHERE name = ?").run(name);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong";
      console.error("Database error:", message);
      throw err;
    }
  }

  async showCollections() {
    let offset = 0;
    const total = (
      this.db.prepare("SELECT COUNT(*) as count FROM collections").get() as {
        count: number;
      }
    ).count;

    while (true) {
      const rows = this.db
        .prepare("SELECT * FROM collections LIMIT ? OFFSET ?")
        .all(this.PAGE_SIZE, offset);

      process.stdout.write("\x1b[H\x1b[2J\x1b[3J");
      printCollectionsTable(rows);

      const page = Math.floor(offset / this.PAGE_SIZE) + 1;
      const totalPages = Math.max(1, Math.ceil(total / this.PAGE_SIZE));
      console.log(
        chalk.dim(`Page ${page}/${totalPages} — N next  P prev  Q quit`),
      );

      const input = (await prompt("")).trim().toUpperCase();
      if (input === "N" && offset + this.PAGE_SIZE < total)
        offset += this.PAGE_SIZE;
      else if (input === "P" && offset > 0) offset -= this.PAGE_SIZE;
      else if (input === "Q" || input === "") return;
    }
  }

  async showCollectionsLinks(collection_name: string) {
    const existing = this.db
      .prepare("SELECT id FROM collections WHERE name = ?")
      .get(collection_name) as { id: string } | undefined;

    if (!existing)
      throw new CommandError(
        "A collection with this name does not exist!",
        1000,
      );

    let offset = 0;
    const total = (
      this.db
        .prepare("SELECT COUNT(*) as count FROM saves WHERE collection_id = ?")
        .get(existing.id) as { count: number }
    ).count;

    while (true) {
      const rows = this.db
        .prepare("SELECT * FROM saves WHERE collection_id = ? LIMIT ? OFFSET ?")
        .all(existing.id, this.PAGE_SIZE, offset);

      process.stdout.write("\x1b[H\x1b[2J\x1b[3J");
      printLinksTable(rows);

      const page = Math.floor(offset / this.PAGE_SIZE) + 1;
      const totalPages = Math.max(1, Math.ceil(total / this.PAGE_SIZE));
      console.log(
        chalk.dim(`Page ${page}/${totalPages} — N next  P prev  Q quit`),
      );

      const input = (await prompt("")).trim().toUpperCase();
      if (input === "N" && offset + this.PAGE_SIZE < total)
        offset += this.PAGE_SIZE;
      else if (input === "P" && offset > 0) offset -= this.PAGE_SIZE;
      else if (input === "Q" || input === "") return;
    }
  }
  async save(input: {
    collection: string;
    alias?: string;
    tags?: string[];
    operations?: string[];
    url: string;
  }) {
    const existing = this.db
      .prepare("SELECT id FROM collections WHERE name = ?")
      .get(input.collection);

    if (!existing) {
      throw new CommandError(
        "A collection with this name does not exist!",
        1000,
      );
    }

    const collectionId = (existing as { id: number }).id;

    if (input.alias) {
      const alreadyExistingAlias = this.db
        .prepare("SELECT * FROM saves WHERE collection_id = ? AND alias = ?")
        .get([collectionId, input.alias]);

      if (alreadyExistingAlias) {
        throw new CommandError("A save with this alias already exists!", 1000);
      }
    }

    let dl_path;

    if (input.operations?.includes("#download")) {
      dl_path = await downloadContentWithYTDLP(input.url);
    }

    this.db
      .prepare(
        "INSERT INTO saves (collection_id, url, alias, tags, downloaded_filepath) VALUES (?, ?, ?, ?, ?)",
      )
      .run(
        collectionId,
        input.url,
        input.alias ?? null,
        input.tags?.join(",") ?? null,
        dl_path ?? null,
      );
  }

  open(
    input: {
      collection: string;
      target: { type: "index" | "name"; value: string };
    },
    isLocal = false,
  ) {
    const existing = this.db
      .prepare("SELECT id FROM collections WHERE name = ?")
      .get(input.collection) as { id: string };

    if (!existing) {
      throw new CommandError(
        "A collection with this name does not exist!",
        1000,
      );
    }

    const isIndex = input.target.type === "index";

    const info = this.db
      .prepare(
        `SELECT url, downloaded_filepath, alias FROM saves WHERE collection_id = ? AND ${isIndex ? "id" : "alias"} = ?`,
      )
      .get([existing.id, input.target.value]) as {
      url: string;
      downloaded_filepath: string;
    };

    if (!info) {
      throw new CommandError(
        `A save with this ${isIndex ? "index" : "alias"} does not exist`,
        1000,
      );
    }

    if (isLocal && !info.downloaded_filepath) {
      throw new CommandError("This URL was not saved locally!", 1000);
    }

    open(isLocal ? info.downloaded_filepath : info.url);
  }

  deleteLink(input: {
    collection: string;
    target: { type: "index" | "name"; value: string };
  }) {
    const existing = this.db
      .prepare("SELECT id FROM collections WHERE name = ?")
      .get(input.collection) as { id: string };

    if (!existing) {
      throw new CommandError(
        "A collection with this name does not exist!",
        1000,
      );
    }

    const isIndex = input.target.type === "index";

    const info = this.db
      .prepare(
        `SELECT downloaded_filepath, id, alias FROM saves WHERE collection_id = ? AND ${isIndex ? "id" : "alias"} = ?`,
      )
      .get([existing.id, input.target.value]) as {
      downloaded_filepath: string;
    };

    if (!info) {
      throw new CommandError(
        `A save with this ${isIndex ? "index" : "alias"} does not exist`,
        1000,
      );
    }

    if (info.downloaded_filepath) {
      nativeSync(info.downloaded_filepath);
    }

    this.db
      .prepare(
        `DELETE FROM saves WHERE collection_id = ? AND ${isIndex ? "id" : "alias"} = ?`,
      )
      .run([existing.id, input.target.value]);
  }

  export() {
    const collections = this.db.prepare("SELECT * FROM collections").all() as {
      id: string;
      name: string;
      created_at: number;
    }[];

    const out = new Map();

    for (const collection of collections) {
      const saves = this.db
        .prepare("SELECT * from saves WHERE collection_id = ?")
        .all(collection.id);

      out.set(`${collection.name}:${collection.id}`, {
        created_at: collection.created_at,
        saves,
      });
    }

    const outputName = `output-${Date.now()}.json`;
    const outPath = join(DESKTOP_PATH, outputName);

    writeFileSync(outPath, JSON.stringify(Array.from(out), null, 2), "utf-8");

    console.log(`Export file created at: ${outPath}`);
  }

  search(query: string) {
    const like = `%${query}%`;
    const rows = this.db
      .prepare(
        `SELECT c.name AS collection_name, s.id, s.url, s.alias, s.tags, s.downloaded_filepath, s.created_at
         FROM saves s
         JOIN collections c ON c.id = s.collection_id
         WHERE s.url LIKE ? OR s.alias LIKE ? OR s.tags LIKE ?`,
      )
      .all(like, like, like);

    printSearchTable(rows, query);
  }

  import(path: string) {
    try {
      const raw = readFileSync(path, "utf-8");
      const json = JSON.parse(raw);
      const parsed = ExportSchema.parse(json);

      const insertCollection = this.db.prepare(
        "INSERT OR IGNORE INTO collections (name) VALUES (?)",
      );
      const insertSave = this.db.prepare(
        "INSERT INTO saves (collection_id, url, alias, tags, downloaded_filepath) VALUES (?, ?, ?, ?, NULL)",
      );

      const run = this.db.transaction(() => {
        let collectionsImported = 0;
        let savesImported = 0;

        for (const [key, { saves }] of parsed) {
          const name = key.split(":").slice(0, -1).join(":");

          const result = insertCollection.run(name);
          if (result.changes > 0) collectionsImported++;

          const { id: collectionId } = this.db
            .prepare("SELECT id FROM collections WHERE name = ?")
            .get(name) as { id: number };

          for (const save of saves) {
            insertSave.run(
              collectionId,
              save.url,
              save.alias,
              save.tags ?? null,
            );
            savesImported++;
          }
        }

        return { collectionsImported, savesImported };
      });

      const { collectionsImported, savesImported } = run();
      console.log(
        chalk.green(
          `Imported ${collectionsImported} collection(s) and ${savesImported} link(s)`,
        ),
      );
    } catch (err) {
      if (err instanceof ZodError) {
        console.log(chalk.red("Invalid JSON format"));
        return;
      }
      console.log(chalk.red("Something went wrong while importing the data"), err);
    }
  }
}
