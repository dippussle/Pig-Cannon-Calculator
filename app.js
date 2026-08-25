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
let canvasMode = "xz";

// Event Listeners
btnCalculate.addEventListener("click", runSolver);

btnCopyCommand.addEventListener("click", () => copyCommand("player"));
btnCopyPigCommand.addEventListener("click", () => copyCommand("pig"));

btnViewXZ.addEventListener("click", () => {
  canvasMode = "xz";
  btnViewXZ.classList.add("active");
  btnViewXY.classList.remove("active");
  if (selectedResult) drawTrajectory(selectedResult.trajectory);
});

btnViewXY.addEventListener("click", () => {
  canvasMode = "xy";
  btnViewXY.classList.add("active");
  btnViewXZ.classList.remove("active");
  if (selectedResult) drawTrajectory(selectedResult.trajectory);
});

function copyCommand(targetType) {
  if (!selectedResult) return;
  const pos = selectedResult.landingPos;
  const cmd = targetType === "pig"
    ? `/tp @e[type=pig,limit=1,sort=nearest] ${pos.x.toFixed(2)} ${pos.y.toFixed(2)} ${pos.z.toFixed(2)}`
    : `/tp @p ${pos.x.toFixed(2)} ${pos.y.toFixed(2)} ${pos.z.toFixed(2)}`;

  navigator.clipboard.writeText(cmd).then(() => {
    const btn = targetType === "pig" ? btnCopyPigCommand : btnCopyCommand;
    const prev = btn.textContent;
    btn.textContent = "Copied!";
    btn.style.background = "#10b981";
    btn.style.color = "#fff";
    setTimeout(() => {
      btn.textContent = prev;
      btn.style.background = "";
      btn.style.color = "";
    }, 1500);
  });
}

function getDistance2D(x1, z1, x2, z2) {
  const dx = x2 - x1;
  const dz = z2 - z1;
  return Math.sqrt(dx * dx + dz * dz);
}

function getDistance3D(p1, p2) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const dz = p2.z - p1.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// Closed-form sum for horizontal displacement
function calcUnitDisplacement(t, totalTicks) {
  if (t <= 0 || totalTicks <= 0 || t > totalTicks) return 0;
  const term1 = t;
  const term2 = Math.pow(PIG_DRAG, totalTicks - t + 1) * ((1 - Math.pow(PIG_DRAG, t)) / (1 - PIG_DRAG));
  return (term1 - term2) / (1 - PIG_DRAG);
}

// Closed-form sum for vertical drop Y
function calcVerticalDrop(totalTicks) {
  let vy = 0;
  let yDrop = 0;
  for (let t = 1; t <= totalTicks; t++) {
    yDrop += vy;
    vy = (vy - PIG_GRAVITY) * PIG_DRAG;
  }
  return yDrop;
}

