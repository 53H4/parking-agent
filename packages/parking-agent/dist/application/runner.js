import { SoftwareAgent } from "@pkg/ai-agents-core";
import { Action } from "../domain/types.js";
import { createParkingWorld, stepWorld } from "./env.js";
import { buildPercept } from "./perception.js";
import { toStateKey } from "./stateKey.js";
import { QTable, learnQLearning } from "./qlearning.js";
export class ParkingAgentRunner extends SoftwareAgent {
    cfg;
    storage;
    world;
    qtable;
    stats = { totalEpisodes: 0, successEpisodes: 0, collisionEpisodes: 0 };
    // zapamti početni epsilon da ga možeš vratiti kod resetAll()
    initialEpsilon;
    constructor(cfg, storage) {
        super();
        this.cfg = cfg;
        this.storage = storage;
        // učitaj prethodno stanje (ako postoji)
        const persisted = storage.load();
        this.qtable = persisted ? QTable.fromJSON(persisted.qtable) : new QTable();
        if (persisted?.stats)
            this.stats = persisted.stats;
        if (persisted?.epsilon != null)
            this.cfg.q.epsilon = persisted.epsilon;
        this.initialEpsilon = this.cfg.q.epsilon;
        // inicijalna epizoda
        const nextEpisode = (this.stats.totalEpisodes ?? 0) + 1;
        this.world = createParkingWorld(cfg.env, nextEpisode);
    }
    getState() {
        return this.world;
    }
    /** Izvoz trenutnog znanja (Q‑tablica + statistika + epsilon). */
    exportState() {
        return {
            qtable: this.qtable.toJSON(),
            stats: { ...this.stats },
            epsilon: this.cfg.q.epsilon
        };
    }
    /** Učitaj znanje iz JSON‑a i pokreni novu epizodu. */
    loadState(p) {
        this.qtable = QTable.fromJSON(p.qtable);
        this.stats = p.stats ?? { totalEpisodes: 0, successEpisodes: 0, collisionEpisodes: 0 };
        if (typeof p.epsilon === "number")
            this.cfg.q.epsilon = p.epsilon;
        const nextEpisode = (this.stats.totalEpisodes ?? 0) + 1;
        this.world = createParkingWorld(this.cfg.env, nextEpisode);
    }
    /** Resetiraj samo epizodu – Q‑tablica ostaje. */
    resetEpisode() {
        const nextEpisode = this.stats.totalEpisodes + 1;
        this.world = createParkingWorld(this.cfg.env, nextEpisode);
    }
    /** Potpuni reset: obriši Q‑tablicu, statistiku i vrati epsilon na početni. */
    resetAll() {
        this.qtable = new QTable();
        this.stats = { totalEpisodes: 0, successEpisodes: 0, collisionEpisodes: 0 };
        this.cfg.q.epsilon = this.initialEpsilon;
        this.storage.delete();
        // startaj iz početka
        this.world = createParkingWorld(this.cfg.env, 1);
    }
    // SENSE → THINK → ACT → LEARN
    async step() {
        const percept = buildPercept(this.world);
        if (percept.done)
            return null;
        const sKey = toStateKey(percept);
        const actions = Object.values(Action);
        // epsilon‑greedy odabir akcije
        const explore = Math.random() < this.cfg.q.epsilon;
        let action;
        if (explore) {
            action = actions[Math.floor(Math.random() * actions.length)];
        }
        else {
            action = this.qtable.bestAction(sKey).action;
        }
        // izvrši akciju u okruženju
        const { world: newWorld, reward, done, reason } = stepWorld(this.world, action, this.cfg.env.maxSteps);
        // ažuriraj Q‑tablicu
        const nextPercept = buildPercept(newWorld);
        const nextSKey = toStateKey(nextPercept);
        learnQLearning(this.qtable, { sKey, action, reward, nextSKey, done }, this.cfg.q);
        this.world = newWorld;
        // završetak epizode
        if (done) {
            this.stats.totalEpisodes += 1;
            if (reason === "GOAL")
                this.stats.successEpisodes += 1;
            if (reason === "COLLISION")
                this.stats.collisionEpisodes += 1;
            // adaptivni epsilon
            this.cfg.q.epsilon = Math.max(this.cfg.q.epsilonMin, this.cfg.q.epsilon * this.cfg.q.epsilonDecay);
            if (this.stats.totalEpisodes % this.cfg.persistEveryEpisodes === 0) {
                this.storage.save({
                    qtable: this.qtable.toJSON(),
                    stats: this.stats,
                    epsilon: this.cfg.q.epsilon
                });
            }
            this.resetEpisode();
        }
        const successRate = this.stats.totalEpisodes === 0
            ? 0
            : this.stats.successEpisodes / this.stats.totalEpisodes;
        return {
            episode: this.world.episode,
            step: this.world.steps,
            action,
            reward,
            done,
            reason,
            state: this.world,
            stats: {
                ...this.stats,
                successRate,
                epsilon: this.cfg.q.epsilon
            }
        };
    }
}
