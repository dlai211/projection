// Simple Feynman diagram SVG drawer for GitHub Pages.
// Supports: 2->2 s-channel, 2->2 t-channel, 1->2 decay.
// Line styles: fermion (straight + arrow), photon (wavy), gluon (curly), scalar (dashed).

const el = (id) => document.getElementById(id);

const svg = el("svg");
const msg = el("msg");

el("draw").addEventListener("click", drawFromUI);
el("download").addEventListener("click", downloadSVG);
el("theme").addEventListener("change", (e) => {
  document.documentElement.setAttribute("data-theme", e.target.value);
});

document.documentElement.setAttribute("data-theme", el("theme").value);
drawFromUI();

function drawFromUI() {
  msg.textContent = "";
  const processStr = el("process").value.trim();
  const topoChoice = el("topology").value;
  const medChoice = el("mediator").value;

  let parsed;
  try {
    parsed = parseProcess(processStr);
  } catch (e) {
    clearSVG();
    msg.textContent = e.message;
    return;
  }

  const { initial, final } = parsed;

  let topology = topoChoice;
  if (topology === "auto") {
    if (initial.length === 2 && final.length === 2) topology = "s";
    else if (initial.length === 1 && final.length === 2) topology = "decay";
    else topology = (initial.length === 2 && final.length === 2) ? "s" : "decay";
  }

  let mediator = medChoice;
  if (mediator === "auto") mediator = inferMediator(initial, final, topology);

  clearSVG();
  addDefs();

  // Title label
  addText(12, 22, `${initial.join(" ")} → ${final.join(" ")}`, { size: 16, weight: 700 });

  if (topology === "s") {
    if (initial.length !== 2 || final.length !== 2) {
      msg.textContent = "s-channel expects 2 initial and 2 final particles.";
      return;
    }
    drawSChannel(initial, final, mediator);
  } else if (topology === "t") {
    if (initial.length !== 2 || final.length !== 2) {
      msg.textContent = "t-channel expects 2 initial and 2 final particles.";
      return;
    }
    drawTChannel(initial, final, mediator);
  } else if (topology === "decay") {
    if (initial.length !== 1 || final.length !== 2) {
      msg.textContent = "decay expects 1 initial and 2 final particles.";
      return;
    }
    drawDecay(initial, final, mediator);
  } else {
    msg.textContent = "Unknown topology.";
  }
}

