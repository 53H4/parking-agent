# 🚗 Parking Agent

**Parking Agent** is an educational AI project that demonstrates a **reinforcement learning agent (Q-Learning)** operating in a simplified parking-lot environment, alongside an integrated classification pipeline that predicts the outcome of each episode.

The project is implemented as a **TypeScript monorepo** with a clear separation between:
- AI logic (agent & learning),
- backend server (state persistence & control),
- frontend UI (visualization & interaction).

---

## 🎯 Project Goal

The goal of the agent is to **learn how to reach a selected parking spot** by navigating through a parking lot with:
- parked cars,
- a driving lane (road),
- a target parking position.

The agent improves its behavior over time using **Q-Learning**, based on rewards and penalties. Reaching the target cell ends the episode immediately — the agent parks and stays there until the next episode starts.

---

## ✨ Features

### 🤖 AI Agent
- Q-Learning based reinforcement learning agent
- Discrete environment (grid-based parking lot)
- Exploration vs exploitation (epsilon-greedy strategy)
- Domain randomization: obstacle/parking density varies per episode, so outcomes depend on both map difficulty and agent skill
- Persistent learning state (export / load)

### 📊 Integrated ML Analysis
- Each episode is logged as one row of a growing CSV dataset
- On-demand classification report comparing **Random Forest**, **Logistic Regression**, and **Gradient Boosting**
- **5-fold stratified cross-validation** for all three models (mean ± standard deviation per metric)
- Feature importance, ROC curves, confusion matrices, correlation analysis
- One-click Word report generation

### 🖥️ User Interface
- Real-time parking visualization
- Car icons, road, parking slots, and target spot
- Grouped toolbar (simulation / data / analysis), with destructive actions visually marked
- Clean, modern dashboard UI (Bosnian labels)

### 🧠 Live Monitoring
Two real-time information panels:
- **Trenutna aktivnost** (Live Tick) — last action, last reward, outcome, episode, step
- **Učenje** (Learning) — total episodes, success rate, current epsilon

---

## 🚀 Getting Started

Follow the steps below to run the **Parking Agent** locally.

### 📋 Prerequisites

- **Node.js** (recommended: LTS version)
- **npm** (comes with Node.js)
- **Python 3** with `pandas`, `scikit-learn`, `matplotlib`, `seaborn`, and optionally `python-docx` (for the ML report)

### 📦 Install Dependencies

From the **project root**:

```bash
npm install
```

### 🖥️ Run the Backend Server

```bash
cd apps/server
npm install
npm run dev
```

### 🎨 Run the Frontend UI

Open a second terminal:

```bash
cd apps/ui
npm install
npm run dev
```

The UI will be available at: http://localhost:5173

---

## 🎮 UI Controls (Actions)

