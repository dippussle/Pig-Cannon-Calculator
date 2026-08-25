// Unit test script for updated Pig Cannon collision duration solver logic

const EFFECTIVE_MOTION_PER_BOAT = 0.0413265304548704 * 0.95;
const PIG_DRAG = 0.91;
const PIG_GRAVITY = 0.08;

function simulatePigTrajectory(origin, bx, bz, dirX, dirZ, collisionTicks, totalTicks) {
  let x = origin.x;
  let y = origin.y;
  let z = origin.z;

  let vx = 0;
  let vy = 0;
  let vz = 0;

  const trajectory = [];
  trajectory.push({ tick: 0, time: "0.00", phase: "Launcher", x, y, z, vx, vy, vz, speed: 0 });

  const pushX = bx * EFFECTIVE_MOTION_PER_BOAT * dirX;
  const pushZ = bz * EFFECTIVE_MOTION_PER_BOAT * dirZ;

  for (let t = 1; t <= totalTicks; t++) {
    const isColliding = t <= collisionTicks;

    if (isColliding) {
      vx += pushX;
      vz += pushZ;
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
      phase: isColliding ? "Colliding with Boats" : "Free Flight",
      x, y, z,
      vx, vy, vz,
      speed: speedVal
    });
  }

  return trajectory;
}

console.log("=== Testing Collision Duration Solver Physics ===");
const origin = { x: 0, y: 64, z: 0 };
const traj = simulatePigTrajectory(origin, 20, 0, 1, 1, 5, 30);

console.log("Total snapshots (0..30):", traj.length);
console.log("Tick 5 state (last collision tick):", traj[5].phase);
console.log("Tick 6 state (first free flight tick):", traj[6].phase);

if (traj[5].phase === "Colliding with Boats" && traj[6].phase === "Free Flight") {
  console.log("SUCCESS: Collision duration tick phases verified!");
} else {
  console.error("FAIL: State phase mismatch", traj[5].phase, traj[6].phase);
  process.exit(1);
}
