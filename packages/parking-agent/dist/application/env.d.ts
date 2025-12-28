import { Action, WorldState } from "../domain/types.js";
/**
 * Parking-lot environment (2D):
 * - Two parking rows (top + bottom) filled with parked cars (obstacles)
 * - A 2–3 cell "road" corridor in the middle where the agent can drive
 * - A single target parking spot (free) on the bottom row
 */
export type EnvConfig = {
    width: number;
    height: number;
    /** 0..1 how many parking slots (excluding target) are filled */
    parkedDensity: number;
    maxSteps: number;
    seed?: number;
};
export declare function createParkingLotWorld(cfg: EnvConfig, episode: number): WorldState;
export declare function createParkingWorld(cfg: EnvConfig, episode: number): WorldState;
export declare function stepWorld(world: WorldState, action: Action, maxSteps: number): {
    world: WorldState;
    reward: number;
    done: boolean;
    reason: "GOAL" | "COLLISION" | "MAX_STEPS" | "MOVE";
};
