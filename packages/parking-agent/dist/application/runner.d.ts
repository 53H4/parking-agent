import { SoftwareAgent } from "@pkg/ai-agents-core";
import { Experience, TickResult, WorldState } from "../domain/types.js";
import { EnvConfig } from "./env.js";
import { QConfig } from "./qlearning.js";
import { FileStorage, Persisted } from "../infrastructure/storage.js";
export type RunnerConfig = {
    env: EnvConfig;
    q: QConfig;
    persistEveryEpisodes: number;
};
export declare class ParkingAgentRunner extends SoftwareAgent<any, any, TickResult, Experience> {
    private cfg;
    private storage;
    private world;
    private qtable;
    private stats;
    private readonly initialEpsilon;
    constructor(cfg: RunnerConfig, storage: FileStorage);
    getState(): WorldState;
    /** Izvoz trenutnog znanja (Q‑tablica + statistika + epsilon). */
    exportState(): Persisted;
    /** Učitaj znanje iz JSON‑a i pokreni novu epizodu. */
    loadState(p: Persisted): void;
    /** Resetiraj samo epizodu – Q‑tablica ostaje. */
    resetEpisode(): void;
    /** Potpuni reset: obriši Q‑tablicu, statistiku i vrati epsilon na početni. */
    resetAll(): void;
    step(): Promise<TickResult | null>;
}
