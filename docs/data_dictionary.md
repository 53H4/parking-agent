# Parking Agent - Data Dictionary

Each row in `dataset.csv` represents one parking episode performed by the Q-learning agent.

## Dataset location

Active dataset:

`apps/server/data/_live/dataset.csv`

Checkpoint dataset:

`apps/server/data/<N>_episodes/dataset.csv`

Each checkpoint dataset is paired with its corresponding `agent_state.json`.

## Columns

| # | Column | Type | Description |
|---|--------|------|-------------|
| 1 | `ID` | Integer | Episode identifier. Excluded from training. |
| 2 | `ObstacleCount` | Numeric | Total number of obstacles. |
| 3 | `PathObstacles` | Numeric | Obstacles in the start-to-target corridor. Redundant with `ObstacleCount`. |
| 4 | `ParkedDensity` | Numeric | Parked-car density for the episode. |
| 5 | `RoadDensity` | Numeric | Road-obstacle density for the episode. |
| 6 | `EpsilonStart` | Numeric | Exploration rate at the start of the episode. |
| 7 | `ExperienceEpisodes` | Numeric | Number of previously completed episodes. |
| 8 | `ExperienceLevel` | Categorical | `Novice`, `Intermediate`, or `Expert`. |
| 9 | `ApproachStyle` | Categorical | `Cautious`, `Moderate`, or `Aggressive`. |
| 10 | `EarlyRewardSum` | Numeric, nullable | Reward sum during the first six steps. |
| 11 | `EarlyExploreRate` | Numeric | Exploration rate during the first six steps. |
| 12 | `EarlyProgress` | Numeric | Distance reduction during the first six steps. |
| 13 | `DifficultyScore` | Ordinal 0–5 | Episode difficulty score. |
| 14 | `EarlyMomentumScore` | Ordinal 0–5 | Early progress score. |
| 15 | `EarlyCautionScore` | Ordinal 0–5 | Early caution score. |
| 16 | `ExplorationBalanceScore` | Ordinal 0–5 | Exploration balance score. |
| 17 | `QConfidenceScore` | Ordinal 0–5 | Agent decision-confidence score. |
| 18 | `TotalSteps` | Numeric | Total episode steps. Leaky feature. |
| 19 | `DetourSteps` | Numeric, nullable | Steps beyond the optimal path for successful episodes. Leaky feature. |
| 20 | `DominantDirection` | Categorical | `Horizontal`, `Vertical`, or `Balanced`. |
| 21 | `GridTheme` | Categorical | `Day` or `Night`. Noise feature. |
| 22 | `Outcome` | Categorical | `GOAL`, `COLLISION`, or `MAX_STEPS`. Leaky feature. |
| 23 | `ParkingSuccess` | Binary target | `Parked` or `NotParked`. |

## Training preparation

Exclude:

- `ID`
- `Outcome`
- `TotalSteps`
- `DetourSteps`
- `GridTheme`
- `PathObstacles`

Impute missing `EarlyRewardSum` values using the median.

Encode categorical features:

- `ExperienceLevel`
- `ApproachStyle`
- `DominantDirection`

Target encoding:

- `Parked` → `1`
- `NotParked` → `0`