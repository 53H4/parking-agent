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
  // simple “context”: 4-neighborhood blocked?
  blocked: {
    up: boolean; down: boolean; left: boolean; right: boolean;
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