- ▶️ **Start** — starts the agent's learning/running loop.
- 🔁 **Reset Episode** — resets only the **current episode** (agent position), keeping the learned knowledge.
- ♻️ **Reset All** — fully resets the agent (clears the Q-table, starts learning from scratch). Before clearing, an automatic timestamped safety backup of `_live/` is written to `apps/server/data/_tmp/backup_<timestamp>/` (the 5 most recent backups are kept). This is a safety net, not a checkpoint — it does not appear in the Load list.
- ⏱️ **Tick delay (ms)** — controls how fast the agent performs steps.
- 📤 **Export** — saves the current live session (`agent_state.json` + `dataset.csv`) as a permanent **checkpoint** folder under `apps/server/data/<episodes>_episodes/`, and offers a `.zip` download of that folder. The ML report is intentionally **not** included in checkpoints (see [State Persistence](#-state-persistence--checkpoints-json--csv-together) below). Export refuses to overwrite a checkpoint that already holds more rows than the current live dataset, and warns if the episode count and row count diverge significantly — both are signs that something upstream didn't sync correctly.
- 📥 **Load** — shows a list of saved checkpoints (episode count, row count, date). Selecting one clears the live folder first, then copies the checkpoint's `agent_state.json` + `dataset.csv` back into it, so training continues from exactly that point with dataset and agent always matched — never mixed with a leftover file from whatever was loaded before.

---

## 📊 Information Panels

### 🔴 Trenutna aktivnost (Live Tick)
- Last action
- Last reward
- Ishod — human-readable outcome (Parkiran / Sudar / Isteklo vrijeme / U toku), derived from the underlying `GOAL` / `COLLISION` / `MAX_STEPS` / `MOVE` reason codes
- Episode number
- Step number

### 🟢 Učenje (Learning)
- Episodes completed
- Success rate
- Current epsilon value

---

## 🧠 Learning Loop (Concept)

The agent follows a classic RL loop:

```
Sense → Think → Act → Learn
```

1. **Sense** – observe the current environment state
2. **Think** – choose an action (epsilon-greedy)
3. **Act** – move in the environment (UP, DOWN, LEFT, RIGHT)
4. **Learn** – update Q-values based on reward

An episode ends the instant the agent's move lands it on the target cell — the agent stays parked there, and the reward for reaching the goal is granted immediately (earlier versions required a second "return" step due to a reward-shaping issue; this has since been corrected).

---

## 🏗️ Architecture Overview

- **UI (React + Vite)** — visualization only, no learning logic inside the frontend.
- **Server (Node.js + TypeScript)** — controls execution (start/stop/reset), persists and loads agent state.
- **Agent Packages** — reinforcement learning logic, environment rules, Q-Learning implementation.

This separation keeps responsibility boundaries clean and makes the system easy to extend or experiment with.

---

## 📁 Project Structure

```txt
parking-agent/
├── apps/
│   ├── server/                # Node.js + TS backend (control/persistence)
│   │   ├── analysis/          # analyze_report.py (ML) + zip_folder.py (checkpoint zip)
│   │   └── data/
│   │       ├── _live/         # working session: agent_state.json + dataset.csv (+ report/ once generated)
│   │       ├── _tmp/          # zip staging + automatic Reset All backups
│   │       └── <N>_episodes/  # permanent checkpoints (agent_state.json + dataset.csv only)
│   └── ui/                    # React + Vite UI (visualization)
│
├── packages/
│   ├── ai-agents-core/        # shared types/utilities (core)
│   └── parking-agent/         # RL agent + environment + Q-table + checkpoint logic
│       └── src/
│           ├── application/
│           ├── domain/
│           └── infrastructure/    # storage, DatasetLogger, checkpoints
│
├── docs/                      # project documentation
├── package.json
└── tsconfig.base.json
```

---

## 📦 State Persistence — checkpoints (json + csv together)

Storage is organized as **checkpoint folders**, not loose files, so the agent's Q-table and its dataset can never silently drift apart.

**Where things live**, under `apps/server/data/`:

- **`_live/`** — the working session. `Start`/`Stop`/`Reset Episode` update it continuously (`agent_state.json` + `dataset.csv`). Once you click **"Generiši izvještaj"**, a `report/` folder appears here too — but only here, never in a checkpoint.
- **`<N>_episodes/`** — permanent checkpoints, one per `Export` click. Contains just `agent_state.json` + `dataset.csv`, frozen at that episode count.
- **`_tmp/`** — zip staging space, plus timestamped Reset All backups (`backup_<timestamp>/`, last 5 kept).

**Why the report isn't stored in checkpoints:** the ML report is always generated against whatever dataset is currently active in `_live/`. Bundling a report into a checkpoint meant that loading an older checkpoint could bring along a report describing a completely different dataset — and there was no way to tell the two apart just by looking at the folder. The report is cheap to regenerate on demand, so checkpoints now hold only what actually needs to stay in sync: agent state and its dataset.

**Flow:**

- **Export** → copies `_live/`'s `agent_state.json` + `dataset.csv` into `data/<N>_episodes/` and offers a `.zip` download. Refuses to overwrite a checkpoint that already has more data than the current live session.
- **Load** → clears `_live/` first (dataset, state, and any old report), then copies the checkpoint's files in — training continues from there as a matched pair.
- **Reset All** → takes an automatic backup, then clears only `_live/`; checkpoints are never touched.
- **`npm run train`** (headless) writes straight into `_live/` and creates a checkpoint automatically when finished.
- **Upgrading from an older copy**: if the server finds a legacy flat `agent_state.json` + `dataset.csv` directly under `data/` (no `_live/` yet), it moves them into `_live/` and checkpoints them on first boot, automatically, once.

---

## 📊 Dataset Generation (ML)

Alongside the JSON snapshot (Q-table = the agent's "brain"), the agent generates a **CSV dataset** for classic ML tasks (descriptive statistics, correlation, train/test split, classification, evaluation).

- **Granularity:** one row = one episode (one parking attempt).
- **Target:** `ParkingSuccess` (`Parked` / `NotParked`).
- **Structure:** mixed types (numeric / ordinal 0–5 / categorical), one redundant column pair, columns with missing values, and leaky columns (deliberately included to practice recognizing and removing data leakage).
- Full column reference: [`docs/data_dictionary.md`](docs/data_dictionary.md).

### How it's generated

Domain randomization (`randomizeDifficulty: true`) gives every episode a random map difficulty, so the outcome genuinely depends on both difficulty and skill.

**Option A — through the UI/server (live):**
- start the server and UI, click **Start**,
- the dataset fills `apps/server/data/_live/dataset.csv` alongside `agent_state.json`,
- **Export** freezes the current state as a checkpoint and offers a `.zip` download.

**Option B — headless trainer (fast, recommended for large datasets):**

```bash
cd apps/server
npm run train                  # writes into apps/server/data/_live/ + auto-checkpoint
npm run train -- 50000         # custom episode count
npm run train -- 30000 ./out   # custom output folder (no auto-checkpoint)
```

### Example profile (~31,000 episodes)

Exact numbers vary between training runs; this is one reference point.

| Metric | Random Forest | Logistic Regression | Gradient Boosting |
|---|---|---|---|
| Accuracy | ≈ 0.879 | ≈ 0.865 | ≈ 0.882 |
| F1 | ≈ 0.902 | ≈ 0.892 | ≈ 0.904 |
| AUC-ROC | ≈ 0.943 | ≈ 0.930 | ≈ 0.948 |

Target balance ≈ 60% `Parked` / 40% `NotParked`. Both tree ensembles outperform the linear model, with Gradient Boosting slightly ahead of Random Forest. A 5-fold cross-validation of all three models confirms these differences are consistent across folds (AUC standard deviation ≤ 0.005 for every model in this reference run) rather than an artifact of one particular train/test split.

### One-click report (in the app)

The **"Generiši izvještaj"** button runs a full ML analysis over the ACTIVE (`_live/dataset.csv`) dataset and displays results inline: a table comparing all three models, top features, and five charts (ROC comparison, metric comparison, feature importance, target distribution, and cross-validation results). A button next to it offers the complete report as a ZIP (12 charts + processed CSV + Word report).

The backend calls `apps/server/analysis/analyze_report.py`, so the machine running the server needs:

```bash
pip install pandas scikit-learn matplotlib seaborn python-docx
```

The server tries `python` then `python3` automatically; `PYTHON_BIN` can be set explicitly if needed. `python-docx` is optional — without it the report still generates (charts + CSV), just without the `.docx`.

The analysis requires enough data to be meaningful: at least 500 episodes in `_live/dataset.csv`, with at least 50 examples of each outcome class.

---

## 💡 Idea Discussion

The initial idea was to build a system that demonstrates more than a simple input → output application. Alternatives considered included a static pathfinding algorithm, a rule-based parking assistant, and a supervised learning classifier — all rejected because they don't model behavior over time.

The final choice was a reinforcement learning agent that exists continuously in an environment, acts iteratively through time, and learns from experience rather than fixed rules.

---

## 🧠 Agent Type

The Parking Agent combines:

- **Goal-oriented agent** — has a clearly defined goal: reaching the selected parking spot.
- **Learning agent** — adapts its behavior over time using Q-Learning, improving its policy based on experience and rewards.

---

## 🔁 Agent Cycle: Sense → Think → Act → Learn

- **Sense** — observes grid size, obstacles, target position, and its own position.
- **Think** — selects an action using an epsilon-greedy Q-learning policy.
- **Act** — executes the action, changing its position.
- **Learn** — updates its Q-table based on the reward received.

---

## 🔮 Possible Extensions

- letting the user pick the target parking spot before learning starts,
- storing the selected spot together with the learned state,
- context-aware behavior depending on parking position,
- multiple agents competing for parking spots,
- neural function approximation (DQN) for larger, continuous environments.

---

## 🎓 Educational Value

This project touches on: reinforcement learning fundamentals, the Q-learning algorithm in practice, exploration vs. exploitation, reward-based decision making, data leakage recognition, model comparison and cross-validation, clean agent architecture, and real-time visualization of learning progress.

---

## ⚠️ Disclaimer

- Intended for educational and experimental purposes only.
- Not optimized for production use.
- Environment and parameters are simplified for learning clarity.
- Behavior may vary depending on configuration and randomness.

---

## 🙏 Acknowledgements

- Built as a university AI-agent project.
- Development was assisted by AI tools for iteration and refinement.
