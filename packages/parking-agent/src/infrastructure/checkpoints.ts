import fs from "node:fs";
import path from "node:path";

/**
 * Checkpoint storage utilities.
 *
 * A checkpoint contains agent state and dataset files.
 * Reports are generated from the live dataset.
 */

const CHECKPOINT_NAME_RE = /^[0-9]+_episodes$/;

export function checkpointName(episodes: number): string {
  return `${episodes}_episodes`;
}

export function isValidCheckpointName(name: string): boolean {
  return CHECKPOINT_NAME_RE.test(name);
}

function copyFileIfExists(src: string, dest: string): boolean {
  if (!fs.existsSync(src)) return false;
  fs.copyFileSync(src, dest);
  return true;
}

export function countCsvRows(file: string): number {
  if (!fs.existsSync(file)) return 0;
  const txt = fs.readFileSync(file, "utf-8").trim();
  if (!txt) return 0;
  return Math.max(0, txt.split("\n").length - 1);
}

export type CheckpointInfo = {
  name: string;
  episodes: number;
  rows: number;
  hasReport: boolean;
  hasZip: boolean;
  updatedAt: string; // ISO
};

/** Export live state as a checkpoint. */
export function exportCheckpoint(
  dataDir: string,
  liveDir: string,
  episodes: number
): { name: string; dir: string } {
  const name = checkpointName(episodes);
  const dest = path.join(dataDir, name);

  if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });

  copyFileIfExists(path.join(liveDir, "agent_state.json"), path.join(dest, "agent_state.json"));
  copyFileIfExists(path.join(liveDir, "dataset.csv"), path.join(dest, "dataset.csv"));

  // Reports are regenerated from live data.

  return { name, dir: dest };
}

/** Load checkpoint files into the live workspace. */
export function loadCheckpointFiles(
  dataDir: string,
  liveDir: string,
  name: string
): { dir: string } {
  if (!isValidCheckpointName(name)) {
    throw new Error(`Neispravno ime checkpointa: '${name}'.`);
  }

  const src = path.join(dataDir, name);

  if (!fs.existsSync(src)) {
    throw new Error(`Checkpoint '${name}' ne postoji.`);
  }

  fs.mkdirSync(liveDir, { recursive: true });

  // Remove stale report.
  const liveReport = path.join(liveDir, "report");
  if (fs.existsSync(liveReport)) {
    fs.rmSync(liveReport, { recursive: true, force: true });
  }

  // Remove stale dataset.
  const liveCsv = path.join(liveDir, "dataset.csv");
  if (fs.existsSync(liveCsv)) fs.rmSync(liveCsv, { force: true });

  const okState = copyFileIfExists(
    path.join(src, "agent_state.json"),
    path.join(liveDir, "agent_state.json")
  );

  copyFileIfExists(path.join(src, "dataset.csv"), liveCsv);

  if (!okState) {
    throw new Error(`Checkpoint '${name}' nema agent_state.json — nije ispravan checkpoint.`);
  }

  return { dir: src };
}

/** List available checkpoints. */
export function listCheckpoints(dataDir: string): CheckpointInfo[] {
  if (!fs.existsSync(dataDir)) return [];

  const out: CheckpointInfo[] = [];

  for (const entry of fs.readdirSync(dataDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || !isValidCheckpointName(entry.name)) continue;

    const dir = path.join(dataDir, entry.name);
    const statePath = path.join(dir, "agent_state.json");

    let episodes = parseInt(entry.name, 10);

    if (fs.existsSync(statePath)) {
      try {
        const st = JSON.parse(fs.readFileSync(statePath, "utf-8"));
        if (typeof st?.stats?.totalEpisodes === "number") {
          episodes = st.stats.totalEpisodes;
        }
      } catch {
        // Use episode count from folder name.
      }
    }

    out.push({
      name: entry.name,
      episodes,
      rows: countCsvRows(path.join(dir, "dataset.csv")),
      hasReport: fs.existsSync(path.join(dir, "report", "metrics.json")),
      hasZip: fs.existsSync(path.join(dir, `${entry.name}.zip`)),
      updatedAt: fs.statSync(dir).mtime.toISOString()
    });
  }

  out.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  return out;
}

/** Back up live training state. */
export function backupLive(liveDir: string, tmpDir: string): string | null {
  const csv = path.join(liveDir, "dataset.csv");
  const state = path.join(liveDir, "agent_state.json");

  if (!fs.existsSync(csv) && !fs.existsSync(state)) return null;

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dest = path.join(tmpDir, `backup_${stamp}`);

  fs.mkdirSync(dest, { recursive: true });
  copyFileIfExists(state, path.join(dest, "agent_state.json"));
  copyFileIfExists(csv, path.join(dest, "dataset.csv"));

  return dest;
}

/** Keep only the latest backups. */
export function pruneBackups(tmpDir: string, keep = 5): void {
  if (!fs.existsSync(tmpDir)) return;

  const dirs = fs
    .readdirSync(tmpDir, { withFileTypes: true })
    .filter(e => e.isDirectory() && e.name.startsWith("backup_"))
    .map(e => e.name)
    .sort()
    .reverse();

  for (const name of dirs.slice(keep)) {
    fs.rmSync(path.join(tmpDir, name), { recursive: true, force: true });
  }
}

/** Clear the live workspace. */
export function clearLive(liveDir: string): void {
  if (!fs.existsSync(liveDir)) return;

  for (const entry of fs.readdirSync(liveDir)) {
    fs.rmSync(path.join(liveDir, entry), { recursive: true, force: true });
  }
}

/** Migrate legacy root files into the live workspace. */
export function migrateLegacyRoot(dataDir: string, liveDir: string): boolean {
  const legacyState = path.join(dataDir, "agent_state.json");
  const liveState = path.join(liveDir, "agent_state.json");

  if (!fs.existsSync(legacyState) || fs.existsSync(liveState)) return false;

  fs.mkdirSync(liveDir, { recursive: true });
  fs.renameSync(legacyState, liveState);

  const legacyCsv = path.join(dataDir, "dataset.csv");
  if (fs.existsSync(legacyCsv)) {
    fs.renameSync(legacyCsv, path.join(liveDir, "dataset.csv"));
  }

  const legacyReport = path.join(dataDir, "report");
  if (fs.existsSync(legacyReport)) {
    fs.renameSync(legacyReport, path.join(liveDir, "report"));
  }

  return true;
}