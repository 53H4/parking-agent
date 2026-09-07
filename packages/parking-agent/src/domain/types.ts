export type GridPos = { x: number; y: number };

export type WorldState = {
  width: number;
  height: number;
  obstacles: GridPos[];
  target: GridPos;
  agent: GridPos;
  steps: number;
  episode: number;
  done: boolean;
  lastReward: number;
  parked?: boolean;

  // Episode difficulty.
  parkedDensityUsed?: number;
  roadDensityUsed?: number;
};

export enum Action {
  UP = "UP",
  DOWN = "DOWN",
  LEFT = "LEFT",
  RIGHT = "RIGHT"
}

export type Percept = {
  agent: GridPos;
  target: GridPos;

  // Adjacent obstacles.
  blocked: {
    up: boolean;
    down: boolean;
    left: boolean;
    right: boolean;
  };

  done: boolean;
};

export type Experience = {
  sKey: string;
  action: Action;
  reward: number;
  nextSKey: string;
  done: boolean;
};

export type TickResult = {
  episode: number;
  step: number;
  action: Action;
  reward: number;
  done: boolean;
  reason?: "GOAL" | "COLLISION" | "MAX_STEPS" | "MOVE";
  state: WorldState;
  stats: {
    totalEpisodes: number;
    successEpisodes: number;
    collisionEpisodes: number;
    successRate: number;
    epsilon: number;
  };
};

/** Dataset record for one episode. */
export type EpisodeRecord = {
  ID: number;

  // Environment.
  ObstacleCount: number;
  PathObstacles: number;
  ParkedDensity: number;
  RoadDensity: number;

  // Agent state.
  EpsilonStart: number;
  ExperienceEpisodes: number;
  ExperienceLevel: string;
  ApproachStyle: string;

  // Early behavior.
  EarlyRewardSum: number | null;
  EarlyExploreRate: number;
  EarlyProgress: number;

  // Scores.
  DifficultyScore: number;
  EarlyMomentumScore: number;
  EarlyCautionScore: number;
  ExplorationBalanceScore: number;
  QConfidenceScore: number;

  // Trajectory.
  TotalSteps: number;
  DetourSteps: number | null;

  // Categories.
  DominantDirection: string;
  GridTheme: string;

  // Outcome.
  Outcome: "GOAL" | "COLLISION" | "MAX_STEPS";
  ParkingSuccess: "Parked" | "NotParked";
};