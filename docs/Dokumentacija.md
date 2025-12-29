# 🚗 Parking Agent – Dokumentacija

## Sadržaj

1. [Uvod](#uvod)
2. [Pregled projekta](#pregled-projekta)
3. [Arhitektura (UI / Server / Agent)](#arhitektura-ui--server--agent)
4. [Q-Learning (koncept i implementacija)](#q-learning-koncept-i-implementacija)
5. [API backend (kontrola & persistencija)](#api-backend-kontrola--persistencija)
6. [UI (kontrole, vizualizacija, info paneli)](#ui-kontrole-vizualizacija-info-paneli)
7. [Razvoj sa AI asistentom (promptovi + odgovori)](#razvoj-sa-ai-asistentom-promptovi--odgovori)
8. [Kompletni ključni fajlovi (kod)](#kompletni-kljucni-fajlovi-kod)
9. [Zaključak](#zakljucak)

---

## Uvod

**Parking Agent** je edukativni projekat koji demonstrira *inteligentnog agenta* u diskretnom okruženju parking-lota. Agent koristi **reinforcement learning (Q-Learning)** da kroz epizode nauči kako doći do ciljanog parking mjesta. Projekat je implementiran kao **TypeScript monorepo** (UI + server + agent paketi) kako bi se jasno vidjela separacija odgovornosti.

Cilj dokumentacije je da prikaže:
- šta projekat radi,
- kako je organizovan (arhitektura),
- kako agent uči (Q-learning),
- kako se projekat pokreće,
- te kako je korišten AI asistent tokom razvoja (promptovi + odgovori + generisani kod).


---

## Pregled projekta

### Glavna ideja
Parking-lot je predstavljen kao **grid** (mreža polja). U mreži postoje:
- **parkirana vozila** (prepreke),
- **put/vozna traka** (dozvoljena polja kretanja),
- **ciljno parking mjesto** (GOAL).
Agent se pomjera diskretnim akcijama (UP/DOWN/LEFT/RIGHT) i dobija nagrade/kazne. Kazne dobija ako se sudari sa drugim automobilom a nagradu ukoliko se uspješno parkira na predefinirano parking mjesto. Zbog kompleksnosti I da bi agent imao više prostora da uči odlučio sam se da ciljno parking mjesto bude na kraju parkinga tako da bi agent morao što više da se potrudi I što više pokušaja da ima da bi uspješno naučio kako da se parkira na to predefinirano mjesto.

Ključna funkcionalnost Parking Agenta je sposobnost samostalnog učenja optimalnog ponašanja u dinamičnom okruženju kroz iterativni agentički ciklus (Sense → Think → Act → Learn), s ciljem da dosegne ciljano parking mjesto bez sudara i u što manjem broju koraka.
Agent ne koristi unaprijed definisana pravila kretanja niti statičke putanje. Umjesto toga, on kroz vlastito iskustvo gradi politiku ponašanja koristeći Q-Learning, gdje svaka akcija utiče na buduće odluke.
Kroz više epizoda, agent:
-	opaža trenutno stanje parking okruženja (pozicija, prepreke, cilj),
-	donosi odluku o narednom potezu,
-	izvršava akciju u okruženju,
-	uči iz posljedica svojih odluka putem sistema nagrada i kazni.
Ovakav pristup omogućava agentu da adaptira ponašanje kroz vrijeme, poboljšava uspješnost parkiranja i generalizuje naučeno znanje na nove epizode, čime sistem predstavlja istinskog inteligentnog softverskog agenta, a ne klasičnu analitičku ili determinističku aplikaciju.


### Pokretanje (lokalno)
U root folderu:
```bash
npm install
```

Backend:
```bash
cd apps/server
npm install
npm run dev
```

Frontend:
```bash
cd apps/ui
npm install
npm run dev
```

Backend se pokreće na `http://localhost:3001`, a UI na `http://localhost:5173`.

### Struktura repozitorija

```txt
parking-agent/
├── apps/
│   ├── server/         # Node.js + TS backend (kontrola/persistencija)
│   └── ui/               # React + Vite UI (vizualizacija)
│
├── packages/         # Agent paketi
│   ├── ai-agents-core/        # zajednički tipovi/utili (core)
│   │   ├── dist/
│   │   └── src/
│   │
│   └── parking-agent/         # RL agent + okruženje + Q-table
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
│           ├── infrastructure/
│           └── index.ts
│
├── docs/              # dokumentacija (ovaj fajl)
├── package.json
└── tsconfig.base.json

```


---

## Arhitektura (UI / Server / Agent)

Projekat je namjerno razdvojen u 3 sloja:

1) **UI (React)** – samo prikaz i kontrole (Start/Reset/Export/Load, tick delay, paneli). UI ne radi Q-learning.
2) **Server (Node.js + TS)** – drži trenutno stanje simulacije u memoriji, izvodi tick-loop, izlaže REST API i radi persistenciju (save/load).
3) **Agent paketi (packages)** – čista logika: okruženje (pravila), agent (epsilon-greedy), Q-table, reward funkcije i serializacija.

Ovakva separacija omogućava: lakše testiranje, jasnu distinkciju vizualizacija vs inteligencija i jednostavno proširenje.


---

## Q-Learning (koncept i implementacija)

### Agent ciklus: Sense → Think → Act → Learn
- **Sense (Perception)**: agent očita stanje.
- **Think**: odabere akciju epsilon-greedy.
- **Act**: okruženje primijeni akciju i vrati (nextState, reward, reason).
- **Learn**: update Q vrijednosti:

```text
Q(s,a) ← Q(s,a) + α * ( r + γ * max_a' Q(s',a') − Q(s,a) )
```

### Reward sistem
Tipično: mali negativan reward za običan potez, veliki pozitivan za GOAL, velika kazna za COLLISION, te stop uslovi (MAX_STEPS).


---

## API backend (kontrola & persistencija)
Server izlaže endpoint-e koje UI koristi: start/stop loop, reset epizode i reset svega, tick delay, export/load stanja i dohvat statistike.


---

## UI (kontrole, vizualizacija, info paneli)
UI renderuje grid parking-lota i pruža kontrole (Start, Reset Episode, Reset All, Tick delay, Export/Load) te info panele: Live Tick i Learning Statistics.


---

## Razvoj sa AI asistentom (promptovi + odgovori)

> Napomena: Ispod su **ključni promptovi** (3–4 najbitnija) koji reprezentuju tok razvoja i način komunikacije sa AI asistentom.

### Prompt 1: Generisanje osnovne monorepo aplikacije (UI + Server + Q-Learning agent) – Dakle nakon što sam obavio razgovor, razmijenio više poruka I utvrdio šta ću raditi kao AI agenta za naš predmet moj prvi prompt je bio:
**Prompt:**
> Napravi TS monorepo (apps/ui + apps/server + packages/parking-agent) gdje agent uči Q-learningom u grid parking lotu. UI samo vizualizuje. U prethodnim porukama sam ti jasno i koncizno objasnio koji su kriteriji koje ovaj projekat mora zadovoljiti tako da želim da mi generiraš osnovnu strukturu projekta + copy/paste kodove za sve fajlove. 

**Odgovor (sažetak):** Predložena struktura, osnovni env + qtable + agent, server API za stanje i UI za prikaz. – Nakon što mi je ai sve generirao, sve fajlove sam ručno kreirao i uradio copy/paste kod. Nakon što sam pokrenuo app sve je uredno radilo međutim to nije ličilo ni na šta. Aplikacija je bila vrlo vrlo ružnog UI izgleda te mi se činilo da agent nikada neće uspjeti parkirati automobile na predefinisano mjesto. Stoga sam imao mnogo iteracija I razmjena poruka gdje sam nakon nekog vremena uspio riješiti oba problema. Uspio sam popraviti UI izgled tako da aplikacija izgleda vrlo pristojno + agent je zaista krenuo učiti I sada već nakon nekih 700 epizoda uspjeva uspješno parkirati auto u predefinirano parking mjesto. Sve sam radio ručno jer sam se odlučio za ovaj put koristiti ChatGPT plus verziju (ne cursor ili nešto drugo) te sam zbog toga kreiranje inicijalnih fajlova I svaku kasniju izmjenu morao raditi ručno

### Prompt 2: Start/Stop + Reset Episode/All + Tick delay
**Prompt:**
> Dodaj Start/Stop loop, Reset Episode (bez brisanja Q-table), Reset All (brisanje svega) i tick delay u ms.

**Odgovor (sažetak):** Runner na serveru drži stanje i interval; reset metode i podešavanje delay-a. – Nakon što je aplikacija krenula raditi ono što sam od nje očekivao na red je došlo dodavanje nekih novih funkcionalnosti. Prve na redu su bile Start/stop system I reset episode funkcionalnosti. 

### Prompt 3: Export / Load (persistencija)
**Prompt:**
> Dodaj Export/Load da se Q-table i statistika sačuvaju u JSON i kasnije učitaju.

**Odgovor (sažetak):** Serializacija + server endpointi + UI dugmad. – Nakon što sam napravio osnovne funkcionalnosti za svog ai agenta onda sam odlučio da bi bilo super imati funkcionalnosti kao što su Export/Load. Tako da sa jednim klikom mogu exportovati trenutno znanje mog agenta ili pomoću Load da učitam već naučeno znanje preko .json fajla I tako testirati da li sve uredno radi. 

### Prompt 4: UI dorade + info paneli
**Prompt:**
> Uljepšaj UI i dodaj Live Tick i Learning Statistics panele, ali learning ostaje u packages/server sloju.

**Odgovor (sažetak):** Dashboard layout + prikaz akcije/rewarda/statistike kroz server state. – Na samom kraju nakon što sam doveo agenta u red odlučio sam da finaliziram svoj UI tako što ću mu dodati info panele sa desne strane tako da u svakom trenutku korisnik može live pratiti određene parameter kao što su: Last action, Last reward, Reason, Episode i Step. Ispod live panela sam se odlučio da također dodam I Learning panel tako da u svakom trenutku korisnik može vidjeti Koliko je ukupno epizoda u trenutno učitanom .json fajlu to jeste q-tabeli I statistici. 


---

## Kompletni ključni fajlovi (kod)

### `package.json`

```json
{
  "name": "parking-agent-monorepo",
  "private": true,
  "workspaces": [
    "packages/*",
    "apps/*"
  ],
  "scripts": {
    "build": "npm run build -ws",
    "build:pkgs": "npm run build -w packages/ai-agents-core && npm run build -w packages/parking-agent",
    "dev": "npm run dev -w apps/server",
    "dev:ui": "npm run dev -w apps/ui"
  }
}
```

### `tsconfig.base.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "Bundler",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

### `apps/server/src/index.ts`

```ts
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

// Minimal CORS so the Vite UI (5173) can call the API (3001)
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
    // Parking-lot layout: parked cars in top/bottom rows, road corridor in the middle.
    // NOTE: the parked cars are *obstacles*, but the border is handled by bounds checking
    // (so you don't get a "frame" of cars).
    env: { width: 18, height: 9, parkedCarsTop: 6, parkedCarsBottom: 6, maxSteps: 120 },
    q: { alpha: 0.2, gamma: 0.95, epsilon: 0.8, epsilonMin: 0.05, epsilonDecay: 0.995 },
    persistEveryEpisodes: 5
  },
  storage
);

// WebSocket broadcast helper
function broadcast(obj: any) {
  const msg = JSON.stringify(obj);
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(msg);
  }
}

// Thin host loop (NO business logic here)
let running = false;
let delayMs = 60;

async function loop() {
  while (running) {
    const tick = await runner.step(); // shared brain decides everything
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

app.post("/api/reset", (_req, res) => {
  runner.resetEpisode();
  res.json({ ok: true });
});

// Export/Import "learned knowledge" (Q-table + stats + epsilon) as JSON
app.get("/api/exportState", (_req, res) => {
  // Serve as a downloadable JSON file (works even without client-side blob logic)
  const payload = JSON.stringify(runner.exportState(), null, 2);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=parking-agent-state.json");
  res.send(payload);
});

app.post("/api/loadState", (req, res) => {
  try {
    runner.loadState(req.body);
    // persist immediately so next start continues with loaded data
    storage.save(req.body);
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
```

### `apps/ui/src/App.tsx`

```tsx
import { useEffect, useMemo, useRef, useState } from "react";

type GridPos = { x: number; y: number };

type WorldState = {
  width: number;
  height: number;
  obstacles: GridPos[];
  target: GridPos;
  agent: GridPos;
  steps: number;
  episode: number;
  done: boolean;
  lastReward: number;
  reason?: string;
};

type TickResult = {
  action: "UP" | "DOWN" | "LEFT" | "RIGHT";
  reward: number;
  done: boolean;
  reason: "GOAL" | "COLLISION" | "MAX_STEPS" | "MOVE";
  state: WorldState;
  stats: {
    totalEpisodes: number;
    successEpisodes: number;
    collisionEpisodes: number;
    successRate: number;
    epsilon: number;
  };
};

const API = "http://localhost:3001";

function downloadJson(filename: string, obj: any) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  // Some browsers require the element to be in the DOM.
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke after the click has been processed.
  setTimeout(() => URL.revokeObjectURL(url), 250);
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [running, setRunning] = useState(false);
  const [delayMs, setDelayMs] = useState(60);
  const [lastTick, setLastTick] = useState<TickResult | null>(null);
  const [world, setWorld] = useState<WorldState | null>(null);
  const [status, setStatus] = useState<string>("Disconnected");

  // Preload UI assets
  const assets = useMemo(() => {
    const bg = new Image();
    bg.src = "/parking-bg.svg";
    const car = new Image();
    car.src = "/car.svg";
    const target = new Image();
    target.src = "/target.svg";
    return { bg, car, target };
  }, []);

  // Initial fetch (so UI is not blank before first WS tick)
  useEffect(() => {
    fetch(`${API}/api/state`)
      .then(r => r.json())
      .then(setWorld)
      .catch(() => setStatus("API not reachable"));
  }, []);

  // WebSocket stream
  useEffect(() => {
    const ws = new WebSocket("ws://localhost:3001");

    ws.onopen = () => setStatus("Connected");
    ws.onclose = () => setStatus("Disconnected");
    ws.onerror = () => setStatus("WebSocket error");

    ws.onmessage = ev => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg?.type === "TICK") {
          setLastTick(msg.payload as TickResult);
          setWorld((msg.payload as TickResult).state);
        }
        if (msg?.type === "NOWORK") {
          // ignore
        }
        if (msg?.type === "LOADED") {
          setStatus("Loaded snapshot");
        }
      } catch {
        // ignore
      }
    };

    return () => ws.close();
  }, []);

  // Canvas draw
  useEffect(() => {
    if (!world) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = world.width;
    const h = world.height;

    // Fit a non-square grid nicely inside a fixed canvas width.
    // We prefer a wide canvas, but keep height compact.
    const maxCanvasW = 560;
    const maxCanvasH = 420;
    const cell = Math.floor(Math.min(maxCanvasW / w, maxCanvasH / h));
    const canvasW = cell * w;
    const canvasH = cell * h;
    canvas.width = canvasW;
    canvas.height = canvasH;

    // --- Background (parking lot) ---
    // Layout convention (matches env.ts):
    // top parked row = 2, bottom parked row = h - 3, road in between.
    const topRow = 2;
    const bottomRow = h - 3;

    // Base
    ctx.clearRect(0, 0, canvasW, canvasH);
    ctx.fillStyle = "#0b1320";
    ctx.fillRect(0, 0, canvasW, canvasH);

    // Card-like inner surface
    const pad = Math.max(6, Math.floor(cell * 0.25));
    const innerX = pad;
    const innerY = pad;
    const innerW = canvasW - pad * 2;
    const innerH = canvasH - pad * 2;

    // Parking surface
    ctx.fillStyle = "#f2f5f9";
    ctx.fillRect(innerX, innerY, innerW, innerH);

    // Road stripe (asphalt)
    const roadY = innerY + (topRow + 1) * cell;
    const roadH = (bottomRow - topRow - 1) * cell;
    ctx.fillStyle = "#cfd6e0";
    ctx.fillRect(innerX, roadY, innerW, roadH);

    // Lane dashed center line
    ctx.strokeStyle = "rgba(15,23,42,0.25)";
    ctx.lineWidth = Math.max(1, Math.floor(cell * 0.07));
    const midLaneY = innerY + Math.floor((topRow + bottomRow) / 2) * cell + cell / 2;
    ctx.setLineDash([Math.floor(cell * 0.6), Math.floor(cell * 0.35)]);
    ctx.beginPath();
    ctx.moveTo(innerX + Math.floor(cell * 0.35), midLaneY);
    ctx.lineTo(innerX + innerW - Math.floor(cell * 0.35), midLaneY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Parking slot separators (top + bottom)
    ctx.strokeStyle = "rgba(15,23,42,0.12)";
    ctx.lineWidth = Math.max(1, Math.floor(cell * 0.06));
    for (let x = 0; x <= w; x++) {
      const px = innerX + x * cell;
      // top
      ctx.beginPath();
      ctx.moveTo(px, innerY + topRow * cell);
      ctx.lineTo(px, innerY + (topRow + 1) * cell);
      ctx.stroke();
      // bottom
      ctx.beginPath();
      ctx.moveTo(px, innerY + bottomRow * cell);
      ctx.lineTo(px, innerY + (bottomRow + 1) * cell);
      ctx.stroke();
    }

    // Soft border
    ctx.strokeStyle = "rgba(15,23,42,0.18)";
    ctx.lineWidth = Math.max(2, Math.floor(cell * 0.08));
    ctx.strokeRect(innerX, innerY, innerW, innerH);

    // helper to draw a sprite centered in a cell, with optional rotation
    const drawSprite = (img: HTMLImageElement, p: GridPos, rotDeg: number, scale = 0.92) => {
      const cx = innerX + p.x * cell + cell / 2;
      const cy = innerY + p.y * cell + cell / 2;
      const w = cell * scale;
      const h = cell * scale;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((rotDeg * Math.PI) / 180);
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
      ctx.restore();
    };

    // target (parking spot): highlight + badge
    const targetPx = innerX + world.target.x * cell;
    const targetPy = innerY + world.target.y * cell;
    ctx.fillStyle = "rgba(16,185,129,0.18)";
    ctx.fillRect(targetPx, targetPy, cell, cell);
    ctx.strokeStyle = "rgba(16,185,129,0.55)";
    ctx.lineWidth = Math.max(2, Math.floor(cell * 0.08));
    ctx.strokeRect(targetPx + 1, targetPy + 1, cell - 2, cell - 2);
    if (assets.target.complete) {
      drawSprite(assets.target, world.target, 0, 0.8);
    } else {
      ctx.fillStyle = "#10b981";
      ctx.font = `700 ${Math.floor(cell * 0.42)}px ui-sans-serif`;
      ctx.fillText("P", targetPx + Math.floor(cell * 0.33), targetPy + Math.floor(cell * 0.68));
    }

    // obstacles = parked cars (only in top/bottom parking rows)
    for (const o of world.obstacles) {
      if (assets.car.complete) {
        // parked cars look better if rotated randomly 0/180
        const rot = (o.y + o.x) % 2 === 0 ? 0 : 180;
        // tint effect: draw with globalAlpha
        ctx.save();
        ctx.globalAlpha = 0.75;
        drawSprite(assets.car, o, rot, 0.88);
        ctx.restore();
      } else {
        ctx.fillStyle = "#64748b";
        ctx.fillRect(innerX + o.x * cell + 2, innerY + o.y * cell + 2, cell - 4, cell - 4);
      }
    }

    // agent car direction from last tick
    const dir = lastTick?.action ?? "RIGHT";
    const rot = dir === "UP" ? 0 : dir === "RIGHT" ? 90 : dir === "DOWN" ? 180 : 270;
    if (assets.car.complete) {
      drawSprite(assets.car, world.agent, rot, 0.95);
    } else {
      ctx.fillStyle = "#3b82f6";
      ctx.fillRect(innerX + world.agent.x * cell + 2, innerY + world.agent.y * cell + 2, cell - 4, cell - 4);
    }

    // HUD badge
    if (world.done) {
      ctx.fillStyle = "rgba(0,0,0,0.42)";
      ctx.fillRect(0, 0, canvasW, Math.max(34, Math.floor(cell * 0.9)));
      ctx.fillStyle = "#fff";
      ctx.font = "600 14px ui-sans-serif";
      ctx.fillText("Episode finished", 12, 22);
    }
  }, [world, lastTick, assets]);

  const stats = lastTick?.stats;
  const lastAction = lastTick?.action ?? "-";
  const lastReward = lastTick?.reward ?? 0;
  const reason = lastTick?.reason ?? "-";

  async function start() {
    await fetch(`${API}/api/start`, { method: "POST" });
    setRunning(true);
  }

  async function stop() {
    await fetch(`${API}/api/stop`, { method: "POST" });
    setRunning(false);
  }

  async function resetEpisode() {
    await fetch(`${API}/api/reset`, { method: "POST" });
  }

  async function updateSpeed(v: number) {
    setDelayMs(v);
    await fetch(`${API}/api/speed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ delayMs: v })
    });
  }

  async function exportSnapshot() {
    const data = await fetch(`${API}/api/exportState`).then(r => r.json());
    downloadJson(`parking-agent-snapshot.json`, data);
  }

  async function onLoadFile(file: File) {
    const text = await file.text();
    const json = JSON.parse(text);
    const res = await fetch(`${API}/api/loadState`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(json)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err?.error ?? "Invalid snapshot");
      return;
    }
    // refresh state
    const st = await fetch(`${API}/api/state`).then(r => r.json());
    setWorld(st);
  }

  return (
    <div className="page">
      <div className="shell">
        <div className="header">
          <div>
            <div className="title">Parking Learning Agent</div>
            <div className="subtitle">Q-Learning • Sense → Think → Act → Learn per tick</div>
          </div>
          <div className="pill">
            <span className="dot" />
            <span>{status}</span>
          </div>
        </div>

        <div className="grid">
          <div className="card">
            <div className="toolbar">
              {!running ? (
                <button className="btn primary" onClick={start}>Start</button>
              ) : (
                <button className="btn" onClick={stop}>Stop</button>
              )}
              <button className="btn" onClick={resetEpisode}>Reset Episode</button>

              <div className="spacer" />

              <label className="field">
                <span>Tick delay (ms)</span>
                <input
                  className="input"
                  type="number"
                  min={5}
                  max={500}
                  value={delayMs}
                  onChange={e => updateSpeed(Number(e.target.value))}
                />
              </label>

              <button className="btn" onClick={exportSnapshot}>Export</button>
              <button className="btn" onClick={() => fileRef.current?.click()}>Load</button>
              <input
                ref={fileRef}
                className="hidden"
                type="file"
                accept="application/json"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) onLoadFile(f);
                  e.currentTarget.value = "";
                }}
              />
            </div>

            <div className="boardWrap">
              <canvas ref={canvasRef} className="board" />
            </div>
          </div>

          <div className="card">
            <div className="sectionTitle">Live Tick</div>
            <div className="kv">
              <div className="k">Last action</div><div className="v">{lastAction}</div>
              <div className="k">Last reward</div><div className="v">{lastReward}</div>
              <div className="k">Reason</div><div className="v">{reason}</div>
              <div className="k">Episode</div><div className="v">{world?.episode ?? "-"}</div>
              <div className="k">Step</div><div className="v">{world?.steps ?? "-"}</div>
            </div>

            <div className="sectionTitle" style={{ marginTop: 16 }}>Learning</div>
            <div className="kv">
              <div className="k">Episodes</div><div className="v">{stats?.totalEpisodes ?? 0}</div>
              <div className="k">Success rate</div><div className="v">{((stats?.successRate ?? 0) * 100).toFixed(1)}%</div>
              <div className="k">Epsilon</div><div className="v">{(stats?.epsilon ?? 0).toFixed(3)}</div>
            </div>

            <div className="footnote">
              UI is a thin host: it only visualizes state and sends start/stop/reset/load commands.
              All decisions + learning happen in the shared runner.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### `apps/ui/src/styles.css`