function simulatePig(origin, boats, dirX, dirZ, t1, t2, totalTicks) {
  let x = origin.x, y = origin.y, z = origin.z;
  let vx = 0, vy = 0, vz = 0;

  const trajectory = [];
  trajectory.push({ tick: 0, time: "0.00", phase: "Launcher Setup", x, y, z, vx, vy, vz, speed: 0 });

  for (let t = 1; t <= totalTicks; t++) {
    let activeStacks = 0;
    if (t <= t1) activeStacks++;
    if (t <= t2) activeStacks++;

    let phase = "Free Flight";
    if (activeStacks === 2) {
      phase = "Colliding (Stack 1 & Stack 2)";
    } else if (t <= t1 && t > t2) {
      phase = "Colliding (Stack 1 Only)";
    } else if (t > t1 && t <= t2) {
      phase = "Colliding (Stack 2 Only)";
    }

    if (activeStacks > 0) {
      const push = activeStacks * boats * EFFECTIVE_MOTION_PER_BOAT;
      vx += push * dirX;
      vz += push * dirZ;
    }

    x += vx;
    y += vy;
    z += vz;

    vx *= PIG_DRAG;
    vz *= PIG_DRAG;
    vy = (vy - PIG_GRAVITY) * PIG_DRAG;

    const speed = Math.sqrt(vx * vx + vy * vy + vz * vz) * 20;

    trajectory.push({
      tick: t,
      time: (t * 0.05).toFixed(2),
      phase,
      x, y, z,
      vx, vy, vz,
      speed
    });
  }

  return trajectory;
}

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

  const boats = parseInt(boatsPerStackInput.value, 10) || 1;
  const maxCollision = parseInt(maxCollisionTicksInput.value, 10) || 100;
  const maxTicks = parseInt(maxTicksInput.value, 10) || 300;

  if (boats <= 0) {
    alert("Please enter a valid boat count.");
    return;
  }

  const dx = target.x - origin.x;
  const dz = target.z - origin.z;
  const dirX = dx >= 0 ? 1 : -1;
  const dirZ = dz >= 0 ? 1 : -1;

  const targetDist2D = getDistance2D(origin.x, origin.z, target.x, target.z);
  if (targetDist2D === 0) {
    alert("Origin and Target coordinates must be different.");
    return;
  }

  const stackPush = boats * EFFECTIVE_MOTION_PER_BOAT;
  const collisionLimit = Math.min(maxCollision, maxTicks);
  const candidates = [];

  // Analytical search capping flight time to actual travel duration
  for (let t1 = 1; t1 <= collisionLimit; t1++) {
    for (let t2 = t1; t2 <= collisionLimit; t2++) {
      const minFlight = Math.max(t1, t2);
      // Realistic travel time limit until drag stops forward velocity (~40t post collision)
      const maxEffectiveFlight = Math.min(maxTicks, minFlight + 45);

      for (let tTotal = minFlight; tTotal <= maxEffectiveFlight; tTotal++) {
        const u1 = calcUnitDisplacement(t1, tTotal);
        const u2 = calcUnitDisplacement(t2, tTotal);
        const calcDisp = stackPush * (u1 + u2);
        const errHoriz = Math.abs(calcDisp - targetDist2D);

        const yDrop = calcVerticalDrop(tTotal);
        const calcY = origin.y + yDrop;
        const errY = Math.abs(calcY - target.y);

        const err3D = Math.sqrt(errHoriz * errHoriz + errY * errY);

        candidates.push({ t1, t2, tTotal, err: err3D, errHoriz });
      }
    }
  }

  candidates.sort((a, b) => a.err - b.err);

  const seen = new Set();
  const topList = [];
  for (const c of candidates) {
    const key = `${c.t1}_${c.t2}_${c.tTotal}`;
    if (!seen.has(key)) {
      seen.add(key);
      topList.push(c);
      if (topList.length >= 25) break;
    }
  }

  solverResults = [];

  topList.forEach(c => {
    const traj = simulatePig(origin, boats, dirX, dirZ, c.t1, c.t2, c.tTotal);
    const last = traj[traj.length - 1];
    const landingPos = { x: last.x, y: last.y, z: last.z };

    const err3D = getDistance3D(landingPos, target);
    const landDist = getDistance2D(origin.x, origin.z, landingPos.x, landingPos.z);

    let status = "Exact";
    let statusClass = "exact";

    if (Math.abs(landDist - targetDist2D) > 0.1) {
      if (landDist > targetDist2D) {
        status = "Overshoot";
        statusClass = "overshoot";
      } else {
        status = "Undershoot";
        statusClass = "undershoot";
      }
    }

    solverResults.push({
      t1: c.t1,
      t2: c.t2,
      tTotal: c.tTotal,
      boats,
      origin,
      target,
      landingPos,
      error: err3D,
      status,
      statusClass,
      trajectory: traj
    });
  });

  solverResults.sort((a, b) => a.error - b.error);
  solverResults = solverResults.slice(0, 15);

  renderTable();

  if (solverResults.length > 0) {
    selectResult(0);
  } else {
    solverTbody.innerHTML = `<tr><td colspan="7" class="table-placeholder">No solutions found. Adjust parameters.</td></tr>`;
    resultsCount.textContent = "0 solutions";
  }
}

