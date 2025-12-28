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
  Exports the **current learned state** of the agent to a `.json` file.

- 📥 **Load**  
  Loads a previously exported `.json` file and continues learning from that state.

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
│   ├── server/
│   │   ├── src/
│   │   │   └── index.ts
│   │   └── data/
│   │       └── agent_state.json
│   └── ui/
│       ├── index.html
│       ├── vite.config.ts
│       └── src/
│           ├── App.tsx
│           ├── main.tsx
│           └── styles.css
├── packages/
│   ├── ai-agents-core/
│   │       ├── dist/
│   │       ├── src/
│   │       
│   └── parking-agent/
├── package.json
└── tsconfig.base.json

```

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

### 🖥️ Run the Backend Server

Continue in opened terminal and run:

1. cd apps/server

2. npm install

3. npm run dev

The backend server will start on: http://localhost:3001

### 🎨 Run the Frontend UI

Open a second terminal and run:

1. cd apps/ui

2. npm install

3. npm run dev

The UI will be available at: http://localhost:5173


## 📦 State Persistence

The agent’s learned knowledge can be saved and restored:

Agent knowledge is stored as a JSON snapshot

The Export button saves the current learning state

The Load button restores a previously exported state

The server keeps the currently active agent state in memory

This allows:

continuing learning across sessions,

experimenting with different parameters,

comparing learning progress.

## 🎓 Educational Value

This project demonstrates key concepts from Artificial Intelligence and Reinforcement Learning, including:

Reinforcement Learning fundamentals

Q-Learning algorithm in practice

Exploration vs. exploitation trade-offs

Reward-based decision making

Clean AI-agent architecture

Separation of concerns (UI, server, agent)

Real-time visualization of agent behavior and learning progress

## ⚠️ Disclaimer

This project is intended for educational and experimental purposes only.

It is not optimized for production use

Environment and parameters are simplified for learning clarity

Behavior may vary depending on configuration and randomness

## 🙏 Acknowledgements

Built as a university AI-agent project

Uses AI-assisted development tools (LLMs) for faster iteration and experimentation

Inspired by classic reinforcement learning environments and grid-based simulations

