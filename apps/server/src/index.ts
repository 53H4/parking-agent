import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import path from "node:path";
import fs from "node:fs";
import { spawnSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  FileStorage,
  ParkingAgentRunner,
  DatasetLogger,
  exportCheckpoint,
  loadCheckpointFiles,
  listCheckpoints,
  isValidCheckpointName,
  migrateLegacyRoot,
  backupLive,
  pruneBackups,
  countCsvRows
} from "@pkg/parking-agent";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Allow large Q-table snapshots.
app.use(express.json({ limit: "25mb" }));

// Enable UI CORS.
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();
  next();
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Storage
const DATA_DIR = path.join(__dirname, "../data");
const LIVE_DIR = path.join(DATA_DIR, "_live");
const TMP_DIR = path.join(DATA_DIR, "_tmp");
fs.mkdirSync(LIVE_DIR, { recursive: true });
fs.mkdirSync(TMP_DIR, { recursive: true });

// Migrate legacy data before loading storage.
const migrated = migrateLegacyRoot(DATA_DIR, LIVE_DIR);
if (migrated) {
  console.log("[migracija] pronadjen stariji agent_state.json/dataset.csv u data/ — premjesten u data/_live/");
}

const storage = new FileStorage(LIVE_DIR);
const datasetLogger = new DatasetLogger(LIVE_DIR, "dataset.csv");

if (migrated) {
  // Preserve migrated data as a checkpoint.
  const migratedEpisodes = storage.load()?.stats?.totalEpisodes ?? 0;
  if (migratedEpisodes > 0) {
    const { name } = exportCheckpoint(DATA_DIR, LIVE_DIR, migratedEpisodes);
    console.log(`[migracija] napravljen checkpoint '${name}' od migriranih podataka.`);
  }
}

const runner = new ParkingAgentRunner(
  {
    env: {
      width: 18,
      height: 9,
      parkedDensity: 0.6,
      roadObstacleDensity: 0.05,
      maxSteps: 120,
      // Randomize episode difficulty.
      randomizeDifficulty: true,
      parkedDensityMin: 0.25,
      parkedDensityMax: 0.80,
      roadObstacleDensityMin: 0.0,
      roadObstacleDensityMax: 0.12
    },
    // Preserve exploration across experience levels.
    q: { alpha: 0.2, gamma: 0.95, epsilon: 0.8, epsilonMin: 0.05, epsilonDecay: 0.9997 },
    persistEveryEpisodes: 5
  },
  storage,
  datasetLogger
);

// Broadcast via WebSocket.
function broadcast(obj: any) {
  const msg = JSON.stringify(obj);
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(msg);
  }
}

let running = false;
let delayMs = 60;

async function loop() {
  while (running) {
    const tick = await runner.step();
    if (tick) broadcast({ type: "TICK", payload: tick });
    else broadcast({ type: "NOWORK" });

    await new Promise(res => setTimeout(res, delayMs));
  }
}

app.get("/api/state", (_req, res) => {
  res.json(runner.getState());
});

// Live training status.
app.get("/api/status", (_req, res) => {
  const stats = runner.exportState().stats;
  res.json({
    running,
    delayMs,
    episodes: stats.totalEpisodes,
    rows: datasetLogger.rowCount()
  });
});

app.post("/api/start", async (_req, res) => {
  if (!running) {
    running = true;
    loop();
  }
  res.json({ running: true });
});

app.post("/api/stop", (_req, res) => {
  running = false;
  res.json({ running: false });
});

// Reset current episode.
app.post("/api/reset", (_req, res) => {
  runner.resetEpisode();
  res.json({ ok: true });
});

// Reset live session only.
app.post("/api/resetAll", (_req, res) => {
  running = false;

  // Back up live data before reset.
  let backupDir: string | null = null;
  try {
    backupDir = backupLive(LIVE_DIR, TMP_DIR);
    pruneBackups(TMP_DIR, 5);
    if (backupDir) console.log(`[resetAll] sigurnosna kopija: ${backupDir}`);
  } catch (e: any) {
    console.warn(`[resetAll] sigurnosna kopija nije napravljena: ${e?.message ?? e}`);
  }

  runner.resetAll();
  // Remove stale report.
  try {
    const rep = path.join(LIVE_DIR, "report");
    if (fs.existsSync(rep)) fs.rmSync(rep, { recursive: true, force: true });
  } catch { /* nebitno */ }
  res.json({ ok: true, backup: backupDir ? path.basename(backupDir) : null });
});

// Python helpers
function pythonCandidates(): string[] {
  return [process.env.PYTHON_BIN, "python", "python3"].filter((b): b is string => !!b);
}

