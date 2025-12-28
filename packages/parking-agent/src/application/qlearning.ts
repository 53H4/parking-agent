import { Action, Experience } from "../domain/types.js";

export type QConfig = {
  alpha: number;
  gamma: number;
  epsilon: number;
  epsilonMin: number;
  epsilonDecay: number; // multiply each episode
};

export class QTable {
  private q = new Map<string, Map<Action, number>>();

  get(sKey: string, a: Action): number {
    const row = this.q.get(sKey);
    if (!row) return 0;
    return row.get(a) ?? 0;
  }

  set(sKey: string, a: Action, v: number) {
    let row = this.q.get(sKey);
    if (!row) {
      row = new Map<Action, number>();
      this.q.set(sKey, row);
    }
    row.set(a, v);
  }

  bestAction(sKey: string): { action: Action; value: number; secondBest: number } {
    const actions = Object.values(Action);
    let bestA = actions[0];
    let bestV = this.get(sKey, bestA);
    let second = -Infinity;

    for (const a of actions) {
      const v = this.get(sKey, a);
      if (v > bestV) {
        second = bestV;
        bestV = v;
        bestA = a;
      } else if (v > second && a !== bestA) {
        second = v;
      }
    }
    if (second === -Infinity) second = bestV;
    return { action: bestA, value: bestV, secondBest: second };
  }

  toJSON() {
    const obj: Record<string, Record<string, number>> = {};
    for (const [s, row] of this.q.entries()) {
      obj[s] = {};
      for (const [a, v] of row.entries()) obj[s][a] = v;
    }
    return obj;
  }

  static fromJSON(data: any): QTable {
    const t = new QTable();
    if (!data || typeof data !== "object") return t;
    for (const s of Object.keys(data)) {
      for (const a of Object.keys(data[s])) {
        t.set(s, a as Action, Number(data[s][a]));
      }
    }
    return t;
  }
}

export function learnQLearning(q: QTable, exp: Experience, cfg: QConfig) {
  const { sKey, action, reward, nextSKey, done } = exp;
  const oldQ = q.get(sKey, action);
  const nextBest = done ? 0 : q.bestAction(nextSKey).value;
  const target = reward + cfg.gamma * nextBest;
  const updated = oldQ + cfg.alpha * (target - oldQ);
  q.set(sKey, action, updated);
}
