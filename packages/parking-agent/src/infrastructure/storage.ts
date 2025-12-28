import fs from "node:fs";
import path from "node:path";
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

export class FileStorage {
  constructor(private dir: string) {
    fs.mkdirSync(dir, { recursive: true });
  }

  private filePath() {
    return path.join(this.dir, "agent_state.json");
  }

  load(): Persisted | null {
    const fp = this.filePath();
    if (!fs.existsSync(fp)) return null;
    const raw = fs.readFileSync(fp, "utf-8");
    return JSON.parse(raw);
  }

  save(data: Persisted) {
    fs.writeFileSync(this.filePath(), JSON.stringify(data, null, 2), "utf-8");
  }

  /** Obriši spremljeni JSON (koristi se u resetAll). */
  delete() {
    const fp = this.filePath();
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  }

  loadQTable(): QTable {
    const p = this.load();
    return QTable.fromJSON(p?.qtable);
  }
}
