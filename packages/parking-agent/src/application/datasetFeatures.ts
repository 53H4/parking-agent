import { EpisodeRecord } from "../domain/types.js";

/** Episode training metrics. */
export type EpisodeAccumulator = {
  episodeId: number;
  experienceEpisodes: number;
  epsilonStart: number;

  obstacleCount: number;
  pathObstacles: number;
  parkedDensity: number;
  roadDensity: number;
  startDistance: number;

  totalMoves: number;
  exploreMoves: number;
  horiz: number;
  vert: number;
  sumQGap: number;
  closer: number;
  prevDist: number;

  // First 6 steps.
  earlyRewards: number[];
  earlyExplore: boolean[];
  earlyDist: number[];

  steps: number;
  reason: "GOAL" | "COLLISION" | "MAX_STEPS" | "MOVE";
};

export function newAccumulator(
  episodeId: number,
  experienceEpisodes: number,
  epsilonStart: number,
  obstacleCount: number,
  pathObstacles: number,
  parkedDensity: number,
  roadDensity: number,
  startDistance: number
): EpisodeAccumulator {
  return {
    episodeId,
    experienceEpisodes,
    epsilonStart,
    obstacleCount,
    pathObstacles,
    parkedDensity,
    roadDensity,
    startDistance,
    totalMoves: 0,
    exploreMoves: 0,
    horiz: 0,
    vert: 0,
    sumQGap: 0,
    closer: 0,
    prevDist: startDistance,
    earlyRewards: [],
    earlyExplore: [],
    earlyDist: [],
    steps: 0,
    reason: "MOVE"
  };
}

const clamp5 = (v: number) => Math.max(0, Math.min(5, Math.round(v)));

export function experienceLevel(exp: number): string {
  if (exp < 3000) return "Novice";
  if (exp < 12000) return "Intermediate";
  return "Expert";
}

export function approachStyle(eps: number): string {
  if (eps < 0.25) return "Cautious";
  if (eps > 0.55) return "Aggressive";
  return "Moderate";
}

export function dominantDirection(horiz: number, vert: number): string {
  if (horiz > vert * 1.3) return "Horizontal";
  if (vert > horiz * 1.3) return "Vertical";
  return "Balanced";
}

/** Build the final episode record. */
export function buildEpisodeRecord(
  acc: EpisodeAccumulator,
  gridTheme: string,
  earlyRewardMissing: boolean
): EpisodeRecord {
  const totalMoves = Math.max(1, acc.totalMoves);
  const exploreRate = acc.exploreMoves / totalMoves;

  const earlyN = Math.max(1, acc.earlyExplore.length);
  const earlyExploreRate = Math.round((acc.earlyExplore.filter(Boolean).length / earlyN) * 1000) / 1000;
  const earlyRewardSum = acc.earlyRewards.reduce((a, b) => a + b, 0);
  const earlyProgress =
    acc.earlyDist.length > 1 ? acc.earlyDist[0] - acc.earlyDist[acc.earlyDist.length - 1] : 0;

  // Optimal path to target.
  const optimal = acc.startDistance;
  const isGoal = acc.reason === "GOAL";

  return {
    ID: acc.episodeId,

    ObstacleCount: acc.obstacleCount,
    PathObstacles: acc.pathObstacles,
    ParkedDensity: acc.parkedDensity,
    RoadDensity: acc.roadDensity,

    EpsilonStart: Math.round(acc.epsilonStart * 10000) / 10000,
    ExperienceEpisodes: acc.experienceEpisodes,
    ExperienceLevel: experienceLevel(acc.experienceEpisodes),
    ApproachStyle: approachStyle(acc.epsilonStart),

    EarlyRewardSum: earlyRewardMissing ? null : earlyRewardSum,
    EarlyExploreRate: earlyExploreRate,
    EarlyProgress: earlyProgress,

    DifficultyScore: clamp5((5 * (acc.parkedDensity - 0.25)) / 0.55),
    EarlyMomentumScore: clamp5((earlyProgress + 3) / 2),
    EarlyCautionScore: clamp5(5 * (1 - earlyExploreRate)),
    ExplorationBalanceScore: clamp5(5 * (1 - Math.abs(exploreRate - 0.3) / 0.7)),
    QConfidenceScore: clamp5(5 * (1 - Math.min(1, acc.sumQGap / totalMoves / 3))),

    TotalSteps: acc.steps,
    DetourSteps: isGoal ? Math.max(0, acc.steps - optimal) : null,

    DominantDirection: dominantDirection(acc.horiz, acc.vert),
    GridTheme: gridTheme,

    Outcome: (acc.reason === "MOVE" ? "MAX_STEPS" : acc.reason) as EpisodeRecord["Outcome"],
    ParkingSuccess: isGoal ? "Parked" : "NotParked"
  };
}