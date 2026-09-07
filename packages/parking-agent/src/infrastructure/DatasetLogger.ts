import fs from "node:fs";
import path from "node:path";
import { EpisodeRecord } from "../domain/types.js";

/** CSV logger for episode records. */
export const DATASET_COLUMNS: (keyof EpisodeRecord)[] = [
  "ID",
  "ObstacleCount",
  "PathObstacles",
  "ParkedDensity",
  "RoadDensity",
  "EpsilonStart",
  "ExperienceEpisodes",
  "ExperienceLevel",
  "ApproachStyle",
  "EarlyRewardSum",
  "EarlyExploreRate",
  "EarlyProgress",
  "DifficultyScore",
  "EarlyMomentumScore",
  "EarlyCautionScore",
  "ExplorationBalanceScore",
  "QConfidenceScore",
  "TotalSteps",
  "DetourSteps",
  "DominantDirection",
  "GridTheme",
  "Outcome",
  "ParkingSuccess"
];

function cell(v: unknown): string {
  if (v === null || v === undefined) return "";

  const s = String(v);

  // Escape CSV values.
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return '"' + s.replace(/"/g, '""') + '"';
  }

  return s;
}

export class DatasetLogger {
  private filePath: string;
  private cachedRows: number | null = null;

  constructor(dir: string, fileName = "dataset.csv") {
    fs.mkdirSync(dir, { recursive: true });
    this.filePath = path.join(dir, fileName);
  }

  getFilePath(): string {
    return this.filePath;
  }

  private header(): string {
    return DATASET_COLUMNS.join(",") + "\n";
  }

  private countRowsFromFile(): number {
    if (!fs.existsSync(this.filePath)) return 0;
    const txt = fs.readFileSync(this.filePath, "utf-8").trim();
    if (!txt) return 0;
    return Math.max(0, txt.split("\n").length - 1);
  }

  /** Append one episode record. */
  append(rec: EpisodeRecord): void {
    const needHeader = !fs.existsSync(this.filePath) || fs.statSync(this.filePath).size === 0;
    if (needHeader) fs.writeFileSync(this.filePath, this.header(), "utf-8");

    const line = DATASET_COLUMNS.map(c => cell(rec[c])).join(",") + "\n";
    fs.appendFileSync(this.filePath, line, "utf-8");

    this.cachedRows = this.cachedRows === null
      ? this.countRowsFromFile()
      : this.cachedRows + 1;
  }

  /** Append multiple episode records. */
  appendMany(recs: EpisodeRecord[]): void {
    if (recs.length === 0) return;

    const needHeader = !fs.existsSync(this.filePath) || fs.statSync(this.filePath).size === 0;
    let buf = needHeader ? this.header() : "";

    for (const rec of recs) {
      buf += DATASET_COLUMNS.map(c => cell(rec[c])).join(",") + "\n";
    }

    fs.appendFileSync(this.filePath, buf, "utf-8");

    this.cachedRows = this.cachedRows === null
      ? this.countRowsFromFile()
      : this.cachedRows + recs.length;
  }

  /** Read the full dataset. */
  readAll(): string {
    if (!fs.existsSync(this.filePath)) return this.header();
    return fs.readFileSync(this.filePath, "utf-8");
  }

  /** Get cached row count. */
  rowCount(): number {
    if (this.cachedRows === null) {
      this.cachedRows = this.countRowsFromFile();
    }

    return this.cachedRows;
  }

  /** Invalidate the row count cache. */
  invalidateCache(): void {
    this.cachedRows = null;
  }

  /** Clear the dataset. */
  clear(): void {
    if (fs.existsSync(this.filePath)) fs.unlinkSync(this.filePath);
    this.cachedRows = 0;
  }
}