```css
:root {
  --bg1: #050b17;
  --bg2: #071a38;
  --panel: rgba(255, 255, 255, 0.075);
  --panel2: rgba(255, 255, 255, 0.10);
  --border: rgba(255, 255, 255, 0.14);
  --text: rgba(255, 255, 255, 0.92);
  --muted: rgba(255, 255, 255, 0.65);
  --accent: #5aa2ff;
  --accent2: #2dd4bf;
  --shadow: 0 18px 60px rgba(0, 0, 0, 0.45);
  --radius: 18px;
}

* { box-sizing: border-box; }

html, body, #root {
  height: 100%;
}

body {
  margin: 0;
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji";
  color: var(--text);
  background: radial-gradient(1200px 600px at 30% 10%, rgba(90, 162, 255, 0.22), transparent 60%),
              radial-gradient(900px 500px at 75% 30%, rgba(45, 212, 191, 0.12), transparent 65%),
              linear-gradient(180deg, var(--bg2), var(--bg1));
}

.page {
  min-height: 100%;
  padding: 38px 18px 42px;
  display: flex;
  justify-content: center;
}

.shell {
  width: min(1180px, 100%);
  display: grid;
  grid-template-rows: auto 1fr;
  gap: 16px;
}

.topbar {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: start;
  gap: 16px;
}

.titleBlock h1 {
  margin: 0;
  font-size: 22px;
  letter-spacing: 0.2px;
}

.titleBlock .sub {
  margin-top: 6px;
  color: var(--muted);
  font-size: 13px;
}

.pill {
  align-self: start;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid var(--border);
  box-shadow: var(--shadow);
  color: var(--muted);
  font-size: 12px;
}

.pillDot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #ef4444;
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.18);
}

.pillDot.on {
  background: #22c55e;
  box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.18);
}

.grid {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 16px;
}

.panel {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  overflow: hidden;
}

.controls {
  padding: 14px 14px 12px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.btn {
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.06);
  color: var(--text);
  border-radius: 12px;
  padding: 8px 12px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 120ms ease, background 120ms ease, border-color 120ms ease;
}

.btn:hover { transform: translateY(-1px); border-color: rgba(255, 255, 255, 0.28); background: rgba(255, 255, 255, 0.085); }
.btn:active { transform: translateY(0px); }

.btn.primary {
  border-color: rgba(90, 162, 255, 0.55);
  background: rgba(90, 162, 255, 0.14);
}

.btn.primary:hover { background: rgba(90, 162, 255, 0.20); }

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.field {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.fieldLabel {
  color: var(--muted);
  font-size: 12px;
}

.field input {
  width: 90px;
  padding: 6px 8px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(0, 0, 0, 0.18);
  color: var(--text);
  outline: none;
}

.canvasWrap {
  display: flex;
  justify-content: center;
  padding: 18px;
}

.canvas {
  width: 100%;
  max-width: 720px;
  border-radius: 18px;
  background: rgba(0, 0, 0, 0.18);
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.30);
}

.sidebar {
  padding: 14px;
  display: grid;
  gap: 12px;
}

.section {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.10);
  border-radius: 16px;
  padding: 12px;
}

.sectionTitle {
  font-weight: 700;
  letter-spacing: 0.2px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.88);
  margin-bottom: 10px;
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.sectionTitle span {
  color: var(--muted);
  font-weight: 500;
  font-size: 12px;
}

.kv {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.kvItem {
  padding: 10px;
  border-radius: 14px;
  background: rgba(0, 0, 0, 0.16);
  border: 1px solid rgba(255, 255, 255, 0.10);
}

.k {
  display: block;
  font-size: 11px;
  color: var(--muted);
  margin-bottom: 6px;
}

.v {
  font-size: 14px;
  font-weight: 700;
}

.note {
  margin-top: 10px;
  font-size: 12px;
  color: var(--muted);
  line-height: 1.45;
}

.toast {
  position: fixed;
  bottom: 18px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.16);
  padding: 10px 12px;
  border-radius: 12px;
  color: var(--text);
  font-size: 12px;
  box-shadow: var(--shadow);
}

@media (max-width: 980px) {
  .grid { grid-template-columns: 1fr; }
}
```

