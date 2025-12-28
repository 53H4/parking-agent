import { Action } from "../domain/types.js";
const same = (a, b) => a.x === b.x && a.y === b.y;
function rand(seed) {
    // deterministic PRNG (mulberry32)
    let t = seed >>> 0;
    return () => {
        t += 0x6d2b79f5;
        let r = Math.imul(t ^ (t >>> 15), 1 | t);
        r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
}
function inBounds(p, w, h) {
    return p.x >= 0 && p.y >= 0 && p.x < w && p.y < h;
}
function isObstacle(p, obstacles) {
    return obstacles.some(o => o.x === p.x && o.y === p.y);
}
function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}
function layout(cfg) {
    // Keep everything valid even for small sizes.
    const topParkY = 1;
    const bottomParkY = clamp(cfg.height - 2, 2, cfg.height - 1);
    // road corridor: rows between parking rows
    const roadMinY = topParkY + 1;
    const roadMaxY = bottomParkY - 1;
    const roadCenterY = Math.floor((roadMinY + roadMaxY) / 2);
    return { topParkY, bottomParkY, roadMinY, roadMaxY, roadCenterY };
}
export function createParkingLotWorld(cfg, episode) {
    const { topParkY, bottomParkY, roadCenterY } = layout(cfg);
    const rng = rand((cfg.seed ?? 12345) + episode * 99991);
    // Target spot on bottom row, near the right.
    const target = { x: cfg.width - 2, y: bottomParkY };
    // Agent starts on the road near the left.
    const agent = { x: 1, y: roadCenterY };
    // Parking slots are x=1..width-2 (keep borders empty for "walls")
    const slotXs = [];
    for (let x = 1; x <= cfg.width - 2; x++)
        slotXs.push(x);
    const obstacles = [];
    // Fill top parking row
    for (const x of slotXs) {
        const p = { x, y: topParkY };
        if (same(p, agent) || same(p, target))
            continue;
        if (rng() < cfg.parkedDensity)
            obstacles.push(p);
    }
    // Fill bottom parking row (excluding the target spot so it stays free)
    for (const x of slotXs) {
        const p = { x, y: bottomParkY };
        if (same(p, agent) || same(p, target))
            continue;
        if (rng() < cfg.parkedDensity)
            obstacles.push(p);
    }
    // Add a couple of random "pillars" in the road (optional, sparse)
    // This keeps learning interesting but still realistic.
    const pillarCount = Math.max(0, Math.floor(cfg.width * 0.08));
    for (let i = 0; i < pillarCount; i++) {
        const x = 2 + Math.floor(rng() * (cfg.width - 4));
        const y = (layout(cfg).roadMinY) + Math.floor(rng() * Math.max(1, (layout(cfg).roadMaxY - layout(cfg).roadMinY + 1)));
        const p = { x, y };
        if (!inBounds(p, cfg.width, cfg.height))
            continue;
        if (same(p, agent) || same(p, target))
            continue;
        if (obstacles.some(o => same(o, p)))
            continue;
        obstacles.push(p);
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
        lastReward: 0
    };
}
// Backwards-friendly name used by the runner
export function createParkingWorld(cfg, episode) {
    return createParkingLotWorld(cfg, episode);
}
export function stepWorld(world, action, maxSteps) {
    if (world.done) {
        return { world, reward: 0, done: true, reason: "MOVE" };
    }
    const delta = action === Action.UP ? { x: 0, y: -1 } :
        action === Action.DOWN ? { x: 0, y: 1 } :
            action === Action.LEFT ? { x: -1, y: 0 } :
                { x: 1, y: 0 };
    const next = { x: world.agent.x + delta.x, y: world.agent.y + delta.y };
    let reward = -1; // small time penalty
    let done = false;
    let reason = "MOVE";
    // collision or out of bounds = episode ends
    if (!inBounds(next, world.width, world.height) || isObstacle(next, world.obstacles)) {
        reward = -50;
        done = true;
        reason = "COLLISION";
    }
    else {
        // move happens
        world = { ...world, agent: next };
        // reaching goal ends episode
        if (same(next, world.target)) {
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
    const newWorld = {
        ...world,
        steps,
        done,
        lastReward: reward
    };
    return { world: newWorld, reward, done, reason };
}
