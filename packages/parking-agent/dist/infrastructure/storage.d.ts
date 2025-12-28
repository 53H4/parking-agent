import { QTable } from "../application/qlearning.js";
export type Persisted = {
    qtable: any;
    stats: {
        totalEpisodes: number;
        successEpisodes: number;
        collisionEpisodes: number;
    };
    epsilon: number;
};
export declare class FileStorage {
    private dir;
    constructor(dir: string);
    private filePath;
    load(): Persisted | null;
    save(data: Persisted): void;
    /** Obriši spremljeni JSON (koristi se u resetAll). */
    delete(): void;
    loadQTable(): QTable;
}