### `apps/ui/src/main.tsx`

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

### `packages/parking-agent/src/application/qlearning.ts`

```ts
import { Action, Experience } from "../domain/types.js";

export type QConfig = {
  alpha: number;
  gamma: number;
  epsilon: number;
  epsilonMin: number;
  epsilonDecay: number; // multiply each episode
};

export class QTable {
  private q = new Map<string, Map<Action, number>>();

  get(sKey: string, a: Action): number {
    const row = this.q.get(sKey);
    if (!row) return 0;
    return row.get(a) ?? 0;
  }

  set(sKey: string, a: Action, v: number) {
    let row = this.q.get(sKey);
    if (!row) {
      row = new Map<Action, number>();
      this.q.set(sKey, row);
    }
    row.set(a, v);
  }

  bestAction(sKey: string): { action: Action; value: number; secondBest: number } {
    const actions = Object.values(Action);
    let bestA = actions[0];
    let bestV = this.get(sKey, bestA);
    let second = -Infinity;

    for (const a of actions) {
      const v = this.get(sKey, a);
      if (v > bestV) {
        second = bestV;
        bestV = v;
        bestA = a;
      } else if (v > second && a !== bestA) {
        second = v;
      }
    }
    if (second === -Infinity) second = bestV;
    return { action: bestA, value: bestV, secondBest: second };
  }

  toJSON() {
    const obj: Record<string, Record<string, number>> = {};
    for (const [s, row] of this.q.entries()) {
      obj[s] = {};
      for (const [a, v] of row.entries()) obj[s][a] = v;
    }
    return obj;
  }

  static fromJSON(data: any): QTable {
    const t = new QTable();
    if (!data || typeof data !== "object") return t;
    for (const s of Object.keys(data)) {
      for (const a of Object.keys(data[s])) {
        t.set(s, a as Action, Number(data[s][a]));
      }
    }
    return t;
  }
}

export function learnQLearning(q: QTable, exp: Experience, cfg: QConfig) {
  const { sKey, action, reward, nextSKey, done } = exp;
  const oldQ = q.get(sKey, action);
  const nextBest = done ? 0 : q.bestAction(nextSKey).value;
  const target = reward + cfg.gamma * nextBest;
  const updated = oldQ + cfg.alpha * (target - oldQ);
  q.set(sKey, action, updated);
}
```

