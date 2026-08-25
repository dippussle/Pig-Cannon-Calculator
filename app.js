// Minecraft Lazy Accelerated Pig Cannon Calculator

// Fixed Physics Constants (Minecraft Java Edition Pig & Powder Snow Boat Launcher)
const EFFECTIVE_MOTION_PER_BOAT = 0.0413265304548704 * 0.95; // 0.03926020393212688 blocks/tick
const PIG_DRAG = 0.91;
const PIG_GRAVITY = 0.08;

// DOM Elements
const originXInput = document.getElementById("origin-x");
const originYInput = document.getElementById("origin-y");
const originZInput = document.getElementById("origin-z");

const targetXInput = document.getElementById("target-x");
const targetYInput = document.getElementById("target-y");
const targetZInput = document.getElementById("target-z");

const boatsPerStackInput = document.getElementById("boats-per-stack");
const maxCollisionTicksInput = document.getElementById("max-collision-ticks");
const maxTicksInput = document.getElementById("max-ticks");

const btnCalculate = document.getElementById("btn-calculate");

const solverTbody = document.getElementById("solver-tbody");
const resultsCount = document.getElementById("results-count");

const tpCommandText = document.getElementById("tp-command");
const btnCopyCommand = document.getElementById("btn-copy-command");
const btnCopyPigCommand = document.getElementById("btn-copy-pig-command");

const trajectoryCanvas = document.getElementById("trajectory-canvas");
const tickTbody = document.getElementById("tick-tbody");

const btnViewXZ = document.getElementById("btn-view-xz");
const btnViewXY = document.getElementById("btn-view-xy");

// Application State
let solverResults = [];
let selectedResult = null;
let currentCanvasMode = "xz"; // "xz" or "xy"

// Event Listeners
btnCalculate.addEventListener("click", runSolver);

btnCopyCommand.addEventListener("click", () => copyTpCommand("player"));
btnCopyPigCommand.addEventListener("click", () => copyTpCommand("pig"));

btnViewXZ.addEventListener("click", () => {
  currentCanvasMode = "xz";
  btnViewXZ.classList.add("active");
  btnViewXY.classList.remove("active");
  if (selectedResult) renderCanvas(selectedResult.trajectory);
});

btnViewXY.addEventListener("click", () => {
  currentCanvasMode = "xy";
  btnViewXY.classList.add("active");
  btnViewXZ.classList.remove("active");
  if (selectedResult) renderCanvas(selectedResult.trajectory);
});

// Clipboard Helper
function copyTpCommand(targetType) {
  if (!selectedResult) return;
  const land = selectedResult.landingPos;
  const cmd = targetType === "pig" 
    ? `/tp @e[type=pig,limit=1,sort=nearest] ${land.x.toFixed(2)} ${land.y.toFixed(2)} ${land.z.toFixed(2)}`
    : `/tp @p ${land.x.toFixed(2)} ${land.y.toFixed(2)} ${land.z.toFixed(2)}`;
  
  navigator.clipboard.writeText(cmd).then(() => {
    const targetBtn = targetType === "pig" ? btnCopyPigCommand : btnCopyCommand;
    const originalText = targetBtn.textContent;
    targetBtn.textContent = "Copied!";
    targetBtn.style.background = "var(--color-success)";
    targetBtn.style.color = "#fff";
    setTimeout(() => {
      targetBtn.textContent = originalText;
      targetBtn.style.background = "";
      targetBtn.style.color = "";
    }, 1500);
  });
}

// Distance Helper
function dist2D(x1, z1, x2, z2) {
  const dx = x2 - x1;
  const dz = z2 - z1;
  return Math.sqrt(dx*dx + dz*dz);
}

/**
 * Closed-form O(1) analytical unit displacement for t collision ticks over T total ticks
 */
function U_closed(t, T) {
  const d = PIG_DRAG;
  if (t <= 0 || T <= 0 || t > T) return 0;
  const term1 = t;
  const term2 = Math.pow(d, T - t + 1) * ((1 - Math.pow(d, t)) / (1 - d));
  return (term1 - term2) / (1 - d);
}

/**
 * Full tick-by-tick simulation for rendering trajectory and telemetry
 */
