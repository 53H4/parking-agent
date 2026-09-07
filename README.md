# 🚗 Parking Agent

**Parking Agent** is an educational AI project that demonstrates a **reinforcement learning agent (Q-Learning)** operating in a simplified parking-lot environment.

The project is implemented as a **TypeScript monorepo** with a clear separation between:
- AI logic (agent & learning),
- backend server (state persistence & control),
- frontend UI (visualization & interaction).

> ⚠️ Note: This project was developed with **AI-assisted tooling (LLMs)** for learning and experimentation purposes.

---

## 🎯 Project Goal

The goal of the agent is to **learn how to reach a selected parking spot** by navigating through a parking lot with:
- parked cars,
- a driving lane (road),
- a target parking position.

The agent improves its behavior over time using **Q-Learning**, based on rewards and penalties.

---

## ✨ Features

### 🤖 AI Agent
- Q-Learning based reinforcement learning agent
- Discrete environment (grid-based parking lot)
- Exploration vs exploitation (epsilon-greedy strategy)
- Persistent learning state (export / load)

### 🖥️ User Interface
- Real-time parking visualization
- Car icons, road, parking slots, and target spot
- Clean, modern dashboard UI

### 🧠 Live Monitoring
Two real-time information panels:
- **Live Tick**
- **Learning Statistics**

---

## 🚀 Getting Started

Follow the steps below to run the **Parking Agent** locally.

---

### 📋 Prerequisites

Make sure you have the following installed:

- **Node.js** (recommended: LTS version)
- **npm** (comes with Node.js)

---

### 📦 Install Dependencies

From the **project root**:

```bash
npm install
```

---

### 🖥️ Run the Backend Server

Continue in opened terminal and run:

1. cd apps/server

2. npm install

3. npm run dev

---

### 🎨 Run the Frontend UI

Open a second terminal and run:

1. cd apps/ui

2. npm install

3. npm run dev

The UI will be available at: http://localhost:5173

---

## 🎮 UI Controls (Actions)

The UI exposes the following **controls**:

- ▶️ **Start**  
  Starts the agent learning / running loop.

- 🔁 **Reset Episode**  
  Resets only the **current episode** (agent position),  
  keeping the learned knowledge.

- ♻️ **Reset All**  
  Fully resets the agent:
  - clears learned Q-table,
  - starts learning from scratch.

- ⏱️ **Tick delay (ms)**  
  Textbox to control how fast the agent performs steps (milliseconds per tick).

- 📤 **Export**  
  Saves the current live session (Q-table **+** its matching CSV dataset **+**
  ML report, if one was generated) as a permanent **checkpoint** folder under
  `apps/server/data/<episodes>_episodes/`, and immediately offers a `.zip`
  download of that same folder.

- 📥 **Load**  
  Shows a list of saved checkpoints (episode count, row count, date). Clicking
  one copies its json+csv+report back into the live working folder and
  continues learning from exactly that point — dataset and agent are always
  loaded **together**, so they can never end up mismatched.

---

## 📊 Information Panels

### 🔴 Live Tick
Displays data for the **current step**:
- Last action
- Last reward
- Reason (MOVE / GOAL / COLLISION / MAX_STEPS)
- Episode number
- Step number

### 🟢 Learning
Displays **overall learning statistics**:
- Episodes completed
- Success rate
- Current epsilon value

---

## 🧠 Learning Loop (Concept)


The agent follows a classic RL loop:

Sense → Think → Act → Learn


1. **Sense** – observe the current environment state  
2. **Think** – choose an action (epsilon-greedy)  
3. **Act** – move in the environment  
4. **Learn** – update Q-values based on reward  

This loop repeats continuously while the agent is running.

---

## 🏗️ Architecture Overview

The project follows a **clean, modular architecture**:

- **UI (React + Vite)**  
  - Visualization only  
  - No learning logic inside the frontend  

- **Server (Node.js + TypeScript)**  
  - Controls execution (start / stop / reset)  
  - Persists and loads agent state  

- **Agent Packages**  
  - Reinforcement learning logic  
  - Environment rules  
  - Q-Learning implementation  

This separation ensures:
- clean responsibility boundaries,
- easy extension and experimentation,
- compliance with academic AI-agent architecture requirements.

---

## 📁 Project Structure