/** Run a Python script synchronously. */
function runPythonScriptSync(scriptPath: string, args: string[]): { ok: boolean; reason?: string } {
  let lastErr = "";
  for (const bin of pythonCandidates()) {
    const r = spawnSync(bin, [scriptPath, ...args], { encoding: "utf-8" });
    if (r.error) {
      lastErr = (r.error as any)?.code === "ENOENT" ? `'${bin}' nije pronađen` : String(r.error.message);
      continue;
    }
    if (r.status !== 0) {
      lastErr = (r.stderr || r.stdout || `exit ${r.status}`).toString().slice(-500);
      continue;
    }
    return { ok: true };
  }
  return {
    ok: false,
    reason: `Ne mogu pokrenuti Python (probano: ${pythonCandidates().join(", ")}). ${lastErr}`
  };
}

const ZIP_SCRIPT = path.join(__dirname, "../analysis/zip_folder.py");

function zipCheckpointDir(dir: string, name: string): { ok: boolean; zipPath?: string; reason?: string } {
  const tmpZip = path.join(TMP_DIR, `${name}-${Date.now()}.zip`);
  const r = runPythonScriptSync(ZIP_SCRIPT, ["--src", dir, "--out", tmpZip]);
  if (!r.ok || !fs.existsSync(tmpZip)) return { ok: false, reason: r.reason ?? "Ne mogu napraviti zip." };
  const finalZip = path.join(dir, `${name}.zip`);
  fs.renameSync(tmpZip, finalZip);
  return { ok: true, zipPath: finalZip };
}

// Checkpoints

// List checkpoints.
app.get("/api/checkpoints", (_req, res) => {
  res.json({ checkpoints: listCheckpoints(DATA_DIR) });
});

// Export live checkpoint.
app.post("/api/checkpoints/export", (_req, res) => {
  const state = runner.exportState();
  const episodes = state.stats.totalEpisodes;
  if (episodes < 1) {
    return res.status(400).json({ ok: false, reason: "Nema još nijedne odigrane epizode za export." });
  }

  // Save latest agent state.
  storage.save(state);

  const liveRows = countCsvRows(path.join(LIVE_DIR, "dataset.csv"));

  // Prevent overwriting a larger checkpoint.
  const existingName = `${episodes}_episodes`;
  const existingRows = countCsvRows(path.join(DATA_DIR, existingName, "dataset.csv"));
  if (existingRows > liveRows) {
    return res.status(409).json({
      ok: false,
      reason:
        `Checkpoint '${existingName}' vec postoji i ima ${existingRows} redova, a trenutni ` +
        `live dataset ima samo ${liveRows}. Export je zaustavljen da ne prepise bogatiji ` +
        `dataset. Provjeri je li ucitan ispravan checkpoint.`
    });
  }

  const { name, dir } = exportCheckpoint(DATA_DIR, LIVE_DIR, episodes);
  const zip = zipCheckpointDir(dir, name);

  res.json({
    ok: true,
    name,
    episodes,
    rows: liveRows,
    downloadUrl: zip.ok ? `/api/checkpoints/${name}/download` : null,
    zipWarning: zip.ok ? undefined : zip.reason,
    // Warn on state/dataset mismatch.
    rowsWarning:
      liveRows < episodes * 0.5
        ? `Stanje agenta kaze ${episodes} epizoda, ali dataset ima samo ${liveRows} redova — ` +
          `csv vjerovatno ne pripada ovom treningu.`
        : undefined
  });
});

