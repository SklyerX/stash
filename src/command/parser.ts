export class CommandError extends Error {
  delayBeforeClear: number;

  constructor(message: string, delayBeforeClear = 700) {
    super(message);
    this.name = "CommandError";
    this.delayBeforeClear = delayBeforeClear;
  }
}

type CommandName =
  | "NEWC"
  | "DELC"
  | "SAVE"
  | "DEL"
  | "OPEN"
  | "OPENL"
  | "LS"
  | "LSC"
  | "WIPE"
  | "IMPORT"
  | "EXPORT"
  | "FLUSHALL"
  | "SEARCH";

type ParsedCommand =
  | { command: "NEWC"; collection: string }
  | { command: "DELC"; collection: string }
  | {
      command: "SAVE";
      collection: string;
      alias?: string;
      tags?: string[];
      operations?: string[];
      url: string;
    }
  | {
      command: "DEL";
      collection: string;
      target: { type: "name" | "index"; value: string };
    }
  | {
      command: "OPEN" | "OPENL";
      collection: string;
      target: { type: "name" | "index"; value: string };
    }
  | { command: "LS"; collection: string }
  | { command: "LSC" }
  | { command: "WIPE" }
  | { command: "IMPORT"; path: string }
  | { command: "EXPORT" }
  | { command: "FLUSHALL" }
  | { command: "SEARCH"; query: string };

const PATTERNS: Record<CommandName, RegExp> = {
  NEWC: /^NEWC\s+(\S+)$/,
  DELC: /^DELC\s+(\S+)$/,
  SAVE: /^SAVE\s+(\S+)(?:\s+(\S+))?(?:\s+([^#\s][^#]*?))?(?:\s+((?:#\w+\s*)+))?\s+(\S+)$/,
  DEL: /^DEL\s+(\S+)\s+(#\S+|%\d+)$/,
  OPEN: /^OPEN\s+(\S+)\s+(#\S+|%\d+)$/,
  OPENL: /^OPENL\s+(\S+)\s+(#\S+|%\d+)$/,
  LS: /^LS\s+(\S+)$/,
  LSC: /^LSC$/,
  WIPE: /^WIPE$/,
  IMPORT: /^IMPORT\s+(.+)$/,
  EXPORT: /^EXPORT$/,
  FLUSHALL: /^FLUSHALL$/,
  SEARCH: /^SEARCH\s+"([^"]+)"$/,
};

function parseTarget(raw: string): { type: "name" | "index"; value: string } {
  if (raw.startsWith("#")) return { type: "name", value: raw.slice(1) };
  if (raw.startsWith("%")) return { type: "index", value: raw.slice(1) };
  throw new CommandError(`Invalid target format: ${raw}`);
}

export function parseCommand(input: string): ParsedCommand {
  const trimmed = input.trim();
  const cmd = trimmed.split(/\s+/)[0] as CommandName;

  if (!PATTERNS[cmd]) throw new CommandError(`Unknown command: ${cmd}`);

  switch (cmd) {
    case "NEWC":
    case "DELC": {
      const m = trimmed.match(PATTERNS[cmd]);
      if (!m) throw new CommandError(`Invalid ${cmd} syntax`);
      return { command: cmd, collection: m[1] };
    }

    case "SAVE": {
      const body = trimmed.slice(5).trim();

      let alias: string | undefined;
      let remaining = body;

      const aliasMatch = body.match(/^(\S+)\s+"([^"]+)"\s+(.*)/);
      if (aliasMatch) {
        remaining = `${aliasMatch[1]} ${aliasMatch[3]}`;
        alias = aliasMatch[2];
      }

      const parts = remaining.split(/\s+/);
      if (parts.length < 2)
        throw new CommandError("SAVE requires at least collection and url");

      const [collection, ...rest] = parts;
      const url = rest.pop()!;

      let tags: string[] | undefined;
      let operations: string[] | undefined;

      for (const token of rest) {
        if (token.startsWith("#")) {
          (operations ??= []).push(token);
        } else if (token.includes(",") || tags) {
          (tags ??= []).push(...token.split(",").filter(Boolean));
        } else {
          (tags ??= []).push(token);
        }
      }

      return {
        command: "SAVE",
        collection,
        ...(alias && { alias }),
        ...(tags && { tags }),
        ...(operations && { operations }),
        url,
      };
    }

    case "DEL":
    case "OPEN":
    case "OPENL": {
      const m = trimmed.match(PATTERNS[cmd]);
      if (!m) throw new CommandError(`Invalid ${cmd} syntax`);
      return { command: cmd, collection: m[1], target: parseTarget(m[2]) };
    }

    case "LS": {
      const m = trimmed.match(PATTERNS[cmd]);
      if (!m) throw new CommandError("Invalid LS syntax");
      return { command: "LS", collection: m[1] };
    }

    case "IMPORT": {
      const m = trimmed.match(PATTERNS[cmd]);
      if (!m) throw new CommandError("IMPORT requires a file path");
      return { command: "IMPORT", path: m[1].trim() };
    }

    case "SEARCH": {
      const m = trimmed.match(PATTERNS[cmd]);
      if (!m) throw new CommandError(`SEARCH requires a quoted query: SEARCH "term"`);
      return { command: "SEARCH", query: m[1] };
    }

    case "LSC":
    case "WIPE":
    case "EXPORT":
    case "FLUSHALL":
      if (!trimmed.match(PATTERNS[cmd]))
        throw new CommandError(`${cmd} takes no arguments`);
      return { command: cmd };
  }
}
