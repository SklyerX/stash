import Table from "cli-table3";
import chalk from "chalk";

const BOX_CHARS = {
  top: "─",
  "top-mid": "┬",
  "top-left": "┌",
  "top-right": "┐",
  bottom: "─",
  "bottom-mid": "┴",
  "bottom-left": "└",
  "bottom-right": "┘",
  left: "│",
  "left-mid": "├",
  mid: "─",
  "mid-mid": "┼",
  right: "│",
  "right-mid": "┤",
  middle: "│",
};

const COMMANDS = [
  {
    command: "NEWC <collection>",
    description: "Create a new collection",
    example: "NEWC movies",
  },
  {
    command: "DELC <collection>",
    description: "Delete a collection and all its saved links",
    example: "DELC movies",
  },
  {
    command: "LSC",
    description: "List all collections",
    example: "LSC",
  },
  {
    command: "LS <collection>",
    description: "List all saved links inside a collection",
    example: "LS movies",
  },
  {
    command: 'SAVE <collection> ["alias"] [tag,...] [#op,...] <url>',
    description:
      "Save a URL into a collection. Alias must be quoted. Tags are comma-separated words. Operations are #-prefixed tokens.",
    example:
      'SAVE movies "Inception" sci-fi,drama #download https://example.com',
  },
  {
    command: "DEL <collection> <#name|%index>",
    description:
      "Delete a saved link by alias name (#name) or row index (%index)",
    example: "DEL movies #Inception  /  DEL movies %3",
  },
  {
    command: "OPEN <collection> <#name|%index>",
    description: "Open a saved link in the default browser",
    example: "OPEN movies #Inception",
  },
  {
    command: "OPENL <collection> <#name|%index>",
    description: "Open the locally downloaded file for a saved link",
    example: "OPENL movies %2",
  },
  {
    command: "FLUSHALL",
    description: "Delete all collections and links (keeps the database file)",
    example: "FLUSHALL",
  },
  {
    command: "WIPE",
    description:
      "Wipe all data and reset to a fresh account (deletes database)",
    example: "WIPE",
  },
  {
    command: 'SEARCH "<query>"',
    description: "Search across all saved links by URL, alias, or tags",
    example: 'SEARCH "minecraft"',
  },
  {
    command: "IMPORT",
    description: "Import all your data back into Stash",
    example: "IMPORT <path>",
  },
  {
    command: "EXPORT",
    description: "Export all your code to a .json file",
    example: "EXPORT",
  },
  {
    command: "CLEAR",
    description: "Clear the terminal screen",
    example: "CLEAR",
  },
  {
    command: "HELP",
    description: "Show this help table",
    example: "HELP",
  },
  {
    command: "EXIT  /  BYE",
    description: "Close the database and exit",
    example: "EXIT",
  },
];

function wrap(text: string, width: number): string {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length <= width) {
      line = next;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.join("\n");
}

const CMD_W = 54;
const DESC_W = 44;
const EX_W = 52;

export function printHelpTable() {
  const table = new Table({
    head: [
      chalk.cyanBright("Command"),
      chalk.cyanBright("Description"),
      chalk.cyanBright("Example"),
    ],
    style: { border: ["gray"], head: [] },
    colWidths: [CMD_W + 2, DESC_W + 2, EX_W + 2],
    chars: BOX_CHARS,
  });

  for (const row of COMMANDS) {
    table.push([
      chalk.yellowBright(wrap(row.command, CMD_W)),
      chalk.white(wrap(row.description, DESC_W)),
      chalk.gray(wrap(row.example, EX_W)),
    ]);
  }

  console.log(table.toString());
}

type Collection = {
  id: number;
  name: string;
  created_at: number;
};

type Save = {
  id: number;
  collection_id: number;
  url: string;
  alias: string | null;
  tags: string | null;
  downloaded_filepath: string | null;
  created_at: number;
};

function formatDate(unixepoch: number): string {
  return new Date(unixepoch * 1000).toLocaleString();
}

export function printCollectionsTable(rows: unknown[]) {
  if (!rows.length) {
    console.log(chalk.yellow("No collections found."));
    return;
  }

  const table = new Table({
    head: [
      chalk.cyanBright("ID"),
      chalk.cyanBright("Name"),
      chalk.cyanBright("Created At"),
    ],
    style: { border: ["gray"], head: [] },
    chars: BOX_CHARS,
  });

  for (const row of rows as Collection[]) {
    table.push([
      row.id,
      chalk.white(row.name),
      chalk.gray(formatDate(row.created_at)),
    ]);
  }

  console.log(table.toString());
}

export function printLinksTable(rows: unknown[]) {
  if (!rows.length) {
    console.log(chalk.yellow("No links found."));
    return;
  }

  const table = new Table({
    head: [
      chalk.cyanBright("ID"),
      chalk.cyanBright("URL"),
      chalk.cyanBright("Alias"),
      chalk.cyanBright("Tags"),
      chalk.cyanBright("Created At"),
    ],
    style: { border: ["gray"], head: [] },
    colWidths: [5, 50, 20, 20, 22],
    wordWrap: true,
    chars: BOX_CHARS,
  });

  for (const row of rows as Save[]) {
    const tags = row.tags
      ? row.tags
          .split(",")
          .map((t) => chalk.magenta(t.trim()))
          .join(", ")
      : chalk.gray("—");

    table.push([
      row.id,
      chalk.blueBright(row.url),
      row.alias ? chalk.white(row.alias) : chalk.gray("—"),
      tags,
      chalk.gray(formatDate(row.created_at)),
    ]);
  }

  console.log(table.toString());
}

type SearchResult = Save & { collection_name: string };

export function printSearchTable(rows: unknown[], query: string) {
  if (!rows.length) {
    console.log(chalk.yellow(`No results for "${query}".`));
    return;
  }

  const table = new Table({
    head: [
      chalk.cyanBright("Collection"),
      chalk.cyanBright("Alias"),
      chalk.cyanBright("URL"),
      chalk.cyanBright("Tags"),
    ],
    style: { border: ["gray"], head: [] },
    colWidths: [20, 22, 48, 20],
    wordWrap: true,
    chars: BOX_CHARS,
  });

  for (const row of rows as SearchResult[]) {
    const tags = row.tags
      ? row.tags
          .split(",")
          .map((t) => chalk.magenta(t.trim()))
          .join(", ")
      : chalk.gray("—");

    table.push([
      chalk.yellowBright(row.collection_name),
      row.alias ? chalk.white(row.alias) : chalk.gray("—"),
      chalk.blueBright(row.url),
      tags,
    ]);
  }

  console.log(chalk.dim(`${(rows as SearchResult[]).length} result(s) for "${query}"`));
  console.log(table.toString());
}