### `packages/parking-agent/src/application/runner.ts`

```ts
import { SoftwareAgent } from "@pkg/ai-agents-core";
import { Action, Experience, TickResult, WorldState } from "../domain/types.js";
import { EnvConfig, createParkingWorld, stepWorld } from "./env.js";
import { buildPercept } from "./perception.js";
import { toStateKey } from "./stateKey.js";
import { QConfig, QTable, learnQLearning } from "./qlearning.js";
import { FileStorage, Persisted } from "../infrastructure/storage.js";

export type RunnerConfig = {
  env: EnvConfig;
  q: QConfig;
  persistEveryEpisodes: number;
};

export class ParkingAgentRunner extends SoftwareAgent<any, any, TickResult, Experience> {
  private world: WorldState;
  private qtable: QTable;
  private stats = { totalEpisodes: 0, successEpisodes: 0, collisionEpisodes: 0 };

  constructor(
    private cfg: RunnerConfig,
    private storage: FileStorage
  ) {
    super();

    // load persisted
    const persisted = storage.load();
    this.qtable = persisted ? QTable.fromJSON(persisted.qtable) : new QTable();
    if (persisted?.stats) this.stats = persisted.stats;
    if (persisted?.epsilon != null) this.cfg.q.epsilon = persisted.epsilon;

    // init episode
    const nextEpisode = (this.stats.totalEpisodes ?? 0) + 1;
    this.world = createParkingWorld(cfg.env, nextEpisode);
  }

  getState(): WorldState {
    return this.world;
  }

  /** Snapshot of agent "knowledge" (can be exported / imported as JSON). */
  exportState(): Persisted {
    return {
      qtable: this.qtable.toJSON(),
      stats: { ...this.stats },
      epsilon: this.cfg.q.epsilon
    };
  }

  /** Replace agent "knowledge" (Q-table + stats + epsilon) from a JSON snapshot. */
  loadState(p: Persisted) {
    this.qtable = QTable.fromJSON(p.qtable);
    this.stats = p.stats ?? { totalEpisodes: 0, successEpisodes: 0, collisionEpisodes: 0 };
    if (typeof p.epsilon === "number") this.cfg.q.epsilon = p.epsilon;

    // Restart the current episode so the UI immediately matches the new knowledge
    const nextEpisode = (this.stats.totalEpisodes ?? 0) + 1;
    this.world = createParkingWorld(this.cfg.env, nextEpisode);
  }

  resetEpisode() {
    const nextEpisode = this.stats.totalEpisodes + 1;
    this.world = createParkingWorld(this.cfg.env, nextEpisode);
  }

  // SENSE -> THINK -> ACT -> LEARN (one step)
  async step(): Promise<TickResult | null> {
    // SENSE
    const percept = buildPercept(this.world);
    if (percept.done) return null;

    const sKey = toStateKey(percept);

    // THINK (epsilon-greedy)
    const actions = Object.values(Action);
    let action: Action;

    const explore = Math.random() < this.cfg.q.epsilon;
    if (explore) {
      action = actions[Math.floor(Math.random() * actions.length)];
    } else {
      action = this.qtable.bestAction(sKey).action;
    }

    // ACT (apply to environment)
    const { world: newWorld, reward, done, reason } = stepWorld(
      this.world,
      action,
      this.cfg.env.maxSteps
    );

    // LEARN (Q-learning update)
    const nextPercept = buildPercept(newWorld);
    const nextSKey = toStateKey(nextPercept);

    learnQLearning(
      this.qtable,
      { sKey, action, reward, nextSKey, done },
      this.cfg.q
    );

    this.world = newWorld;

    // episode finished bookkeeping
    if (done) {
      this.stats.totalEpisodes += 1;
      if (reason === "GOAL") this.stats.successEpisodes += 1;
      if (reason === "COLLISION") this.stats.collisionEpisodes += 1;

      // adaptive epsilon
      this.cfg.q.epsilon = Math.max(
        this.cfg.q.epsilonMin,
        this.cfg.q.epsilon * this.cfg.q.epsilonDecay
      );

      if (this.stats.totalEpisodes % this.cfg.persistEveryEpisodes === 0) {
        this.storage.save({
          qtable: this.qtable.toJSON(),
          stats: this.stats,
          epsilon: this.cfg.q.epsilon
        });
      }

      // auto reset episode
      this.resetEpisode();
    }

    const successRate =
      this.stats.totalEpisodes === 0
        ? 0
        : this.stats.successEpisodes / this.stats.totalEpisodes;

    return {
      episode: this.world.episode,
      step: this.world.steps,
      action,
      reward,
      done,
      reason,
      state: this.world,
      stats: {
        ...this.stats,
        successRate,
        epsilon: this.cfg.q.epsilon
      }
    };
  }
}
```