function parseProcess(s) {
  // Accept: "a b -> c d" or "a+b -> c + d" etc.
  const norm = s
    .replace(/→/g, "->")
    .replace(/\+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const parts = norm.split("->").map(x => x.trim());
  if (parts.length !== 2) throw new Error("Process must contain '->' (example: e- e+ -> mu- mu+).");

  const initial = parts[0].split(" ").filter(Boolean);
  const final = parts[1].split(" ").filter(Boolean);

  if (initial.length < 1 || final.length < 1) throw new Error("Could not parse initial/final state.");
  if (initial.length > 3 || final.length > 3) {
    throw new Error("This demo supports up to 3 particles per side. Extend parse/draw if needed.");
  }

  return { initial, final };
}

function inferMediator(initial, final, topology) {
  // Very simple heuristics. Extend this however you want.
  const all = [...initial, ...final].join(" ").toLowerCase();

  // if gluons present -> gluon
  if (all.includes("g")) return "g";

  // if photons present -> gamma (often Compton-like)
  if (all.includes("gamma") || all.includes("γ")) return "gamma";

  // leptons scattering -> gamma as default
  const leptons = ["e-", "e+", "mu-", "mu+", "tau-", "tau+"];
  const hasLeptons = initial.concat(final).some(p => leptons.includes(p));
  if (hasLeptons && topology !== "decay") return "gamma";

  // decay default scalar
  if (topology === "decay") return "h";

  return "gamma";
}

/* ---------------- SVG primitives ---------------- */

function clearSVG() {
  while (svg.firstChild) svg.removeChild(svg.firstChild);
}

function addDefs() {
  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");

  // Arrow marker
  const marker = document.createElementNS(svg.namespaceURI, "marker");
  marker.setAttribute("id", "arrow");
  marker.setAttribute("viewBox", "0 0 10 10");
  marker.setAttribute("refX", "8.5");
  marker.setAttribute("refY", "5");
  marker.setAttribute("markerWidth", "7");
  marker.setAttribute("markerHeight", "7");
  marker.setAttribute("orient", "auto-start-reverse");
  const path = document.createElementNS(svg.namespaceURI, "path");
  path.setAttribute("d", "M 0 0 L 10 5 L 0 10 z");
  path.setAttribute("fill", "currentColor");
  marker.appendChild(path);

  defs.appendChild(marker);
  svg.appendChild(defs);
}

function addLine(x1, y1, x2, y2, opts = {}) {
  const l = document.createElementNS(svg.namespaceURI, "line");
  l.setAttribute("x1", x1); l.setAttribute("y1", y1);
  l.setAttribute("x2", x2); l.setAttribute("y2", y2);
  l.setAttribute("stroke", opts.stroke ?? "currentColor");
  l.setAttribute("stroke-width", opts.w ?? 2.2);
  if (opts.dash) l.setAttribute("stroke-dasharray", opts.dash);
  if (opts.arrow) l.setAttribute("marker-end", "url(#arrow)");
  l.setAttribute("fill", "none");
  svg.appendChild(l);
  return l;
}

function addPath(d, opts = {}) {
  const p = document.createElementNS(svg.namespaceURI, "path");
  p.setAttribute("d", d);
  p.setAttribute("stroke", opts.stroke ?? "currentColor");
  p.setAttribute("stroke-width", opts.w ?? 2.2);
  p.setAttribute("fill", "none");
  if (opts.dash) p.setAttribute("stroke-dasharray", opts.dash);
  svg.appendChild(p);
  return p;
}

function addCircle(cx, cy, r = 4, opts = {}) {
  const c = document.createElementNS(svg.namespaceURI, "circle");
  c.setAttribute("cx", cx);
  c.setAttribute("cy", cy);
  c.setAttribute("r", r);
  c.setAttribute("fill", opts.fill ?? "currentColor");
  svg.appendChild(c);
  return c;
}

function addText(x, y, text, opts = {}) {
  const t = document.createElementNS(svg.namespaceURI, "text");
  t.setAttribute("x", x);
  t.setAttribute("y", y);
  t.setAttribute("fill", opts.fill ?? "currentColor");
  t.setAttribute("font-size", opts.size ?? 14);
  t.setAttribute("font-weight", opts.weight ?? 500);
  t.setAttribute("font-family", "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial");
  svg.appendChild(t);
  t.textContent = text;
  return t;
}

/* ------------- Feynman line styles ------------- */

function drawFermion(x1, y1, x2, y2, label, arrowDir = "forward") {
  // arrowDir: "forward" means arrow toward (x2,y2). "backward" means arrow toward (x1,y1)
  const l = addLine(x1, y1, x2, y2, { arrow: arrowDir === "forward" });
  if (arrowDir === "backward") {
    // swap by drawing a second invisible reversed line with marker
    const inv = addLine(x2, y2, x1, y1, { arrow: true });
    inv.setAttribute("stroke", "none");
  }
  labelOnSegment(x1, y1, x2, y2, label);
  return l;
}

function drawScalar(x1, y1, x2, y2, label) {
  addLine(x1, y1, x2, y2, { dash: "6 6" });
  labelOnSegment(x1, y1, x2, y2, label);
}

function drawPhoton(x1, y1, x2, y2, label) {
  const d = wavyPath(x1, y1, x2, y2, 10, 7);
  addPath(d);
  labelOnSegment(x1, y1, x2, y2, label);
}

function drawGluon(x1, y1, x2, y2, label) {
  const d = curlyPath(x1, y1, x2, y2, 9, 7);
  addPath(d);
  labelOnSegment(x1, y1, x2, y2, label);
}

function labelOnSegment(x1, y1, x2, y2, label) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  addText(mx + 6, my - 6, label, { size: 14, weight: 650 });
}

function wavyPath(x1, y1, x2, y2, wavelength = 10, amp = 6) {
  const dx = x2 - x1, dy = y2 - y1;
  const L = Math.hypot(dx, dy);
  const nx = dx / L, ny = dy / L;
  const px = -ny, py = nx;

  const nWaves = Math.max(3, Math.floor(L / wavelength));
  const step = L / nWaves;

  let d = `M ${x1} ${y1}`;
  for (let i = 1; i <= nWaves; i++) {
    const s = i * step;
    const baseX = x1 + nx * s;
    const baseY = y1 + ny * s;
    const phase = (i % 2 === 0) ? -1 : 1;
    const offX = baseX + px * amp * phase;
    const offY = baseY + py * amp * phase;
    d += ` Q ${offX} ${offY} ${baseX} ${baseY}`;
  }
  return d;
}

