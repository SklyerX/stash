import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { DOWNLOAD_PATH } from "./utils";
import cliProgress from "cli-progress";

export async function downloadContentWithYTDLP(url: string): Promise<string> {
  mkdirSync(DOWNLOAD_PATH, { recursive: true });

  return new Promise((resolve, reject) => {
    const yt = spawn("yt-dlp", ["--newline", url], { cwd: DOWNLOAD_PATH });

    const bar = new cliProgress.SingleBar(
      {
        format: "Progress |{bar}| {percentage}%",
        hideCursor: true,
      },
      cliProgress.Presets.shades_classic,
    );

    bar.start(100, 0, { eta: "N/A" });

    let buffer = "";
    let downloadedFilePath = "";

    yt.stdout.on("data", (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const pathMatch = line.match(/\[download\] Destination: (.+)/);
        if (pathMatch) {
          downloadedFilePath = join(DOWNLOAD_PATH, pathMatch[1]);
        }

        const progressMatch = line.match(
          /\[download\]\s+(\d+(?:\.\d+)?)%.*?ETA\s+([0-9:]+)/,
        );

        if (progressMatch) {
          const percent = parseFloat(progressMatch[1]);
          bar.update(percent);
        }
      }
    });

    yt.stderr.on("data", (data) => {
      console.error(`Error: ${data}`);
    });

    yt.on("close", (code) => {
      bar.stop();
      if (code === 0) {
        resolve(downloadedFilePath);
      } else {
        reject(new Error(`yt-dlp exited with code ${code}`));
      }
    });
  });
}
