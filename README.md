# Stash

A terminal-based link manager with an encrypted database. Save URLs into organized collections, tag them, give them aliases, download them locally — all from a simple command prompt.

Your data lives in `~/.stash/stash.db`, encrypted with SQLCipher behind a password you set on first run. Nothing leaves your machine.

---

<!-- Screenshot: drop an image here -->
![Stash terminal screenshot](./screenshots/quick-demo.gif)

---

## Features

- **Encrypted at rest** — SQLCipher-backed SQLite with a password you control
- **Collections** — group links into named buckets (youtube-dev, articles, gym, whatever)
- **Aliases & tags** — give links human names and searchable labels
- **Local downloads** — pull media directly via `yt-dlp` with a progress bar
- **Full-text search** — query across URLs, aliases, and tags in one shot
- **Import / Export** — portable JSON format to back up or migrate your data
- **Pagination** — browse large collections page by page without the noise

---

## Installation

```bash
npm install -g @sklyerx/stash
```

Then just run:

```bash
stash
```

---

## Requirements

- [Node.js](https://nodejs.org) or [Bun](https://bun.sh)
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) — only needed if you use `#download`

---

## Getting Started

```bash
# Install dependencies
pnpm install

# Run
npx tsx src/index.ts
```

On first launch you'll be asked to set a password. Don't lose it — the database is unreadable without it.

---

## Commands

### Collections

| Command | Description |
|---|---|
| `NEWC <collection>` | Create a new collection |
| `DELC <collection>` | Delete a collection and everything in it |
| `LSC` | List all collections |
| `LS <collection>` | List all links inside a collection |

### Links

| Command | Description |
|---|---|
| `SAVE <collection> [alias] [tags] [#ops] <url>` | Save a URL |
| `DEL <collection> <#alias \| %index>` | Delete a link by alias or index |
| `OPEN <collection> <#alias \| %index>` | Open a link in the browser |
| `OPENL <collection> <#alias \| %index>` | Open a locally downloaded file |
| `SEARCH "<query>"` | Search across all links by URL, alias, or tags |

### Data

| Command | Description |
|---|---|
| `EXPORT` | Export all data to a JSON file on the Desktop |
| `IMPORT <path>` | Import a previously exported JSON file |
| `FLUSHALL` | Delete all collections and links (keeps the database) |
| `WIPE` | Nuke everything and start fresh |

### Other

| Command | Description |
|---|---|
| `HELP` | Show the full command reference |
| `CLEAR` | Clear the screen |
| `EXIT` / `BYE` | Close Stash |

---

## SAVE Syntax

```
SAVE <collection> ["alias"] [tag,tag,...] [#operation] <url>
```

- **Alias** — must be wrapped in double quotes
- **Tags** — comma-separated words, no spaces
- **Operations** — `#download` pulls the media locally via yt-dlp

**Examples:**

```
SAVE articles https://example.com/post

SAVE articles "Interesting Post" https://example.com/post

SAVE articles "Interesting Post" programming,tools https://example.com/post

SAVE videos "Cool video" #download https://www.youtube.com/watch?v=dQw4w9WgXcQ
```

---

## Targeting Links

When commands need a specific link, you can refer to it by **alias** or **index**:

```
# By alias (prefix with #)
OPEN articles #Interesting-Post

# By row index (prefix with %)
OPEN articles %3
```

---

## Search

Search runs a `LIKE` match across URL, alias, and tags — across every collection at once:

```
SEARCH "minecraft"
SEARCH "gym"
SEARCH "programming"
```

Results show the collection name, alias, URL, and tags in a table.

---

## Data & Privacy

- Database: `~/.stash/stash.db`
- Downloads: `~/.stash/downloads/`
- Exports land on your Desktop as `output-<timestamp>.json`

Everything is local. There's no sync, no account, no telemetry.

---

## License

MIT