### `packages/parking-agent/src/application/env.ts`

```ts
import { Action, GridPos, WorldState } from "../domain/types.js";

const same = (a: GridPos, b: GridPos) => a.x === b.x && a.y === b.y;

/**
 * Parking-lot environment (2D):
 * - Two parking rows (top + bottom) filled with parked cars (obstacles)
 * - A 2–3 cell "road" corridor in the middle where the agent can drive
 * - A single target parking spot (free) on the bottom row
 */
export type EnvConfig = {
  width: number;
  height: number;
  /** 0..1 how many parking slots (excluding target) are filled */
  parkedDensity: number;
  maxSteps: number;
  seed?: number;
};

function rand(seed: number) {
  // deterministic PRNG (mulberry32)
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function inBounds(p: GridPos, w: number, h: number) {
  return p.x >= 0 && p.y >= 0 && p.x < w && p.y < h;
}

function isObstacle(p: GridPos, obstacles: GridPos[]) {
  return obstacles.some(o => o.x === p.x && o.y === p.y);
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function layout(cfg: EnvConfig) {
  // Keep everything valid even for small sizes.
  const topParkY = 1;
  const bottomParkY = clamp(cfg.height - 2, 2, cfg.height - 1);
  // road corridor: rows between parking rows
  const roadMinY = topParkY + 1;
  const roadMaxY = bottomParkY - 1;
  const roadCenterY = Math.floor((roadMinY + roadMaxY) / 2);
  return { topParkY, bottomParkY, roadMinY, roadMaxY, roadCenterY };
}

export function createParkingLotWorld(cfg: EnvConfig, episode: number): WorldState {
  const { topParkY, bottomParkY, roadCenterY } = layout(cfg);

  const rng = rand((cfg.seed ?? 12345) + episode * 99991);

  // Target spot on bottom row, near the right.
  const target: GridPos = { x: cfg.width - 2, y: bottomParkY };

  // Agent starts on the road near the left.
  const agent: GridPos = { x: 1, y: roadCenterY };

  // Parking slots are x=1..width-2 (keep borders empty for "walls")
  const slotXs = [] as number[];
  for (let x = 1; x <= cfg.width - 2; x++) slotXs.push(x);

  const obstacles: GridPos[] = [];

  // Fill top parking row
  for (const x of slotXs) {
    const p = { x, y: topParkY };
    if (same(p, agent) || same(p, target)) continue;
    if (rng() < cfg.parkedDensity) obstacles.push(p);
  }

  // Fill bottom parking row (excluding the target spot so it stays free)
  for (const x of slotXs) {
    const p = { x, y: bottomParkY };
    if (same(p, agent) || same(p, target)) continue;
    if (rng() < cfg.parkedDensity) obstacles.push(p);
  }

  // Add a couple of random "pillars" in the road (optional, sparse)
  // This keeps learning interesting but still realistic.
  const pillarCount = Math.max(0, Math.floor(cfg.width * 0.08));
  for (let i = 0; i < pillarCount; i++) {
    const x = 2 + Math.floor(rng() * (cfg.width - 4));
    const y = (layout(cfg).roadMinY) + Math.floor(rng() * Math.max(1, (layout(cfg).roadMaxY - layout(cfg).roadMinY + 1)));
    const p = { x, y };
    if (!inBounds(p, cfg.width, cfg.height)) continue;
    if (same(p, agent) || same(p, target)) continue;
    if (obstacles.some(o => same(o, p))) continue;
    obstacles.push(p);
  }

  return {
    width: cfg.width,
    height: cfg.height,
    obstacles,
    target,
    agent,
    steps: 0,
    episode,
    done: false,
    lastReward: 0
  };
}

// Backwards-friendly name used by the runner
export function createParkingWorld(cfg: EnvConfig, episode: number): WorldState {
  return createParkingLotWorld(cfg, episode);
}

export function stepWorld(
  world: WorldState,
  action: Action,
  maxSteps: number
): { world: WorldState; reward: number; done: boolean; reason: "GOAL" | "COLLISION" | "MAX_STEPS" | "MOVE" } {
  if (world.done) {
    return { world, reward: 0, done: true, reason: "MOVE" };
  }

  const delta =
    action === Action.UP ? { x: 0, y: -1 } :
    action === Action.DOWN ? { x: 0, y: 1 } :
    action === Action.LEFT ? { x: -1, y: 0 } :
    { x: 1, y: 0 };

  const next = { x: world.agent.x + delta.x, y: world.agent.y + delta.y };
  let reward = -1; // small time penalty
  let done = false;
  let reason: "GOAL" | "COLLISION" | "MAX_STEPS" | "MOVE" = "MOVE";

  // collision or out of bounds = episode ends
  if (!inBounds(next, world.width, world.height) || isObstacle(next, world.obstacles)) {
    reward = -50;
    done = true;
    reason = "COLLISION";
  } else {
    // move happens
    world = { ...world, agent: next };
    // reaching goal ends episode
    if (same(next, world.target)) {
      reward = +100;
      done = true;
      reason = "GOAL";
    }
  }

  const steps = world.steps + 1;
  if (!done && steps >= maxSteps) {
    reward = -30;
    done = true;
    reason = "MAX_STEPS";
  }

  const newWorld: WorldState = {
    ...world,
    steps,
    done,
    lastReward: reward
  };

  return { world: newWorld, reward, done, reason };
}
```

