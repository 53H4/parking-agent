import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { FileStorage, ParkingAgentRunner } from "@pkg/parking-agent";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// jednostavan CORS za UI na portu 5173
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();
  next();
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const storage = new FileStorage(path.join(__dirname, "../data"));

const runner = new ParkingAgentRunner(
  {
    env: { width: 18, height: 9, parkedDensity: 0.6, maxSteps: 120 },
    q: { alpha: 0.2, gamma: 0.95, epsilon: 0.8, epsilonMin: 0.05, epsilonDecay: 0.995 },
    persistEveryEpisodes: 5
  },
  storage
);

// pomoćna funkcija za slanje preko WS‑a
function broadcast(obj: any) {
  const msg = JSON.stringify(obj);
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(msg);
  }
}

let running = false;
let delayMs = 60;

async function loop() {
  while (running) {
    const tick = await runner.step();
    if (tick) broadcast({ type: "TICK", payload: tick });
    else broadcast({ type: "NOWORK" });

    await new Promise(res => setTimeout(res, delayMs));
  }
}

app.get("/api/state", (_req, res) => {
  res.json(runner.getState());
});

app.post("/api/start", async (_req, res) => {
  if (!running) {
    running = true;
    loop();
  }
  res.json({ running: true });
});

app.post("/api/stop", (_req, res) => {
  running = false;
  res.json({ running: false });
});

// resetiraj samo epizodu (Q‑tablica ostaje)
app.post("/api/reset", (_req, res) => {
  runner.resetEpisode();
  res.json({ ok: true });
});

// potpuno resetiraj agentov mozak (Q‑tablicu + statistiku + epsilon)
app.post("/api/resetAll", (_req, res) => {
  runner.resetAll();
  res.json({ ok: true });
});

// izvezi stanje (Q‑tablicu) kao JSON
app.get("/api/exportState", (_req, res) => {
  const payload = JSON.stringify(runner.exportState(), null, 2);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=parking-agent-state.json");
  res.send(payload);
});

// učitaj stanje iz JSON‑a
app.post("/api/loadState", (req, res) => {
  try {
    runner.loadState(req.body);
    storage.save(req.body); // spremi odmah
    res.json({ ok: true });
  } catch (e: any) {
    res.status(400).json({ ok: false, error: e?.message ?? "Invalid JSON" });
  }
});

app.post("/api/speed", (req, res) => {
  const v = Number(req.body?.delayMs);
  if (Number.isFinite(v) && v >= 5 && v <= 500) delayMs = v;
  res.json({ delayMs });
});

server.listen(3001, () => {
  console.log("Server running on http://localhost:3001");
});
