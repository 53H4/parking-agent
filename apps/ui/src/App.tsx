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
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 250);
}

// HiDPI canvas helper: oštar render na svim ekranima
function setupHiDPICanvas(canvas: HTMLCanvasElement, cssW: number, cssH: number) {
  const dpr = window.devicePixelRatio || 1;

  // CSS veličina (ono što vidiš)
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;

  // Interna rezolucija canvasa (stvarna)
  canvas.width = Math.floor(cssW * dpr);
  canvas.height = Math.floor(cssH * dpr);

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // crtamo u "CSS px" koordinatama
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // smoothing da SVG izgleda fino kad se skalira
  ctx.imageSmoothingEnabled = true;

  return { ctx, dpr };
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [running, setRunning] = useState(false);
  const [delayMs, setDelayMs] = useState(60);
  const [lastTick, setLastTick] = useState<TickResult | null>(null);
  const [world, setWorld] = useState<WorldState | null>(null);
  const [status, setStatus] = useState<string>("Disconnected");
  const [datasetName, setDatasetName] = useState<string | null>(null);

  // preload svg ikone
  const assets = useMemo(() => {
    const bg = new Image();
    bg.src = "/parking-bg.svg";
    const car = new Image();
    car.src = "/car.svg";
    const target = new Image();
    target.src = "/target.svg";
    return { bg, car, target };
  }, []);

  useEffect(() => {
    // inicijalno povuci stanje
    fetch(`${API}/api/state`)
      .then(r => r.json())
      .then(setWorld)
      .catch(() => setStatus("API not reachable"));
  }, []);

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
      } catch {
        /* ignore */
      }
    };

    return () => ws.close();
  }, []);

  // iscrtavanje parkinga + auta
  useEffect(() => {
    if (!world) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctxObj = canvas.getContext("2d");
    if (!ctxObj) return;

    const w = world.width;
    const h = world.height;

    // layout ti je dobar — samo HiDPI iscrtavanje:
    const maxCanvasW = 900; // malo veće, ali CSS kontrolira stvarni izgled
    const maxCanvasH = 520;

    const cell = Math.floor(Math.min(maxCanvasW / w, maxCanvasH / h));
    const cssW = cell * w;
    const cssH = cell * h;

    const setup = setupHiDPICanvas(canvas, cssW, cssH);
    if (!setup) return;
    const ctx = setup.ctx;

    const topRow = 1;
    const bottomRow = h - 2;

    ctx.clearRect(0, 0, cssW, cssH);

    // Pozadina canvasa (tamna)
    ctx.fillStyle = "#0b1320";
    ctx.fillRect(0, 0, cssW, cssH);

    const pad = Math.max(6, Math.floor(cell * 0.25));
    const innerX = pad;
    const innerY = pad;
    const innerW = cssW - pad * 2;
    const innerH = cssH - pad * 2;

    // Parking površina
    ctx.fillStyle = "#f2f5f9";
    ctx.fillRect(innerX, innerY, innerW, innerH);

    // Cesta
    const roadY = innerY + (topRow + 1) * cell;
    const roadH = (bottomRow - topRow - 1) * cell;
    ctx.fillStyle = "#cfd6e0";
    ctx.fillRect(innerX, roadY, innerW, roadH);

    // Isprekidana linija
    ctx.strokeStyle = "rgba(15,23,42,0.25)";
    ctx.lineWidth = Math.max(1, Math.floor(cell * 0.07));
    const midLaneY = innerY + Math.floor((topRow + bottomRow) / 2) * cell + cell / 2;
    ctx.setLineDash([Math.floor(cell * 0.6), Math.floor(cell * 0.35)]);
    ctx.beginPath();
    ctx.moveTo(innerX + Math.floor(cell * 0.35), midLaneY);
    ctx.lineTo(innerX + innerW - Math.floor(cell * 0.35), midLaneY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Linije parking mjesta
    ctx.strokeStyle = "rgba(15,23,42,0.12)";
    ctx.lineWidth = Math.max(1, Math.floor(cell * 0.06));
    for (let x = 0; x <= w; x++) {
      const px = innerX + x * cell;
      // gornji red
      ctx.beginPath();
      ctx.moveTo(px, innerY + topRow * cell);
      ctx.lineTo(px, innerY + (topRow + 1) * cell);
      ctx.stroke();
      // donji red
      ctx.beginPath();
      ctx.moveTo(px, innerY + bottomRow * cell);
      ctx.lineTo(px, innerY + (bottomRow + 1) * cell);
      ctx.stroke();
    }

    // Okvir
    ctx.strokeStyle = "rgba(15,23,42,0.18)";
    ctx.lineWidth = Math.max(2, Math.floor(cell * 0.08));
    ctx.strokeRect(innerX, innerY, innerW, innerH);

    const drawSprite = (img: HTMLImageElement, p: GridPos, rotDeg: number, scale = 0.92) => {
      const cx = innerX + p.x * cell + cell / 2;
      const cy = innerY + p.y * cell + cell / 2;
      const iw = cell * scale;
      const ih = cell * scale;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((rotDeg * Math.PI) / 180);
      ctx.drawImage(img, -iw / 2, -ih / 2, iw, ih);
      ctx.restore();
    };

    // target vizualni offset (pomak NAGORE prema cesti)
    const targetOffsetY = -cell * 0.1;


    // ===== TARGET (parking mjesto) =====

    // osnovna grid pozicija
    const targetPx = innerX + world.target.x * cell;
    const targetPy = innerY + world.target.y * cell + targetOffsetY;

    // zeleni highlight kvadrat
    ctx.fillStyle = "rgba(16,185,129,0.18)";
    ctx.fillRect(targetPx, targetPy, cell, cell);

    ctx.strokeStyle = "rgba(16,185,129,0.6)";
    ctx.lineWidth = Math.max(2, Math.floor(cell * 0.08));
    ctx.strokeRect(
      targetPx + 1,
      targetPy + 1,
      cell - 2,
      cell - 2
    );

    // ikonica targeta (D)
    if (assets.target.complete) {
      drawSprite(
        assets.target,
        {
          x: world.target.x,
          y: world.target.y + targetOffsetY / cell
        },
        0,
        0.95
      );
    } else {
      ctx.fillStyle = "#10b981";
      ctx.font = `700 ${Math.floor(cell * 0.45)}px ui-sans-serif`;
      ctx.fillText(
        "D",
        targetPx + cell * 0.35,
        targetPy + cell * 0.7
      );
    }


    // Zaparkirani auti (obstacles)
    for (const o of world.obstacles) {
      if (assets.car.complete) {
        const rot = (o.y + o.x) % 2 === 0 ? 0 : 180;
        ctx.save();
        ctx.globalAlpha = 0.98;
        drawSprite(assets.car, o, rot, 1.30);
        ctx.restore();
      } else {
        ctx.fillStyle = "#64748b";
        ctx.fillRect(innerX + o.x * cell + 2, innerY + o.y * cell + 2, cell - 4, cell - 4);
      }
    }

    // Agentovo auto
    const dir = lastTick?.action ?? "RIGHT";
    const rot = dir === "UP" ? 0 : dir === "RIGHT" ? 90 : dir === "DOWN" ? 180 : 270;
    if (assets.car.complete) {
      drawSprite(assets.car, world.agent, rot, 1.3);
    } else {
      ctx.fillStyle = "#3b82f6";
      ctx.fillRect(innerX + world.agent.x * cell + 2, innerY + world.agent.y * cell + 2, cell - 4, cell - 4);
    }

    // Overlay kad završi epizoda
    if (world.done) {
      ctx.fillStyle = "rgba(0,0,0,0.42)";
      ctx.fillRect(0, 0, cssW, Math.max(34, Math.floor(cell * 0.9)));
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

  // reset samo epizodu i osvježi prikaz
  async function resetEpisode() {
    await fetch(`${API}/api/reset`, { method: "POST" });
    const st = await fetch(`${API}/api/state`).then(r => r.json());
    setWorld(st);
  }

  // potpuno resetiranje (obriši Q-tablicu)
  async function resetAll() {
    await fetch(`${API}/api/resetAll`, { method: "POST" });
    setDatasetName(null);
    const st = await fetch(`${API}/api/state`).then(r => r.json());
    setWorld(st);
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
    try {
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
      setDatasetName(file.name);
      const st = await fetch(`${API}/api/state`).then(r => r.json());
      setWorld(st);
    } catch {
      alert("Invalid JSON file");
    }
  }

  return (
    <div className="page">
      <div className="shell">
        <div className="topbar">
          <div className="titleBlock">
            <h1>Parking Learning Agent</h1>
            <div className="sub">Q-Learning • Sense → Think → Act → Learn per tick</div>
          </div>
          <div className="pill">
            <div className={status === "Connected" ? "pillDot on" : "pillDot"}></div>
            {status}
          </div>
        </div>

        <div className="grid">
          <div className="panel">
            <div className="controls">
              {!running ? (
                <button className="btn primary" onClick={start}>Start</button>
              ) : (
                <button className="btn" onClick={stop}>Stop</button>
              )}

              <button className="btn" onClick={resetEpisode}>Reset Episode</button>
              <button className="btn" onClick={resetAll}>Reset All</button>

              <label className="field">
                <span className="fieldLabel">Tick delay (ms)</span>
                <input
                  type="number"
                  min={5}
                  max={500}
                  value={delayMs}
                  onChange={e => updateSpeed(Number(e.target.value))}
                />
              </label>

              <button className="btn" onClick={exportSnapshot}>Export</button>
              <button className="btn" onClick={() => fileRef.current?.click()}>Load</button>

              {datasetName && <span className="datasetName">Loaded: {datasetName}</span>}

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

            <div className="canvasWrap">
              <canvas ref={canvasRef} className="canvas" />
            </div>
          </div>

          <div className="panel sidebar">
            <div className="section">
              <div className="sectionTitle">Live Tick</div>
              <div className="kv">
                <div className="k">Last action</div><div className="v">{lastAction}</div>
                <div className="k">Last reward</div><div className="v">{lastReward}</div>
                <div className="k">Reason</div><div className="v">{reason}</div>
                <div className="k">Episode</div><div className="v">{world?.episode ?? "-"}</div>
                <div className="k">Step</div><div className="v">{world?.steps ?? "-"}</div>
              </div>
            </div>

            <div className="section">
              <div className="sectionTitle">Learning</div>
              <div className="kv">
                <div className="k">Episodes</div><div className="v">{stats?.totalEpisodes ?? 0}</div>
                <div className="k">Success rate</div><div className="v">{((stats?.successRate ?? 0) * 100).toFixed(1)}%</div>
                <div className="k">Epsilon</div><div className="v">{(stats?.epsilon ?? 0).toFixed(3)}</div>
              </div>
            </div>

            <div className="note">
              UI is a thin host: it only visualizes state and sends start/stop/reset/load commands. All decisions + learning happen in the shared runner.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