function simulatePigTrajectory(origin, boatsPerStack, dirX, dirZ, t1, t2, totalTicks) {
  let x = origin.x;
  let y = origin.y;
  let z = origin.z;

  let vx = 0;
  let vy = 0;
  let vz = 0;

  const trajectory = [];
  trajectory.push({
    tick: 0,
    time: "0.00",
    phase: "Launcher Setup",
    x, y, z,
    vx, vy, vz,
    speed: 0
  });

  for (let t = 1; t <= totalTicks; t++) {
    let activeStacks = 0;
    if (t <= t1) activeStacks += 1;
    if (t <= t2) activeStacks += 1;

    let phaseName = "Free Flight";
    if (activeStacks === 2) {
      phaseName = "Colliding (Stack 1 & Stack 2)";
    } else if (t <= t1 && t > t2) {
      phaseName = "Colliding (Stack 1 Only)";
    } else if (t > t1 && t <= t2) {
      phaseName = "Colliding (Stack 2 Only)";
    }

    if (activeStacks > 0) {
      const pushFactor = activeStacks * boatsPerStack;
      vx += pushFactor * EFFECTIVE_MOTION_PER_BOAT * dirX;
      vz += pushFactor * EFFECTIVE_MOTION_PER_BOAT * dirZ;
    }

    // Position update
    x += vx;
    y += vy;
    z += vz;

    // Velocity decay for next tick
    vx *= PIG_DRAG;
    vz *= PIG_DRAG;
    vy = (vy - PIG_GRAVITY) * PIG_DRAG;

    const speedVal = Math.sqrt(vx*vx + vy*vy + vz*vz) * 20; // blocks/sec

    trajectory.push({
      tick: t,
      time: (t * 0.05).toFixed(2),
      phase: phaseName,
      x, y, z,
      vx, vy, vz,
      speed: speedVal
    });
  }

  return trajectory;
}

/**
 * Ultra-Fast Solver (O(1) analytical math + top-K trajectory filter)
 */
function runSolver() {
  const origin = {
    x: parseFloat(originXInput.value) || 0,
    y: parseFloat(originYInput.value) || 64,
    z: parseFloat(originZInput.value) || 0
  };

  const target = {
    x: parseFloat(targetXInput.value) || 0,
    y: parseFloat(targetYInput.value) || 64,
    z: parseFloat(targetZInput.value) || 0
  };

  const boatsPerStack = parseInt(boatsPerStackInput.value, 10) || 1;
  const maxCollisionTicks = parseInt(maxCollisionTicksInput.value, 10) || 100;
  const maxTicks = parseInt(maxTicksInput.value, 10) || 300;

  if (boatsPerStack <= 0) {
    alert("Please enter at least 1 boat per stack.");
    return;
  }

  const dx = target.x - origin.x;
  const dz = target.z - origin.z;
  const dirX = dx >= 0 ? 1 : (dx < 0 ? -1 : 0);
  const dirZ = dz >= 0 ? 1 : (dz < 0 ? -1 : 0);

  const targetDist2D = dist2D(origin.x, origin.z, target.x, target.z);

  if (targetDist2D === 0) {
    alert("Origin and Target cannot be at the exact same X, Z location.");
    return;
  }

  const stackScale = boatsPerStack * EFFECTIVE_MOTION_PER_BOAT;
  const collisionLimit = Math.min(maxCollisionTicks, maxTicks);
  const candidates = [];

  // Instant analytical evaluation loop over user-configured collision search limit
  for (let t1 = 1; t1 <= collisionLimit; t1++) {
    for (let t2 = t1; t2 <= collisionLimit; t2++) {
      const maxCol = Math.max(t1, t2);

      for (let tTotal = maxCol; tTotal <= maxTicks; tTotal++) {
        const u1 = U_closed(t1, tTotal);
        const u2 = U_closed(t2, tTotal);
        const calculatedDisp = stackScale * (u1 + u2);

        const error = Math.abs(calculatedDisp - targetDist2D);

        candidates.push({ t1, t2, tTotal, error, calculatedDisp });
      }
    }
  }

  // Sort candidates by analytical distance error
  candidates.sort((a, b) => a.error - b.error);

  // Take top 25 unique configurations for full simulation
  const seen = new Set();
  const topCandidates = [];
  for (const c of candidates) {
    const key = `${c.t1}_${c.t2}_${c.tTotal}`;
    if (!seen.has(key)) {
      seen.add(key);
      topCandidates.push(c);
      if (topCandidates.length >= 25) break;
    }
  }

  solverResults = [];

  // Run full simulation ONLY for the top 25 candidates
  topCandidates.forEach(c => {
    const trajectory = simulatePigTrajectory(origin, boatsPerStack, dirX, dirZ, c.t1, c.t2, c.tTotal);
    const lastPoint = trajectory[trajectory.length - 1];
    const landingPos = { x: lastPoint.x, y: lastPoint.y, z: lastPoint.z };

    const error2D = dist2D(landingPos.x, landingPos.z, target.x, target.z);

    const landDistFromOrigin = dist2D(origin.x, origin.z, landingPos.x, landingPos.z);
    let statusText = "Exact";
    let statusClass = "exact";

    if (Math.abs(landDistFromOrigin - targetDist2D) > 0.1) {
      if (landDistFromOrigin > targetDist2D) {
        statusText = "Overshoot";
        statusClass = "overshoot";
      } else {
        statusText = "Undershoot";
        statusClass = "undershoot";
      }
    }

    solverResults.push({
      t1: c.t1,
      t2: c.t2,
      tTotal: c.tTotal,
      boatsPerStack,
      origin,
      target,
      landingPos,
      error: error2D,
      status: statusText,
      statusClass,
      trajectory
    });
  });

  solverResults.sort((a, b) => a.error - b.error);
  solverResults = solverResults.slice(0, 15);

  renderSolverTable();

  if (solverResults.length > 0) {
    selectResult(0);
  } else {
    solverTbody.innerHTML = `<tr><td colspan="7" class="table-placeholder">No valid configurations found. Try adjusting search limits.</td></tr>`;
    resultsCount.textContent = "0 solutions";
  }
}