function renderTable() {
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
      <td>${res.boats}</td>
      <td>${posStr}</td>
      <td class="${res.error < 1 ? 'text-success' : 'text-warning'}">${res.error.toFixed(2)}m</td>
      <td><span class="status-pill ${res.statusClass}">${res.status}</span></td>
    `;

    tr.addEventListener("click", () => selectResult(idx));
    solverTbody.appendChild(tr);
  });
}

function selectResult(index) {
  selectedResult = solverResults[index];

  const rows = solverTbody.querySelectorAll("tr");
  rows.forEach((row, idx) => {
    if (idx === index) row.classList.add("selected");
    else row.classList.remove("selected");
  });

  const pos = selectedResult.landingPos;
  tpCommandText.textContent = `/tp @p ${pos.x.toFixed(2)} ${pos.y.toFixed(2)} ${pos.z.toFixed(2)}`;

  renderTickTable(selectedResult.trajectory);
  drawTrajectory(selectedResult.trajectory);
}

function renderTickTable(trajectory) {
  tickTbody.innerHTML = "";

  trajectory.forEach(pt => {
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

function drawTrajectory(trajectory) {
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
  const isXZ = canvasMode === "xz";

  let minH = trajectory[0].x, maxH = trajectory[0].x;
  let minV = isXZ ? trajectory[0].z : trajectory[0].y;
  let maxV = isXZ ? trajectory[0].z : trajectory[0].y;

  const targetH = targetX;
  const targetV = isXZ ? targetZ : targetY;

  minH = Math.min(minH, targetH);
  maxH = Math.max(maxH, targetH);
  minV = Math.min(minV, targetV);
  maxV = Math.max(maxV, targetV);

  trajectory.forEach(p => {
    const hv = p.x;
    const vv = isXZ ? p.z : p.y;
    if (hv < minH) minH = hv;
    if (hv > maxH) maxH = hv;
    if (vv < minV) minV = vv;
    if (vv > maxV) maxV = vv;
  });

  const padding = 35;
  const rangeH = (maxH - minH) || 10;
  const rangeV = (maxV - minV) || 10;

  function toScreenX(val) {
    return padding + ((val - minH) / rangeH) * (w - 2 * padding);
  }

  function toScreenY(val) {
    if (!isXZ) {
      return (h - padding) - ((val - minV) / rangeV) * (h - 2 * padding);
    }
    return padding + ((val - minV) / rangeV) * (h - 2 * padding);
  }

  // Grid
  ctx.strokeStyle = "#1e293b";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let gx = 0; gx <= 4; gx++) {
    const px = padding + (gx / 4) * (w - 2 * padding);
    ctx.moveTo(px, 0);
    ctx.lineTo(px, h);
  }
  for (let gy = 0; gy <= 3; gy++) {
    const py = padding + (gy / 3) * (h - 2 * padding);
    ctx.moveTo(0, py);
    ctx.lineTo(w, py);
  }
  ctx.stroke();

  // Axis label
  ctx.fillStyle = "#64748b";
  ctx.font = "10px 'JetBrains Mono'";
  ctx.fillText(isXZ ? "Top-Down (X-Z)" : "Side Elevation (X-Y)", padding, 15);

  // Trajectory line
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

  // Highlight collision phase
  ctx.beginPath();
  let hasCollision = false;
  trajectory.forEach(pt => {
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

  // Start point
  const first = trajectory[0];
  ctx.beginPath();
  ctx.arc(toScreenX(first.x), toScreenY(isXZ ? first.z : first.y), 6, 0, Math.PI * 2);
  ctx.fillStyle = "#10b981";
  ctx.fill();

  // Target point
  ctx.beginPath();
  ctx.arc(toScreenX(targetH), toScreenY(targetV), 6, 0, Math.PI * 2);
  ctx.fillStyle = "#ef4444";
  ctx.fill();

  // Landing point
  const last = trajectory[trajectory.length - 1];
  ctx.beginPath();
  ctx.arc(toScreenX(last.x), toScreenY(isXZ ? last.z : last.y), 4, 0, Math.PI * 2);
  ctx.fillStyle = "#38bdf8";
  ctx.fill();
}

// Run initial solve
runSolver();
