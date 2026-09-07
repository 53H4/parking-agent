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

type CheckpointInfo = {
  name: string;
  episodes: number;
  rows: number;
  hasReport: boolean;
  hasZip: boolean;
  updatedAt: string;
};

type LiveStatus = { episodes: number; rows: number };

const API = "http://localhost:3001";

type IterMetric = { name: string; acc: number; prec: number; rec: number; f1: number; auc: number };
type AnalysisResult = {
  ok: boolean;
  dataset: { rows: number; parked: number; notparked: number; parked_pct: number };
  iterations: IterMetric[];
  best_rf: Omit<IterMetric, "name">;
  lr: Omit<IterMetric, "name">;
  top_features: [string, number][];
  chartData: { target: string | null; importance: string | null; roc: string | null; compare: string | null; cv: string | null };
  word: boolean;
  downloadUrl: string;
};

function triggerDownload(url: string) {
  const a = document.createElement("a");
  a.href = url;
  a.click();
}

/** Format numbers. */
function num(n: number | undefined | null): string {
  if (n === undefined || n === null || Number.isNaN(n)) return "-";
  return n.toLocaleString("bs-BA");
}

/** Format episode result. */
function reasonLabel(reason: string): string {
  switch (reason) {
    case "GOAL": return "Parkiran";
    case "COLLISION": return "Sudar";
    case "MAX_STEPS": return "Isteklo vrijeme";
    case "MOVE": return "U toku";
    default: return reason;
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString();
}

// HiDPI canvas.
function setupHiDPICanvas(canvas: HTMLCanvasElement, cssW: number, cssH: number) {
  const dpr = window.devicePixelRatio || 1;

  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;

  canvas.width = Math.floor(cssW * dpr);
  canvas.height = Math.floor(cssH * dpr);

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.imageSmoothingEnabled = true;

  return { ctx, dpr };
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [running, setRunning] = useState(false);
  const [delayMs, setDelayMs] = useState(60);
  const [lastTick, setLastTick] = useState<TickResult | null>(null);
  const [world, setWorld] = useState<WorldState | null>(null);
  const [status, setStatus] = useState<string>("Disconnected");

  // Live dataset.
  const [liveStatus, setLiveStatus] = useState<LiveStatus>({ episodes: 0, rows: 0 });
  const [exporting, setExporting] = useState(false);

  // Checkpoints.
  const [checkpoints, setCheckpoints] = useState<CheckpointInfo[]>([]);
  const [showLoadList, setShowLoadList] = useState(false);
  const [loadingName, setLoadingName] = useState<string | null>(null);

  // ML report.
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Preload assets.
  const assets = useMemo(() => {
    const bg = new Image();
    bg.src = "/parking-bg.svg";
    const car = new Image();
    car.src = "/car.svg";
    const target = new Image();
    target.src = "/target.svg";
    return { bg, car, target };
  }, []);

  async function refreshLiveStatus() {
    try {
      const st = await fetch(`${API}/api/status`).then(r => r.json());
      setLiveStatus({ episodes: st.episodes ?? 0, rows: st.rows ?? 0 });
      setRunning(!!st.running);
      if (Number.isFinite(st.delayMs)) setDelayMs(st.delayMs);
    } catch {
      /* Keep current status. */
    }
  }

  useEffect(() => {
    // Load initial state.
    fetch(`${API}/api/state`)
      .then(r => r.json())
      .then(setWorld)
      .catch(() => setStatus("API not reachable"));
    refreshLiveStatus();
  }, []);

  // Refresh live status.
  useEffect(() => {
    const t = setInterval(refreshLiveStatus, 4000);
    return () => clearInterval(t);
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

  // Render parking scene.
  useEffect(() => {
    if (!world) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctxObj = canvas.getContext("2d");
    if (!ctxObj) return;

    const w = world.width;
    const h = world.height;

    // HiDPI layout.
    const maxCanvasW = 900;
    const maxCanvasH = 520;

    const cell = Math.floor(Math.min(maxCanvasW / w, maxCanvasH / h));
    const cssW = cell * w;
    const cssH = cell * h;

    const setup = setupHiDPICanvas(canvas, cssW, cssH);
    if (!setup) return;
    const ctx = setup.ctx;

    const topRow = 2;
    const bottomRow = h - 3;

    ctx.clearRect(0, 0, cssW, cssH);

    ctx.fillStyle = "#0b1320";
    ctx.fillRect(0, 0, cssW, cssH);

    const pad = Math.max(6, Math.floor(cell * 0.25));
    const innerX = pad;
    const innerY = pad;
    const innerW = cssW - pad * 2;
    const innerH = cssH - pad * 2;

    ctx.fillStyle = "#f2f5f9";
    ctx.fillRect(innerX, innerY, innerW, innerH);

    const roadY = innerY + (topRow + 1) * cell;
    const roadH = (bottomRow - topRow - 1) * cell;
    ctx.fillStyle = "#cfd6e0";
    ctx.fillRect(innerX, roadY, innerW, roadH);

    ctx.strokeStyle = "rgba(15,23,42,0.25)";
    ctx.lineWidth = Math.max(1, Math.floor(cell * 0.07));
    const midLaneY = innerY + Math.floor((topRow + bottomRow) / 2) * cell + cell / 2;
    ctx.setLineDash([Math.floor(cell * 0.6), Math.floor(cell * 0.35)]);
    ctx.beginPath();
    ctx.moveTo(innerX + Math.floor(cell * 0.35), midLaneY);
    ctx.lineTo(innerX + innerW - Math.floor(cell * 0.35), midLaneY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = "rgba(15,23,42,0.12)";
    ctx.lineWidth = Math.max(1, Math.floor(cell * 0.06));
    for (let x = 0; x <= w; x++) {
      const px = innerX + x * cell;

      ctx.beginPath();
      ctx.moveTo(px, innerY + topRow * cell);
      ctx.lineTo(px, innerY + (topRow + 1) * cell);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(px, innerY + bottomRow * cell);
      ctx.lineTo(px, innerY + (bottomRow + 1) * cell);
      ctx.stroke();
    }

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

    // Target offset.
    const targetOffsetY = -cell * 0.1;

    // Target.

    const targetPx = innerX + world.target.x * cell;
    const targetPy = innerY + world.target.y * cell + targetOffsetY;

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

    // Parked cars.
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

    // Agent car.
    const dir = lastTick?.action ?? "RIGHT";
    const rot = dir === "UP" ? 0 : dir === "RIGHT" ? 90 : dir === "DOWN" ? 180 : 270;
    if (assets.car.complete) {
      drawSprite(assets.car, world.agent, rot, 1.3);
    } else {
      ctx.fillStyle = "#3b82f6";
      ctx.fillRect(innerX + world.agent.x * cell + 2, innerY + world.agent.y * cell + 2, cell - 4, cell - 4);
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

  // Reset episode.
  async function resetEpisode() {
    await fetch(`${API}/api/reset`, { method: "POST" });
    const st = await fetch(`${API}/api/state`).then(r => r.json());
    setWorld(st);
  }

  // Reset live session.
  async function resetAll() {
    const ok = window.confirm(
      "Reset All brise TRENUTNI (live) napredak — Q-tablicu, statistiku i dataset.\n\n" +
      "Vec sacuvani checkpointovi (Export) ostaju netaknuti i mozes ih kasnije ucitati.\n\n" +
      "Nastaviti?"
    );
    if (!ok) return;
    await fetch(`${API}/api/resetAll`, { method: "POST" });
    setAnalysis(null);
    setAnalysisError(null);
    const st = await fetch(`${API}/api/state`).then(r => r.json());
    setWorld(st);
    await refreshLiveStatus();
  }

  async function updateSpeed(v: number) {
    if (!Number.isFinite(v)) return;
    const clamped = Math.min(500, Math.max(5, Math.round(v)));
    setDelayMs(clamped);
    await fetch(`${API}/api/speed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ delayMs: clamped })
    }).catch(() => { /* ignore */ });
  }

  // Export checkpoint.
  async function exportCheckpoint() {
    setExporting(true);
    try {
      const res = await fetch(`${API}/api/checkpoints/export`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        alert(data?.reason ?? "Export nije uspio.");
        return;
      }
      if (data.rowsWarning) {
        alert(`Upozorenje: ${data.rowsWarning}`);
      }
      if (data.downloadUrl) {
        triggerDownload(`${API}${data.downloadUrl}`);
      } else if (data.zipWarning) {
        alert(`Checkpoint '${data.name}' je sacuvan na disk, ali zip nije mogao biti napravljen: ${data.zipWarning}`);
      }
      await refreshCheckpoints();
    } catch {
      alert("Export nije uspio (je li server pokrenut?).");
    } finally {
      setExporting(false);
    }
  }

  async function refreshCheckpoints() {
    try {
      const data = await fetch(`${API}/api/checkpoints`).then(r => r.json());
      setCheckpoints(data.checkpoints ?? []);
    } catch {
      /* ignore */
    }
  }

  async function openLoadList() {
    setShowLoadList(v => !v);
    if (!showLoadList) await refreshCheckpoints();
  }

  // Load checkpoint.
  async function loadCheckpoint(name: string) {
    setLoadingName(name);
    try {
      const res = await fetch(`${API}/api/checkpoints/${name}/load`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        alert(data?.reason ?? "Ucitavanje nije uspjelo.");
        return;
      }
      setAnalysis(null);
      setAnalysisError(null);
      setShowLoadList(false);
      setRunning(false);
      const st = await fetch(`${API}/api/state`).then(r => r.json());
      setWorld(st);
      await refreshLiveStatus();
    } catch {
      alert("Ucitavanje nije uspjelo (je li server pokrenut?).");
    } finally {
      setLoadingName(null);
    }
  }

  // Generate ML report.
  async function analyze() {
    setAnalyzing(true);
    setAnalysisError(null);
    try {
      const res = await fetch(`${API}/api/analyze`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setAnalysisError(data?.reason || "Analiza nije uspjela.");
        setAnalysis(null);
      } else {
        setAnalysis(data as AnalysisResult);
      }
    } catch {
      setAnalysisError("Greška u komunikaciji sa serverom (je li backend pokrenut?).");
      setAnalysis(null);
    } finally {
      setAnalyzing(false);
    }
  }

  function downloadReport() {
    window.location.href = `${API}/api/analyze/download`;
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
              <div className="ctrlGroup">
                {!running ? (
                  <button className="btn primary" onClick={start}>Start</button>
                ) : (
                  <button className="btn" onClick={stop}>Stop</button>
                )}

                <button className="btn" onClick={resetEpisode}>Reset Episode</button>
                <button className="btn danger" onClick={resetAll}>Reset All</button>

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
              </div>

              <div className="ctrlSep" />

              <div className="ctrlGroup">
                <button className="btn" onClick={exportCheckpoint} disabled={exporting}>
                  {exporting ? "Exportujem…" : "Export"}
                </button>

                <div style={{ position: "relative" }}>
                  <button className="btn" onClick={openLoadList}>Load</button>
                  {showLoadList && (
                    <>
                      <div
                        onClick={() => setShowLoadList(false)}
                        style={{ position: "fixed", inset: 0, zIndex: 10 }}
                      />
                      <div
                        style={{
                          position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 20,
                          minWidth: 260, maxHeight: 280, overflowY: "auto",
                          background: "#0f1626", border: "1px solid rgba(255,255,255,0.18)",
                          borderRadius: 10, boxShadow: "0 12px 30px rgba(0,0,0,0.5)", padding: 6
                        }}
                      >
                        {checkpoints.length === 0 && (
                          <div style={{ padding: 10, fontSize: 13, opacity: 0.7 }}>Nema sačuvanih checkpointa.</div>
                        )}
                        {checkpoints.map(cp => (
                          <button
                            key={cp.name}
                            className="btn"
                            style={{ display: "block", width: "100%", textAlign: "left", marginBottom: 4 }}
                            disabled={loadingName === cp.name}
                            onClick={() => loadCheckpoint(cp.name)}
                          >
                            <div style={{ fontWeight: 600 }}>{num(cp.episodes)} epizoda</div>
                            <div style={{ fontSize: 11, opacity: 0.7 }}>
                              {num(cp.rows)} redova u csv-u{cp.hasReport ? " · ima izvještaj" : ""} · {formatDate(cp.updatedAt)}
                            </div>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="ctrlSep" />

              <div className="ctrlGroup">
                <button className="btn primary" onClick={analyze} disabled={analyzing}>
                  {analyzing ? "Generišem…" : "Generiši izvještaj"}
                </button>
              </div>
            </div>

            <div className="canvasWrap">
              <canvas ref={canvasRef} className="canvas" />
            </div>
          </div>

          <div className="panel sidebar">
            <div className="section">
              <div className="sectionTitle">Trenutna aktivnost</div>
              <div className="kv">
                <div className="k">Posljednja akcija</div><div className="v">{lastAction}</div>
                <div className="k">Posljednja nagrada</div><div className="v">{lastReward}</div>
                <div className="k">Ishod</div><div className="v">{reasonLabel(reason)}</div>
                <div className="k">Epizoda</div><div className="v">{num(world?.episode)}</div>
                <div className="k">Korak</div><div className="v">{world?.steps ?? "-"}</div>
              </div>
            </div>

            <div className="section">
              <div className="sectionTitle">Učenje</div>
              <div className="kv">
                <div className="k">Epizoda</div><div className="v">{num(stats?.totalEpisodes ?? 0)}</div>
                <div className="k">Stopa uspjeha</div><div className="v">{((stats?.successRate ?? 0) * 100).toFixed(1)}%</div>
                <div className="k">Epsilon</div><div className="v">{(stats?.epsilon ?? 0).toFixed(3)}</div>
              </div>
            </div>

            <div className="section">
              <div className="sectionTitle">Aktivni dataset</div>
              <div className="kv">
                <div className="k">Epizoda</div>
                <div className="v">{num(liveStatus.episodes)}</div>
                <div className="k">Redova u csv-u</div>
                <div className="v">{num(liveStatus.rows)}</div>
              </div>
            </div>

            <div className="note">
              Podaci se cuvaju u <code>apps/server/data/</code>. Folder <code>_live/</code> je
              trenutna sesija, a <code>&lt;N&gt;_episodes/</code> su trajni checkpointi koje
              pravi Export. Reset All ne dira checkpointe.
            </div>
          </div>
        </div>

        {(analyzing || analysisError || analysis) && (
          <div className="panel reportPanel" style={{ marginTop: 16 }}>
            <div className="sectionTitle">
              ML Izvještaj — Random Forest vs Logistička regresija
            </div>

            <div style={{ marginBottom: 14 }} />

            {analyzing && (
              <div style={{ padding: "16px 0", opacity: 0.8 }}>
                Generišem izvještaj (analiza + grafovi + Word)… ovo traje par sekundi.
              </div>
            )}

            {analysisError && !analyzing && (
              <div style={{ padding: 12, borderRadius: 8, background: "rgba(220,80,80,0.12)", color: "#e06666" }}>
                {analysisError}
              </div>
            )}

            {analysis && !analyzing && (
              <div>
                <div style={{ marginBottom: 12, opacity: 0.85 }}>
                  Dataset: <b>{num(analysis.dataset.rows)}</b> epizoda · Parked{" "}
                  <b>{num(analysis.dataset.parked)}</b> ({analysis.dataset.parked_pct}%) · NotParked{" "}
                  <b>{num(analysis.dataset.notparked)}</b>
                </div>

                <div style={{ overflowX: "auto" }}>
                  <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }}>
                    <thead>
                      <tr>
                        {["Model", "Accuracy", "Precision", "Recall", "F1", "AUC-ROC"].map(h => (
                          <th key={h} style={{ textAlign: "left", padding: "6px 10px", borderBottom: "2px solid rgba(255,255,255,0.2)" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {analysis.iterations.map((it, i) => {
                        const best = i === 3; // Best RF iteration.
                        return (
                          <tr key={it.name} style={{ background: best ? "rgba(33,150,243,0.15)" : "transparent" }}>
                            <td style={{ padding: "6px 10px", fontWeight: best ? 700 : 400 }}>{it.name}</td>
                            <td style={{ padding: "6px 10px" }}>{it.acc.toFixed(4)}</td>
                            <td style={{ padding: "6px 10px" }}>{it.prec.toFixed(4)}</td>
                            <td style={{ padding: "6px 10px" }}>{it.rec.toFixed(4)}</td>
                            <td style={{ padding: "6px 10px" }}>{it.f1.toFixed(4)}</td>
                            <td style={{ padding: "6px 10px" }}>{it.auc.toFixed(4)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div style={{ marginTop: 12, fontSize: 13, opacity: 0.85 }}>
                  Najvažnije varijable (RF):{" "}
                  {analysis.top_features.map(([f, v]) => `${f} (${v.toFixed(3)})`).join(" · ")}
                </div>

                <div className="chartGrid">
                  {analysis.chartData.roc && (
                    <img src={analysis.chartData.roc} alt="ROC" style={{ width: "100%", borderRadius: 8, background: "#fff" }} />
                  )}
                  {analysis.chartData.compare && (
                    <img src={analysis.chartData.compare} alt="Usporedba metrika" style={{ width: "100%", borderRadius: 8, background: "#fff" }} />
                  )}
                  {analysis.chartData.importance && (
                    <img src={analysis.chartData.importance} alt="Feature importance" style={{ width: "100%", borderRadius: 8, background: "#fff" }} />
                  )}
                  {analysis.chartData.target && (
                    <img src={analysis.chartData.target} alt="Distribucija cilja" style={{ width: "100%", borderRadius: 8, background: "#fff" }} />
                  )}
                </div>

                {analysis.chartData.cv && (
                  <>
                    <div style={{ marginTop: 16, fontSize: 13, opacity: 0.85 }}>
                      Petostruka unakrsna validacija - prosjek i standardna devijacija po podjeli
                    </div>
                    <img
                      src={analysis.chartData.cv}
                      alt="Unakrsna validacija"
                      style={{ width: "100%", marginTop: 8, borderRadius: 8, background: "#fff" }}
                    />
                  </>
                )}

                <div style={{ marginTop: 16 }}>
                  <button className="btn primary" onClick={downloadReport}>
                    Preuzmi izvještaj (ZIP{analysis.word ? " + Word" : ""})
                  </button>
                  {!analysis.word && (
                    <span style={{ marginLeft: 10, fontSize: 12, opacity: 0.7 }}>
                      (Word preskočen — instaliraj: pip install python-docx)
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