function curlyPath(x1, y1, x2, y2, pitch = 10, radius = 5) {
  // Approx curly with many small arcs along the segment.
  const dx = x2 - x1, dy = y2 - y1;
  const L = Math.hypot(dx, dy);
  const nx = dx / L, ny = dy / L;
  const px = -ny, py = nx;

  const n = Math.max(8, Math.floor(L / pitch) * 2);
  const step = L / n;

  let d = `M ${x1} ${y1}`;
  for (let i = 1; i <= n; i++) {
    const s = i * step;
    const baseX = x1 + nx * s;
    const baseY = y1 + ny * s;
    const phase = (i % 2 === 0) ? -1 : 1;
    const offX = baseX + px * radius * phase;
    const offY = baseY + py * radius * phase;
    d += ` Q ${offX} ${offY} ${baseX} ${baseY}`;
  }
  return d;
}

/* ---------------- Topologies ---------------- */

function drawSChannel(initial, final, mediator) {
  // Layout points
  const leftX = 90, rightX = 670;
  const yTop = 140, yBot = 300;
  const v1 = { x: 310, y: 220 };
  const v2 = { x: 450, y: 220 };

  // External fermions
  drawFermion(leftX, yTop, v1.x, v1.y, initial[0], "forward");
  drawFermion(leftX, yBot, v1.x, v1.y, initial[1], "forward");
  drawFermion(v2.x, v2.y, rightX, yTop, final[0], "forward");
  drawFermion(v2.x, v2.y, rightX, yBot, final[1], "forward");

  // Mediator between vertices
  drawMediator(v1.x, v1.y, v2.x, v2.y, mediator);

  addCircle(v1.x, v1.y, 4);
  addCircle(v2.x, v2.y, 4);
}

function drawTChannel(initial, final, mediator) {
  const leftX = 90, rightX = 670;
  const yTop = 140, yBot = 300;
  const v1 = { x: 330, y: 140 };
  const v2 = { x: 430, y: 300 };

  // Fermion legs
  drawFermion(leftX, yTop, v1.x, v1.y, initial[0], "forward");
  drawFermion(v1.x, v1.y, rightX, yTop, final[0], "forward");

  drawFermion(leftX, yBot, v2.x, v2.y, initial[1], "forward");
  drawFermion(v2.x, v2.y, rightX, yBot, final[1], "forward");

  // Mediator t-channel
  drawMediator(v1.x, v1.y, v2.x, v2.y, mediator);

  addCircle(v1.x, v1.y, 4);
  addCircle(v2.x, v2.y, 4);
}

function drawDecay(initial, final, mediator) {
  const leftX = 110, rightX = 670;
  const v = { x: 340, y: 220 };
  const yTop = 160, yBot = 280;

  drawFermion(leftX, 220, v.x, v.y, initial[0], "forward");
  drawFermion(v.x, v.y, rightX, yTop, final[0], "forward");
  drawFermion(v.x, v.y, rightX, yBot, final[1], "forward");

  // Optional: draw a short "mediator stub" if it’s a boson-like decay
  // For now, only if user chose a non-auto mediator explicitly.
  if (el("mediator").value !== "auto") {
    drawMediator(v.x - 40, v.y, v.x, v.y, mediator);
  }

  addCircle(v.x, v.y, 4);
}

function drawMediator(x1, y1, x2, y2, mediator) {
  const m = mediator.toLowerCase();
  if (m === "gamma" || m === "γ") return drawPhoton(x1, y1, x2, y2, "γ");
  if (m === "g") return drawGluon(x1, y1, x2, y2, "g");
  if (m === "z") return drawPhoton(x1, y1, x2, y2, "Z");     // wavy is OK for vector
  if (m === "w") return drawPhoton(x1, y1, x2, y2, "W");
  if (m === "h") return drawScalar(x1, y1, x2, y2, "h");     // dashed scalar
  // fallback
  return drawPhoton(x1, y1, x2, y2, mediator);
}

/* ---------------- Download ---------------- */

function downloadSVG() {
  const s = new XMLSerializer().serializeToString(svg);
  const blob = new Blob([s], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "feynman_diagram.svg";
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}