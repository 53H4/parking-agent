export interface IPerceptionSource<TPercept> {
  sense(): Promise<TPercept | null>;
}

export interface IPolicy<TPercept, TAction> {
  decide(percept: TPercept): Promise<TAction>;
}

export interface IActuator<TAction, TResult> {
  act(action: TAction): Promise<TResult>;
}

export interface ILearningComponent<TExperience> {
  learn(experience: TExperience): Promise<void>;
}

export abstract class SoftwareAgent<TPercept, TAction, TResult, TExperience> {
  abstract step(): Promise<TResult | null>;
}