/**
 * Render solutions table
 */
function renderSolverTable() {
  solverTbody.innerHTML = "";
  resultsCount.textContent = `${solverResults.length} solutions`;

  if (solverResults.length === 0) return;

  solverResults.forEach((res, idx) => {
    const tr = document.createElement("tr");
    if (selectedResult && selectedResult.t1 === res.t1 && selectedResult.t2 === res.t2 && selectedResult.tTotal === res.tTotal) {
      tr.classList.add("selected");
    }

    const posStr = `(${res.landingPos.x.toFixed(1)}, ${res.landingPos.y.toFixed(1)}, ${res.landingPos.z.toFixed(1)})`;

    tr.innerHTML = `
      <td><strong>${res.t1}t</strong></td>
      <td><strong>${res.t2}t</strong></td>
      <td>${res.tTotal}t</td>
      <td>${res.boatsPerStack}</td>
      <td>${posStr}</td>
      <td class="${res.error < 1 ? 'text-success' : 'text-warning'}">${res.error.toFixed(2)}m</td>
      <td><span class="status-pill ${res.statusClass}">${res.status}</span></td>
    `;

    tr.addEventListener("click", () => selectResult(idx));
    solverTbody.appendChild(tr);
  });
}

/**
 * Select result row
 */
function selectResult(index) {
  selectedResult = solverResults[index];

  const rows = solverTbody.querySelectorAll("tr");
  rows.forEach((row, rIdx) => {
    if (rIdx === index) row.classList.add("selected");
    else row.classList.remove("selected");
  });

  const land = selectedResult.landingPos;
  tpCommandText.textContent = `/tp @p ${land.x.toFixed(2)} ${land.y.toFixed(2)} ${land.z.toFixed(2)}`;

  renderTickTable(selectedResult.trajectory);
  renderCanvas(selectedResult.trajectory);
}

/**
 * Render tick-by-tick spreadsheet telemetry table
 */
function renderTickTable(trajectory) {
  tickTbody.innerHTML = "";

  trajectory.forEach((pt) => {
    const tr = document.createElement("tr");
    const isColliding = pt.phase.startsWith("Colliding") || pt.phase.startsWith("Launcher");
    const phaseClass = isColliding ? "accel" : "flight";

    tr.innerHTML = `
      <td><strong>${pt.tick}</strong></td>
      <td>${pt.time}s</td>
      <td><span class="phase-pill ${phaseClass}">${pt.phase}</span></td>
      <td>${pt.x.toFixed(3)}</td>
      <td>${pt.y.toFixed(3)}</td>
      <td>${pt.z.toFixed(3)}</td>
      <td>${pt.vx.toFixed(4)}</td>
      <td>${pt.vy.toFixed(4)}</td>
      <td>${pt.vz.toFixed(4)}</td>
      <td>${pt.speed.toFixed(1)}</td>
    `;

    tickTbody.appendChild(tr);
  });
}

/**
 * Render canvas trajectory visualizer
 */
