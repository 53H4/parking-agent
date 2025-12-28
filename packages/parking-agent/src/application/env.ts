import { Action, GridPos, WorldState } from "../domain/types.js";

const same = (a: GridPos, b: GridPos) => a.x === b.x && a.y === b.y;

export type EnvConfig = {
  width: number;
  height: number;
  parkedDensity: number;
  roadObstacleDensity: number;
  maxSteps: number;
  seed?: number;
};

function rand(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function inBounds(p: GridPos, w: number, h: number) {
  return p.x >= 0 && p.y >= 0 && p.x < w && p.y < h;
}

function isObstacle(p: GridPos, obstacles: GridPos[]) {
  return obstacles.some(o => same(o, p));
}

/**
 * ⚠️ MUST MATCH UI (App.tsx):
 * topRow = 2
 * bottomRow = h - 3
 */
function layout(cfg: EnvConfig) {
  const topParkingY = 2;
  const bottomParkingY = cfg.height - 3;

  const roadMinY = topParkingY + 1;
  const roadMaxY = bottomParkingY - 1;
  const roadCenterY = Math.floor((roadMinY + roadMaxY) / 2);

  return {
    topParkingY,
    bottomParkingY,
    roadMinY,
    roadMaxY,
    roadCenterY
  };
}

export function createParkingWorld(cfg: EnvConfig, episode: number): WorldState {
  const { topParkingY, bottomParkingY, roadMinY, roadMaxY, roadCenterY } = layout(cfg);

  const rng = rand((cfg.seed ?? 12345) + episode * 9973);

  const agent: GridPos = { x: 1, y: roadCenterY };
  const target: GridPos = { x: cfg.width - 2, y: bottomParkingY };

  const obstacles: GridPos[] = [];

  // VALID parking X slots (between borders)
  const parkingXs: number[] = [];
  for (let x = 1; x <= cfg.width - 2; x++) parkingXs.push(x);

  // ---- TOP PARKING (BLUE ZONE) ----
  for (const x of parkingXs) {
    const p = { x, y: topParkingY };
    if (!same(p, target) && rng() < cfg.parkedDensity) {
      obstacles.push(p);
    }
  }

  // ---- BOTTOM PARKING (BLUE ZONE) ----
  for (const x of parkingXs) {
    const p = { x, y: bottomParkingY };
    if (!same(p, target) && rng() < cfg.parkedDensity) {
      obstacles.push(p);
    }
  }

  // ---- ROAD OBSTACLES ONLY ON ROAD ----
  for (let y = roadMinY; y <= roadMaxY; y++) {
    for (let x = 2; x <= cfg.width - 3; x++) {
      if (rng() < cfg.roadObstacleDensity) {
        const p = { x, y };
        if (!same(p, agent) && !same(p, target)) {
          obstacles.push(p);
        }
      }
    }
  }

  return {
    width: cfg.width,
    height: cfg.height,
    obstacles,
    target,
    agent,
    steps: 0,
    episode,
    done: false,
    lastReward: 0,
    parked: false
  };
}

export function stepWorld(
  world: WorldState,
  action: Action,
  maxSteps: number
) {
  if (world.done) {
    return { world, reward: 0, done: true, reason: "MOVE" as const };
  }

  const delta =
    action === Action.UP ? { x: 0, y: -1 } :
    action === Action.DOWN ? { x: 0, y: 1 } :
    action === Action.LEFT ? { x: -1, y: 0 } :
    { x: 1, y: 0 };

  const next = { x: world.agent.x + delta.x, y: world.agent.y + delta.y };

  let reward = -1;
  let done = false;
  let reason: "GOAL" | "COLLISION" | "MAX_STEPS" | "MOVE" = "MOVE";

  if (!inBounds(next, world.width, world.height) || isObstacle(next, world.obstacles)) {
    reward = -50;
    done = true;
    reason = "COLLISION";
  } else {
    // move happens
world = { ...world, agent: next };

// 1️⃣ ako je ušao u parking mjesto prvi put
if (same(next, world.target) && !world.parked) {
  reward = +10;                 // mala nagrada
  world = { ...world, parked: true };
  reason = "MOVE";
}

// 2️⃣ ako je već bio parkiran i ostao još jedan tick
else if (same(next, world.target) && world.parked) {
  reward = +100;
  done = true;
  reason = "GOAL";
}

  }

  const steps = world.steps + 1;
  if (!done && steps >= maxSteps) {
    reward = -30;
    done = true;
    reason = "MAX_STEPS";
  }

  return {
    world: { ...world, steps, done, lastReward: reward },
    reward,
    done,
    reason
  };
}