```txt
parking-agent/
├── apps/
│   ├── server/                # Node.js + TS backend (kontrola/persistencija)
│   │   ├── analysis/          # analyze_report.py (ML) + zip_folder.py (checkpoint zip)
│   │   └── data/
│   │       ├── _live/         # radna sesija: agent_state.json + dataset.csv (+ report/)
│   │       └── <N>_episodes/  # trajni checkpointi (napravi ih dugme Export)
│   └── ui/                    # React + Vite UI (vizualizacija)
│
├── data/                      # stari referentni snapshotovi (van app-a, samo za uvid)
├── packages/                  # Agent paketi
│   ├── ai-agents-core/        # zajednički tipovi/utili (core)
│   │   ├── dist/
│   │   └── src/
│   │
│   └── parking-agent/         # RL agent + okruženje + Q-table + checkpoint logika
│       ├── dist/
│       │   ├── application/
│       │   ├── domain/
│       │   ├── infrastructure/
│       │   ├── index.js
│       │   └── index.d.ts
│       │
│       └── src/
│           ├── application/
│           ├── domain/
│           ├── infrastructure/    # storage, DatasetLogger, checkpoints
│           └── index.ts
│
├── docs/                      # dokumentacija (ovaj fajl)
├── package.json
└── tsconfig.base.json


```

---

## 📦 State Persistence — checkpoints (json + csv together)

Earlier versions kept the agent's Q-table (`.json`) and its ML dataset
(`.csv`) as two independent files/exports. That let them drift out of sync:
loading a `.json` didn't bring its matching `.csv` along, and `Reset All`
could wipe the dataset with no way back. This is fixed by treating storage
as **checkpoint folders**, not loose files.

**Where things live**, under `apps/server/data/`:

- **`_live/`** — the working session. `Start`/`Stop`/`Reset Episode` update
  it continuously (`agent_state.json` + `dataset.csv`, and `report/` once you
  generate an ML report). This is what the server actually runs on.
- **`<N>_episodes/`** — permanent checkpoints, one per `Export` click (`N` =
  episode count at export time). Contains the exact same three things,
  frozen. `Reset All` only clears `_live` — checkpoints are never touched.

**Flow:**

- **Export** → copies `_live/` into `data/<N>_episodes/` (overwriting a
  checkpoint at the same episode count) and offers a `.zip` download.
- **Load** → pick a checkpoint from the list; its json+csv+report are copied
  back into `_live/` and training continues from there — always as a
  matched pair.
- **Reset All** → clears only `_live/` (with a confirmation prompt); any
  exported checkpoints remain on disk.
- **`npm run train`** (headless) writes straight into `_live/` by default
  and automatically creates a checkpoint when it finishes, so a training run
  is never left only in the easily-cleared working folder.
- **Upgrading from an older copy of this project**: if the server finds the
  old flat `agent_state.json` + `dataset.csv` directly under `data/` (no
  `_live/` yet), it moves them into `_live/` and checkpoints them on first
  boot — automatically, once. Note this only *relocates* whatever CSV rows
  already exist on disk; it can't recover episodes that a previous version
  never wrote to `dataset.csv` in the first place.

This allows:

- continuing learning across sessions with dataset and agent always in sync,
- keeping multiple named snapshots (e.g. 5 000 vs 30 000 episodes) side by
  side to compare,
- generating an ML report for a specific checkpoint's dataset with certainty
  about which agent it describes.

---

## 📊 Dataset Generation (ML)

Pored JSON snapshot-a (Q-tablica = "mozak" agenta), agent sada generiše i
**CSV dataset** na kojem se mogu raditi klasični ML zadaci (deskriptivna
statistika, korelacija, train/test split, klasifikacija, evaluacijske metrike).

- **Granularnost:** jedan red = jedna epizoda (jedan pokušaj parkiranja).
- **Cilj (target):** `ParkingSuccess` (`Parked` / `NotParked`).
- **Struktura:** miješani tipovi (numeričko / ordinalno 0–5 / kategorijsko),
  jedan redundantan par kolona, kolone s nedostajućim vrijednostima i leaky
  kolone — namjerno **analogno** datasetu *airline_passenger_satisfaction*.
- Puni opis svih kolona: [`docs/data_dictionary.md`](docs/data_dictionary.md).

### Kako se generiše

Domain randomization: svaka epizoda dobije nasumičnu težinu mape
(`randomizeDifficulty: true` u konfiguraciji servera/trenera), pa ishod realno
ovisi o težini + vještini agenta.

**Opcija A — kroz UI/server (uživo):**
- pokreni server i UI, klikni **Start**,
- dataset se puni u `apps/server/data/_live/dataset.csv` (uvijek uz svoj
  `agent_state.json` u istom folderu),
- klik na **Export** pravi trajan checkpoint (`apps/server/data/<N>_episodes/`)
  i odmah nudi ZIP za preuzimanje (json + csv + report zajedno).

**Opcija B — headless trener (brzo, preporučeno za veliki dataset):**

```bash
cd apps/server
npm run train            # 30 000 epizoda → apps/server/data/_live/
                          # + automatski checkpoint apps/server/data/30000_episodes/
npm run train -- 50000   # proizvoljan broj epizoda
npm run train -- 30000 ./out   # proizvoljan folder (bez auto-checkpointa)
```

Trener ispiše i kratak profil; uz dataset snima i `agent_state.json` (Q-snapshot),
a kad piše u podrazumijevanu lokaciju automatski napravi i checkpoint folder.