// Download checkpoint.
app.get("/api/checkpoints/:name/download", (req, res) => {
  const { name } = req.params;
  if (!isValidCheckpointName(name)) {
    return res.status(400).json({ ok: false, reason: "Neispravno ime checkpointa." });
  }
  const dir = path.join(DATA_DIR, name);
  if (!fs.existsSync(dir)) {
    return res.status(404).json({ ok: false, reason: `Checkpoint '${name}' ne postoji.` });
  }

  const zipPath = path.join(dir, `${name}.zip`);
  const sendZip = () => {
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename=parking_agent_${name}.zip`);
    fs.createReadStream(zipPath).pipe(res);
  };

  if (fs.existsSync(zipPath)) return sendZip();

  // Create ZIP if missing.
  const zip = zipCheckpointDir(dir, name);
  if (!zip.ok) return res.status(500).json({ ok: false, reason: zip.reason });
  sendZip();
});

// Load checkpoint.
app.post("/api/checkpoints/:name/load", (req, res) => {
  const { name } = req.params;
  try {
    running = false; // Stop training while loading files.
    loadCheckpointFiles(DATA_DIR, LIVE_DIR, name);
    runner.reload();
    res.json({
      ok: true,
      name,
      episodes: runner.exportState().stats.totalEpisodes,
      rows: datasetLogger.rowCount()
    });
  } catch (e: any) {
    res.status(400).json({ ok: false, reason: e?.message ?? "Ucitavanje nije uspjelo." });
  }
});

app.post("/api/speed", (req, res) => {
  const v = Number(req.body?.delayMs);
  if (Number.isFinite(v) && v >= 5 && v <= 500) delayMs = v;
  res.json({ delayMs });
});

// ML report
const REPORT_DIR = path.join(LIVE_DIR, "report");
const PY_SCRIPT = path.join(__dirname, "../analysis/analyze_report.py");

let analyzing = false;

// Analyze live dataset.
app.post("/api/analyze", async (_req, res) => {
  if (analyzing) return res.status(409).json({ ok: false, reason: "Analiza je već u toku, sačekaj." });
  if (datasetLogger.rowCount() < 1) {
    return res.status(400).json({ ok: false, reason: "Dataset je prazan. Pokreni trening (Start) da se napune epizode, ili ucitaj checkpoint." });
  }
  analyzing = true;
  // Remove previous report.
  if (fs.existsSync(REPORT_DIR)) fs.rmSync(REPORT_DIR, { recursive: true, force: true });
  fs.mkdirSync(REPORT_DIR, { recursive: true });

  const candidates = pythonCandidates();
  let responded = false;
  const respond = (code: number, payload: any) => {
    if (responded) return;
    responded = true;
    analyzing = false;
    res.status(code).json(payload);
  };

  const runWith = (binIndex: number) => {
    const bin = candidates[binIndex];
    const child = spawn(bin, [PY_SCRIPT, "--data", datasetLogger.getFilePath(), "--out", REPORT_DIR], {
      cwd: path.join(__dirname, "..")
    });
    let stderr = "";
    let abandoned = false;
    child.stderr.on("data", d => (stderr += d.toString()));
    child.stdout.on("data", d => process.stdout.write("[analyze] " + d.toString()));

    child.on("error", (err: any) => {
      if (err?.code === "ENOENT" && binIndex + 1 < candidates.length) {
        abandoned = true;
        return runWith(binIndex + 1);
      }
      const hint = err?.code === "ENOENT"
        ? `Ne mogu pokrenuti Python (probano: ${candidates.join(", ")}). Instaliraj Python i biblioteke: pip install pandas scikit-learn matplotlib seaborn python-docx. (Možeš postaviti i PYTHON_BIN env varijablu.)`
        : String(err?.message || err);
      respond(500, { ok: false, reason: hint });
    });

    child.on("close", () => {
      if (abandoned || responded) return;
      const metricsPath = path.join(REPORT_DIR, "metrics.json");
      if (!fs.existsSync(metricsPath)) {
        return respond(500, {
          ok: false,
          reason: "Analiza nije proizvela rezultat. Provjeri da su instalirane Python biblioteke (pandas, scikit-learn, matplotlib, seaborn).",
          detail: stderr.slice(-800)
        });
      }
      let metrics: any;
      try {
        metrics = JSON.parse(fs.readFileSync(metricsPath, "utf-8"));
      } catch (e: any) {
        return respond(500, { ok: false, reason: "Ne mogu pročitati metrics.json: " + e?.message });
      }
      if (!metrics.ok) return respond(400, metrics);

      const toDataUrl = (file?: string) => {
        if (!file) return null;
        const fp = path.join(REPORT_DIR, file);
        if (!fs.existsSync(fp)) return null;
        return "data:image/png;base64," + fs.readFileSync(fp).toString("base64");
      };
      metrics.chartData = {
        target: toDataUrl(metrics.charts?.target),
        importance: toDataUrl(metrics.charts?.importance),
        roc: toDataUrl(metrics.charts?.roc),
        compare: toDataUrl(metrics.charts?.compare),
        cv: toDataUrl(metrics.charts?.cv)
      };
      metrics.downloadUrl = "/api/analyze/download";
      respond(200, metrics);
    });
  };

  runWith(0);
});

// Download ML report.
app.get("/api/analyze/download", (_req, res) => {
  const zipPath = path.join(REPORT_DIR, "report.zip");
  if (!fs.existsSync(zipPath)) {
    return res.status(404).json({ ok: false, reason: "Izvještaj još nije generisan. Klikni 'Generiši izvještaj' prvo." });
  }
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", "attachment; filename=parking_izvjestaj.zip");
  fs.createReadStream(zipPath).pipe(res);
});

server.listen(3001, () => {
  console.log("Server running on http://localhost:3001");
  console.log(`Live radni folder: ${LIVE_DIR}`);
  console.log(`Checkpointi: ${DATA_DIR}/<N>_episodes/`);
});