### `packages/parking-agent/src/application/perception.ts`

```ts
import { Percept, WorldState } from "../domain/types.js";

export function buildPercept(world: WorldState): Percept {
  const { x, y } = world.agent;
  const isBlocked = (nx: number, ny: number) => {
    const out = nx < 0 || ny < 0 || nx >= world.width || ny >= world.height;
    if (out) return true;
    return world.obstacles.some(o => o.x === nx && o.y === ny);
  };

  return {
    agent: { ...world.agent },
    target: { ...world.target },
    blocked: {
      up: isBlocked(x, y - 1),
      down: isBlocked(x, y + 1),
      left: isBlocked(x - 1, y),
      right: isBlocked(x + 1, y)
    },
    done: world.done
  };
}
```

### `packages/parking-agent/src/application/stateKey.ts`

```ts
import { Percept } from "../domain/types.js";

// Very simple discrete state encoding.
// Includes agent pos, relative target direction, and 4 blocked flags.
export function toStateKey(p: Percept): string {
  const dx = Math.sign(p.target.x - p.agent.x); // -1,0,1
  const dy = Math.sign(p.target.y - p.agent.y);
  const b = p.blocked;
  return [
    `x${p.agent.x}`, `y${p.agent.y}`,
    `dx${dx}`, `dy${dy}`,
    `u${b.up?1:0}`, `d${b.down?1:0}`, `l${b.left?1:0}`, `r${b.right?1:0}`
  ].join("|");
}
```