### Referentni profil (30 000 epizoda)

| Metrika | RandomForest | LogisticRegression |
|---|---|---|
| Accuracy | ≈ 0.894 | ≈ 0.880 |
| F1 | ≈ 0.917 | ≈ 0.906 |
| AUC | ≈ 0.948 | ≈ 0.940 |

Balans cilja ≈ 62% `Parked` / 38% `NotParked`. RandomForest blago nadmašuje
LogisticRegression (nelinearna prednost).

### Izvještaj na klik (u aplikaciji)

Dugme **„Generiši izvještaj"** u UI-u pokreće kompletnu ML analizu nad AKTIVNIM
(`_live/dataset.csv`) datasetom i odmah prikaže rezultate inline (tabela RF vs LR,
ROC, feature importance, distribucija cilja), uz dugme za preuzimanje cijelog
izvještaja kao ZIP (9 grafova + PROCESSED csv + Word izvještaj u IB250211
formatu). Ako poslije toga klikneš **Export**, taj isti izvještaj se kopira
zajedno sa json-om i csv-om u checkpoint folder — pa svaki checkpoint nosi i
svoj tacan izvještaj.

Backend za ovo poziva Python skriptu `apps/server/analysis/analyze_report.py`,
pa na mašini koja vrti server trebaju biti instalirane biblioteke:

```bash
pip install pandas scikit-learn matplotlib seaborn python-docx
```

Server sam proba `python` pa `python3` (radi bez podešavanja i na Windowsu i
na Linux/macOS-u); po potrebi se moze postaviti i `PYTHON_BIN` varijabla
okruženja. Word korak je opcionalan — bez `python-docx` izvještaj se svejedno
generiše (grafovi + csv), samo bez .docx.

Radi tek kad ima dovoljno epizoda i obje klase (na početku su skoro sve kolizije;
treba bar 500 epizoda u aktivnom `_live/dataset.csv`).

---

## 💡 Idea Discussion

The initial idea was to build a system that demonstrates more than a simple
input → output application.

Several alternatives were considered:
- a static pathfinding algorithm,
- a rule-based parking assistant,
- a supervised learning classifier.

These approaches were rejected because they do not model behavior over time.

The final choice was a reinforcement learning agent that:
- exists continuously in an environment,
- acts iteratively through time,
- learns from experience rather than fixed rules.

This makes the system a true intelligent agent rather than an analytical tool.

---

## 🧠 Agent Type

The Parking Agent is a combination of:

- **Goal-oriented agent**  
  The agent has a clearly defined goal: reaching the selected parking spot.

- **Learning agent**  
  The agent adapts its behavior over time using Q-Learning,
  improving its policy based on experience and rewards.

This combination was chosen because the task requires both
goal optimization and adaptation through interaction with the environment.

---

## 🔁 Agent Cycle: Sense → Think → Act → Learn

- **Sense**  
  The agent observes the current world state:
  grid size, obstacles, target position, and its own position.

- **Think**  
  Based on the current state, the agent selects an action using
  an epsilon-greedy Q-learning policy.

- **Act**  
  The agent executes the selected action (UP, DOWN, LEFT, RIGHT)
  which changes its position in the environment.

- **Learn**  
  After receiving a reward, the agent updates its Q-table,
  improving future decisions based on experience.

---

## 🔮 Possible Extensions

Potential extensions considered for this project include:

- allowing the user to select the target parking spot before learning starts,
- storing the selected parking spot together with the learned state,
- context-aware behavior depending on parking position,
- multiple agents competing for parking spots.

These ideas were discussed but not fully implemented
due to project scope and time constraints.

---

## 🤖 Use of LLMs

Large Language Models (LLMs) were used as a thinking partner during the project.

They were used for:
- discussing and refining the initial agent idea,
- comparing different types of agents,
- evaluating whether the system qualifies as an intelligent agent,
- reviewing architecture decisions and identifying improvements,
- refining the UI and visualization quality.

Multiple iterations were performed instead of accepting the first solution,
allowing critical evaluation and gradual refinement of the design.

---

## 🎓 Educational Value

This project demonstrates key concepts from Artificial Intelligence and Reinforcement Learning, including:

 - Reinforcement Learning fundamentals

 - Q-Learning algorithm in practice

 - Exploration vs. exploitation trade-offs

 - Reward-based decision making

 - Clean AI-agent architecture

 - Separation of concerns (UI, server, agent)

 - Real-time visualization of agent behavior and learning progress

---

## ⚠️ Disclaimer

 - This project is intended for educational and experimental purposes only.

 - It is not optimized for production use

 - Environment and parameters are simplified for learning clarity

 - Behavior may vary depending on configuration and randomness

---

## 🙏 Acknowledgements

 - Built as a university AI-agent project

 - Uses AI-assisted development tools (LLMs) for faster iteration and experimentation

 - Inspired by classic reinforcement learning environments and grid-based simulations

