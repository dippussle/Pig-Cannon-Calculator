// Unit test script for Dual Boat Stack collision duration solver logic

const EFFECTIVE_MOTION_PER_BOAT = 0.0413265304548704 * 0.95;
const PIG_DRAG = 0.91;
const PIG_GRAVITY = 0.08;

function simulatePigTrajectory(origin, boatsPerStack, dirX, dirZ, t1, t2, totalTicks) {
  let x = origin.x;
  let y = origin.y;
  let z = origin.z;

  let vx = 0;
  let vy = 0;
  let vz = 0;

  const trajectory = [];
  trajectory.push({ tick: 0, time: "0.00", phase: "Launcher Setup", x, y, z, vx, vy, vz, speed: 0 });

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

    x += vx;
    y += vy;
    z += vz;

    vx *= PIG_DRAG;
    vz *= PIG_DRAG;
    vy = (vy - PIG_GRAVITY) * PIG_DRAG;

    const speedVal = Math.sqrt(vx*vx + vy*vy + vz*vz) * 20;

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

console.log("=== Testing Dual Boat Stack Physics ===");
const origin = { x: 0, y: 64, z: 0 };
// Stack 1 collides for 4 ticks, Stack 2 collides for 8 ticks
const traj = simulatePigTrajectory(origin, 20, 1, 1, 4, 8, 20);

console.log("Tick 3 state (both active):", traj[3].phase);
console.log("Tick 6 state (Stack 2 only):", traj[6].phase);
console.log("Tick 10 state (free flight):", traj[10].phase);

if (traj[3].phase === "Colliding (Stack 1 & Stack 2)" &&
    traj[6].phase === "Colliding (Stack 2 Only)" &&
    traj[10].phase === "Free Flight") {
  console.log("SUCCESS: Dual boat stack collision tick phases verified cleanly!");
} else {
  console.error("FAIL: State phase mismatch", traj[3].phase, traj[6].phase, traj[10].phase);
  process.exit(1);
}
