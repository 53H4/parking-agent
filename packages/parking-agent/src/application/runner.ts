import { SoftwareAgent } from "@pkg/ai-agents-core";
import { Action, Experience, TickResult, WorldState } from "../domain/types.js";
import { EnvConfig, createParkingWorld, stepWorld } from "./env.js";
import { buildPercept } from "./perception.js";
import { toStateKey } from "./stateKey.js";
import { QConfig, QTable, learnQLearning } from "./qlearning.js";
import { FileStorage, Persisted } from "../infrastructure/storage.js";
import { DatasetLogger } from "../infrastructure/DatasetLogger.js";
import {
  EpisodeAccumulator,
  newAccumulator,
  buildEpisodeRecord
} from "./datasetFeatures.js";

export type RunnerConfig = {
  env: EnvConfig;
  q: QConfig;
  persistEveryEpisodes: number;
};

/** Deterministic RNG for dataset noise. */
function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const manhattan = (ax: number, ay: number, bx: number, by: number) =>
  Math.abs(ax - bx) + Math.abs(ay - by);

export class ParkingAgentRunner extends SoftwareAgent<any, any, TickResult, Experience> {
  private world: WorldState;
  private qtable: QTable;
  private stats = { totalEpisodes: 0, successEpisodes: 0, collisionEpisodes: 0 };
  // Initial epsilon.
  private readonly initialEpsilon: number;

  // Optional dataset logging.
  private dataset?: DatasetLogger;
  private acc!: EpisodeAccumulator;
  private datasetRng: () => number;

  constructor(
    private cfg: RunnerConfig,
    private storage: FileStorage,
    dataset?: DatasetLogger
  ) {
    super();
    this.dataset = dataset;
    this.datasetRng = mulberry32((cfg.env.seed ?? 12345) ^ 0x9e3779b9);

    // Preserve configured epsilon for reset.
    this.initialEpsilon = cfg.q.epsilon;

    // Restore persisted state.
    const persisted = storage.load();
    this.qtable = persisted ? QTable.fromJSON(persisted.qtable) : new QTable();
    if (persisted?.stats) this.stats = { ...persisted.stats };
    if (persisted?.epsilon != null) this.cfg.q.epsilon = persisted.epsilon;

    // Initialize episode.
    const nextEpisode = (this.stats.totalEpisodes ?? 0) + 1;
    this.world = createParkingWorld(cfg.env, nextEpisode);
    this.startAccumulator();
  }

  getState(): WorldState {
    return this.world;
  }

  /** Check dataset logging. */
  hasDataset(): boolean {
    return !!this.dataset;
  }

  /** Get dataset logger. */
  getDataset(): DatasetLogger | undefined {
    return this.dataset;
  }

  /** Export agent state. */
  exportState(): Persisted {
    return {
      qtable: this.qtable.toJSON(),
      stats: { ...this.stats },
      epsilon: this.cfg.q.epsilon
    };
  }

  /** Reload persisted state and start a new episode. */
  reload(): void {
    const persisted = this.storage.load();
    this.qtable = persisted ? QTable.fromJSON(persisted.qtable) : new QTable();
    this.stats = persisted?.stats
      ? { ...persisted.stats }
      : { totalEpisodes: 0, successEpisodes: 0, collisionEpisodes: 0 };
    this.cfg.q.epsilon = typeof persisted?.epsilon === "number" ? persisted.epsilon : this.initialEpsilon;

    this.dataset?.invalidateCache();

    const nextEpisode = (this.stats.totalEpisodes ?? 0) + 1;
    this.world = createParkingWorld(this.cfg.env, nextEpisode);
    this.startAccumulator();
  }

  /** Reset current episode. */
  resetEpisode() {
    const nextEpisode = this.stats.totalEpisodes + 1;
    this.world = createParkingWorld(this.cfg.env, nextEpisode);
    this.startAccumulator();
  }

  /** Reset all training state. */
  resetAll() {
    this.qtable = new QTable();
    this.stats = { totalEpisodes: 0, successEpisodes: 0, collisionEpisodes: 0 };
    this.cfg.q.epsilon = this.initialEpsilon;
    this.storage.delete();
    this.dataset?.clear();

    this.world = createParkingWorld(this.cfg.env, 1);
    this.startAccumulator();
  }

