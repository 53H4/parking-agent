/**
 * Headless Q-learning trainer.
 *
 * Generates a CSV dataset and Q-table snapshot.
 *
 * Usage:
 *   npm run train
 *   npm run train -- 50000
 *   npm run train -- 30000 ./out
 *   node dist/train.js 30000
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  FileStorage,
  DatasetLogger,
  ParkingAgentRunner,
  exportCheckpoint
} from "@pkg/parking-agent";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EPISODES = Number(process.argv[2] ?? 30000);
const DATA_DIR = path.join(__dirname, "../data");

// Use _live by default and create a checkpoint after training.
const usesDefaultLocation = !process.argv[3];
const OUT_DIR = usesDefaultLocation
  ? path.join(DATA_DIR, "_live")
  : path.resolve(process.cwd(), process.argv[3]);

async function main() {
  console.log(`[train] epizoda: ${EPISODES}`);
  console.log(`[train] izlazni folder: ${OUT_DIR}`);

  const storage = new FileStorage(OUT_DIR);
  const dataset = new DatasetLogger(OUT_DIR, "dataset.csv");

  // Start with clean training data.
  storage.delete();
  dataset.clear();

  const runner = new ParkingAgentRunner(
    {
      env: {
        width: 18,
        height: 9,
        parkedDensity: 0.6,
        roadObstacleDensity: 0.05,
        maxSteps: 120,
        randomizeDifficulty: true,
        parkedDensityMin: 0.25,
        parkedDensityMax: 0.80,
        roadObstacleDensityMin: 0.0,
        roadObstacleDensityMax: 0.12
      },
      q: { alpha: 0.2, gamma: 0.95, epsilon: 0.8, epsilonMin: 0.05, epsilonDecay: 0.9997 },
      persistEveryEpisodes: 1000
    },
    storage,
    dataset
  );

  const t0 = Date.now();
  let lastReported = 0;

  // Run until the target episode count is reached.
  while (true) {
    const tick = await runner.step();
    if (!tick) continue;
    const done = tick.stats.totalEpisodes;
    if (done >= EPISODES) break;
    if (done - lastReported >= 2500) {
      lastReported = done;
      const sr = (tick.stats.successRate * 100).toFixed(1);
      process.stdout.write(
        `  epizoda ${done}/${EPISODES}  success=${sr}%  eps=${tick.stats.epsilon.toFixed(3)}\n`
      );
    }
  }

  // Save final agent state.
  const finalState = runner.exportState();
  storage.save(finalState);

  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  const rows = dataset.rowCount();
  console.log(`\n[train] gotovo za ${secs}s`);
  console.log(`[train] dataset: ${dataset.getFilePath()}  (${rows} redova)`);
  console.log(`[train] Q-snapshot: ${path.join(OUT_DIR, "agent_state.json")}`);

  if (usesDefaultLocation) {
    // Preserve training results outside _live.
    const { name, dir } = exportCheckpoint(DATA_DIR, OUT_DIR, finalState.stats.totalEpisodes);
    console.log(`[train] checkpoint: ${dir}  (naziv: ${name})`);
    console.log(`[train] ovaj checkpoint mozes ucitati kroz UI (dugme Load) i on je siguran od Reset All-a.`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});