import { homedir } from "os";
import { join } from "path";

export const STASH_DIR = join(homedir(), ".stash");
export const DB_PATH = join(STASH_DIR, "stash.db");
export const DOWNLOAD_PATH = join(STASH_DIR, "downloads");
export const DESKTOP_PATH = join(homedir(), "desktop");