### `packages/parking-agent/src/domain/types.ts`

```ts
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
```

### `packages/ai-agents-core/src/index.ts`

```ts
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
```


---
## Zaključak
Parking Agent predstavlja primjer inteligentnog softverskog agenta koji ispunjava ključne teorijske i tehničke zahtjeve savremenih agentičkih sistema. Kroz implementaciju learning agenta zasnovanog na Q-learning algoritmu, projekat demonstrira kako se autonomno ponašanje može razvijati kroz iterativni ciklus Sense → Think → Act → Learn, gdje svaka odluka utiče na buduće stanje znanja agenta.

Za razliku od klasičnih aplikacija koje funkcionišu po principu ulaz → izlaz, Parking Agent egzistira u simuliranom okruženju kroz vrijeme, kontinuirano opaža stanje okoline, donosi odluke, izvršava akcije i uči iz posljedica svog ponašanja. Time je jasno ispunjen osnovni kriterij da sistem bude agent, a ne samo analitička ili vizualna aplikacija.

Posebna pažnja posvećena je arhitektonskoj separaciji odgovornosti, gdje su:

-	korisnički interfejs ograničen na vizualizaciju i kontrolu izvršavanja,
-	serverski sloj zadužen za orkestraciju, stanje i perzistenciju,
-	agentička logika (odlučivanje i učenje) izolovana u zasebnom modulu.

