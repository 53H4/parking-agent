import fs from "node:fs";
import path from "node:path";
import { QTable } from "../application/qlearning.js";
export class FileStorage {
    dir;
    constructor(dir) {
        this.dir = dir;
        fs.mkdirSync(dir, { recursive: true });
    }
    filePath() {
        return path.join(this.dir, "agent_state.json");
    }
    load() {
        const fp = this.filePath();
        if (!fs.existsSync(fp))
            return null;
        const raw = fs.readFileSync(fp, "utf-8");
        return JSON.parse(raw);
    }
    save(data) {
        fs.writeFileSync(this.filePath(), JSON.stringify(data, null, 2), "utf-8");
    }
    /** Obriši spremljeni JSON (koristi se u resetAll). */
    delete() {
        const fp = this.filePath();
        if (fs.existsSync(fp))
            fs.unlinkSync(fp);
    }
    loadQTable() {
        const p = this.load();
        return QTable.fromJSON(p?.qtable);
    }
}