function renderCanvas(trajectory) {
  const ctx = trajectoryCanvas.getContext("2d");
  const w = trajectoryCanvas.width;
  const h = trajectoryCanvas.height;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#020617";
  ctx.fillRect(0, 0, w, h);

  if (!trajectory || trajectory.length === 0) return;

  const targetX = selectedResult.target.x;
  const targetY = selectedResult.target.y;
  const targetZ = selectedResult.target.z;

  const isXZ = currentCanvasMode === "xz";

  let minHoriz = trajectory[0].x;
  let maxHoriz = trajectory[0].x;
  let minVert = isXZ ? trajectory[0].z : trajectory[0].y;
  let maxVert = isXZ ? trajectory[0].z : trajectory[0].y;

  const targetHoriz = isXZ ? targetX : targetX;
  const targetVert = isXZ ? targetZ : targetY;

  minHoriz = Math.min(minHoriz, targetHoriz);
  maxHoriz = Math.max(maxHoriz, targetHoriz);
  minVert = Math.min(minVert, targetVert);
  maxVert = Math.max(maxVert, targetVert);

  trajectory.forEach(p => {
    const hVal = p.x;
    const vVal = isXZ ? p.z : p.y;
    if (hVal < minHoriz) minHoriz = hVal;
    if (hVal > maxHoriz) maxHoriz = hVal;
    if (vVal < minVert) minVert = vVal;
    if (vVal > maxVert) maxVert = vVal;
  });

  const margin = 35;
  const rangeH = (maxHoriz - minHoriz) || 10;
  const rangeV = (maxVert - minVert) || 10;

  function toScreenX(val) {
    return margin + ((val - minHoriz) / rangeH) * (w - 2 * margin);
  }

  function toScreenY(val) {
    if (!isXZ) {
      return (h - margin) - ((val - minVert) / rangeV) * (h - 2 * margin);
    }
    return margin + ((val - minVert) / rangeV) * (h - 2 * margin);
  }

  // Draw grid lines
  ctx.strokeStyle = "#1e293b";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let gx = 0; gx <= 4; gx++) {
    const gxPos = margin + (gx / 4) * (w - 2 * margin);
    ctx.moveTo(gxPos, 0);
    ctx.lineTo(gxPos, h);
  }
  for (let gy = 0; gy <= 3; gy++) {
    const gyPos = margin + (gy / 3) * (h - 2 * margin);
    ctx.moveTo(0, gyPos);
    ctx.lineTo(w, gyPos);
  }
  ctx.stroke();

  // Axis Labels
  ctx.fillStyle = "#64748b";
  ctx.font = "10px 'JetBrains Mono'";
  ctx.fillText(isXZ ? "X-Z Top Down View" : "X-Y Side Elevation Profile", margin, 15);

  // Draw full trajectory line
  ctx.beginPath();
  trajectory.forEach((pt, i) => {
    const sx = toScreenX(pt.x);
    const sy = toScreenY(isXZ ? pt.z : pt.y);
    if (i === 0) ctx.moveTo(sx, sy);
    else ctx.lineTo(sx, sy);
  });
  ctx.strokeStyle = "#38bdf8";
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Highlight boat collision phase segment in pink
  ctx.beginPath();
  let hasCollision = false;
  trajectory.forEach((pt) => {
    if (pt.phase.startsWith("Colliding") || pt.phase.startsWith("Launcher")) {
      const sx = toScreenX(pt.x);
      const sy = toScreenY(isXZ ? pt.z : pt.y);
      if (!hasCollision) { ctx.moveTo(sx, sy); hasCollision = true; }
      else ctx.lineTo(sx, sy);
    }
  });
  if (hasCollision) {
    ctx.strokeStyle = "#f472b6";
    ctx.lineWidth = 4;
    ctx.stroke();
  }

  // Origin point (Green)
  const origPt = trajectory[0];
  ctx.beginPath();
  ctx.arc(toScreenX(origPt.x), toScreenY(isXZ ? origPt.z : origPt.y), 6, 0, Math.PI * 2);
  ctx.fillStyle = "#10b981";
  ctx.fill();

  // Target point (Red)
  const txScreen = toScreenX(targetHoriz);
  const tyScreen = toScreenY(targetVert);
  ctx.beginPath();
  ctx.arc(txScreen, tyScreen, 6, 0, Math.PI * 2);
  ctx.fillStyle = "#ef4444";
  ctx.fill();

  // Landing point (Cyan)
  const landPt = trajectory[trajectory.length - 1];
  ctx.beginPath();
  ctx.arc(toScreenX(landPt.x), toScreenY(isXZ ? landPt.z : landPt.y), 4, 0, Math.PI * 2);
  ctx.fillStyle = "#38bdf8";
  ctx.fill();
}

// Initial calculation on launch
runSolver();