Ovakav pristup osigurava čistu implementaciju agentičkog ciklusa, olakšava testiranje i omogućava buduća proširenja bez narušavanja postojećeg dizajna.

Dodatna vrijednost projekta ogleda se u mogućnosti exportovanja i ponovnog učitavanja naučenog stanja, čime se agentovo znanje tretira kao trajni artefakt, a ne prolazni rezultat izvršavanja. Time se omogućava analiza napretka učenja, poređenje različitih konfiguracija i nastavak učenja iz prethodnih epizoda.

Korištenje LLM-ova kao alata za razmišljanje, analizu i iterativni razvoj nije zamjena za dizajnerske odluke, već sredstvo za njihovo kritičko preispitivanje i poboljšanje. Projekat je razvijan kroz više iteracija, uz diskusiju ideje, razradu arhitekture, refaktorisanje i provjeru usklađenosti sa agentičkim principima.

U konačnici, Parking Agent ne demonstrira samo tehničku primjenu reinforcement learninga, već i ispravan proces dizajna inteligentnog agenta, u kojem su teorija, arhitektura i implementacija usklađeni u jedinstvenu cjelinu. Kao takav, projekat predstavlja solidnu osnovu za dalja istraživanja i proširenja u domenu autonomnih i kontekstno svjesnih softverskih agenata.
