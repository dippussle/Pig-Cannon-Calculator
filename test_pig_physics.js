// Unit test script for Pig Cannon Calculator physics solver

function getUnitDisplacement(accelTicks, totalTicks, effectiveMotion, drag) {
  let pos = 0;
  let vel = 0;

  for (let t = 1; t <= totalTicks; t++) {
    if (t <= accelTicks) {
      vel += effectiveMotion;
    }
    pos += vel;
    vel *= drag;
  }

  return pos;
}

function simulatePigTrajectory(origin, bx, bz, dirX, dirZ, accelTicks, totalTicks, effectiveMotion, drag, gravity) {
  let x = origin.x;
  let y = origin.y;
  let z = origin.z;

  let vx = 0;
  let vy = 0;
  let vz = 0;

  const trajectory = [];
  trajectory.push({ tick: 0, time: "0.00", phase: "Launcher", x, y, z, vx, vy, vz, speed: 0 });

  const pushX = bx * effectiveMotion * dirX;
  const pushZ = bz * effectiveMotion * dirZ;

  for (let t = 1; t <= totalTicks; t++) {
    const isAccel = t <= accelTicks;

    if (isAccel) {
      vx += pushX;
      vz += pushZ;
    }

    x += vx;
    y += vy;
    z += vz;

    vx *= drag;
    vz *= drag;
    vy = (vy - gravity) * drag;

    const speedVal = Math.sqrt(vx*vx + vy*vy + vz*vz) * 20;

    trajectory.push({
      tick: t,
      time: (t * 0.05).toFixed(2),
      phase: isAccel ? "Accelerating" : "Free Flight",
      x, y, z,
      vx, vy, vz,
      speed: speedVal
    });
  }

  return trajectory;
}

// Test 1: Linearity of Unit Displacement
const rawMotion = 0.0413265304548704;
const snowMult = 0.95;
const effectiveMotion = rawMotion * snowMult;
const drag = 0.91;
const gravity = 0.08;

const unitDisp20t = getUnitDisplacement(1, 20, effectiveMotion, drag);
const origin = { x: 0, y: 64, z: 0 };
const traj10b = simulatePigTrajectory(origin, 10, 0, 1, 1, 1, 20, effectiveMotion, drag, gravity);
const lastPoint = traj10b[traj10b.length - 1];

console.log("=== Pig Physics Verification ===");
console.log("Unit Displacement for 1 boat (20t):", unitDisp20t.toFixed(6));
console.log("Expected X for 10 boats:", (10 * unitDisp20t).toFixed(6));
console.log("Simulated X for 10 boats:", lastPoint.x.toFixed(6));

const diff = Math.abs(10 * unitDisp20t - lastPoint.x);
if (diff < 1e-10) {
  console.log("SUCCESS: Linear boat stack displacement matches simulation tick-by-tick exactness!");
} else {
  console.error("FAIL: Linear displacement discrepancy", diff);
  process.exit(1);
}

// Test 2: Check Tick Telemetry Count
if (traj10b.length === 21) { // tick 0 to 20
  console.log("SUCCESS: Trajectory telemetry array contains exact 21 tick snapshots (0..20)!");
} else {
  console.error("FAIL: Unexpected telemetry length:", traj10b.length);
  process.exit(1);
}

console.log("All physics verification tests passed cleanly!");
