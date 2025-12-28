import { Action, Experience } from "../domain/types.js";
export type QConfig = {
    alpha: number;
    gamma: number;
    epsilon: number;
    epsilonMin: number;
    epsilonDecay: number;
};
export declare class QTable {
    private q;
    get(sKey: string, a: Action): number;
    set(sKey: string, a: Action, v: number): void;
    bestAction(sKey: string): {
        action: Action;
        value: number;
        secondBest: number;
    };
    toJSON(): Record<string, Record<string, number>>;
    static fromJSON(data: any): QTable;
}
export declare function learnQLearning(q: QTable, exp: Experience, cfg: QConfig): void;