  /** Initialize episode metrics. */
  private startAccumulator() {
    const w = this.world;
    const ax = w.agent.x, ay = w.agent.y;
    const tx = w.target.x, ty = w.target.y;

    const obstacleCount = w.obstacles.length;
    // Path obstacles.
    const loX = Math.min(ax, tx), hiX = Math.max(ax, tx);
    const pathObstacles = w.obstacles.reduce(
      (n, o) => (o.x >= loX && o.x <= hiX ? n + 1 : n),
      0
    );

    const parkedDensity = w.parkedDensityUsed ?? this.cfg.env.parkedDensity;
    const roadDensity = w.roadDensityUsed ?? this.cfg.env.roadObstacleDensity;
    const startDistance = manhattan(ax, ay, tx, ty);

    this.acc = newAccumulator(
      w.episode,
      this.stats.totalEpisodes,
      this.cfg.q.epsilon,
      obstacleCount,
      pathObstacles,
      parkedDensity,
      roadDensity,
      startDistance
    );
  }

  // Sense → Think → Act → Learn
  async step(): Promise<TickResult | null> {
    const percept = buildPercept(this.world);
    if (percept.done) return null;

    const sKey = toStateKey(percept);
    const actions = Object.values(Action);

    // Epsilon-greedy action.
    const explore = Math.random() < this.cfg.q.epsilon;
    let action: Action;
    if (explore) {
      action = actions[Math.floor(Math.random() * actions.length)];
    } else {
      action = this.qtable.bestAction(sKey).action;
    }

    // Record action metrics.
    if (this.dataset) {
      this.acc.totalMoves += 1;
      if (explore) this.acc.exploreMoves += 1;
      if (action === Action.LEFT || action === Action.RIGHT) this.acc.horiz += 1;
      else this.acc.vert += 1;
      const bestV = this.qtable.bestAction(sKey).value;
      const chosenV = this.qtable.get(sKey, action);
      this.acc.sumQGap += Math.abs(bestV - chosenV);
    }

    // Execute action.
    const { world: newWorld, reward, done, reason } = stepWorld(
      this.world,
      action,
      this.cfg.env.maxSteps
    );

    // Update Q-table.
    const nextPercept = buildPercept(newWorld);
    const nextSKey = toStateKey(nextPercept);
    learnQLearning(
      this.qtable,
      { sKey, action, reward, nextSKey, done },
      this.cfg.q
    );

    this.world = newWorld;

    // Record result metrics.
    if (this.dataset) {
      const nd = manhattan(
        newWorld.agent.x, newWorld.agent.y,
        newWorld.target.x, newWorld.target.y
      );
      if (nd < this.acc.prevDist) this.acc.closer += 1;
      this.acc.prevDist = nd;
      if (this.acc.earlyExplore.length < 6) {
        this.acc.earlyRewards.push(reward);
        this.acc.earlyExplore.push(explore);
        this.acc.earlyDist.push(nd);
      }
    }

    // Finish episode.
    if (done) {
      this.stats.totalEpisodes += 1;
      if (reason === "GOAL") this.stats.successEpisodes += 1;
      if (reason === "COLLISION") this.stats.collisionEpisodes += 1;

      // Save episode record.
      if (this.dataset) {
        this.acc.steps = newWorld.steps;
        this.acc.reason = (reason ?? "MAX_STEPS") as EpisodeAccumulator["reason"];
        const gridTheme = this.datasetRng() < 0.5 ? "Day" : "Night";
        const earlyRewardMissing = this.datasetRng() < 0.018; // ~1.8% MAR.
        const record = buildEpisodeRecord(this.acc, gridTheme, earlyRewardMissing);
        this.dataset.append(record);
      }

      // Decay epsilon.
      this.cfg.q.epsilon = Math.max(
        this.cfg.q.epsilonMin,
        this.cfg.q.epsilon * this.cfg.q.epsilonDecay
      );

      if (this.stats.totalEpisodes % this.cfg.persistEveryEpisodes === 0) {
        this.storage.save({
          qtable: this.qtable.toJSON(),
          stats: this.stats,
          epsilon: this.cfg.q.epsilon
        });
      }
      this.resetEpisode();
    }

    // Report the completed world on the final tick.
    const reported = done ? newWorld : this.world;

    const successRate =
      this.stats.totalEpisodes === 0
        ? 0
        : this.stats.successEpisodes / this.stats.totalEpisodes;

    return {
      episode: reported.episode,
      step: reported.steps,
      action,
      reward,
      done,
      reason,
      state: reported,
      stats: {
        ...this.stats,
        successRate,
        epsilon: this.cfg.q.epsilon
      }
    };
  }
}
