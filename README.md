# Minecraft Pig Cannon Calculator

A web-based Minecraft Pig Cannon ballistics calculator & tick-by-tick trajectory simulation tool.

Designed with the exact visual layout and responsive design of the **Lazy Chunk Boat Cannon Calculator**, enhanced with full **living entity tick physics** (air drag, gravity, boat stack push acceleration) for pigs.

## Features

- **Custom Boat Acceleration Model**: Input motion per boat per tick (default `0.0413265304548704`) and acceleration tick duration.
- **Powder Snow Version Multipliers**: Support for 1.21.9+ (`0.95`), Pre-1.21.9 (`0.90`), and custom/none (`1.00`).
- **Entity Physics Controls**: Pig air drag coefficient (default `0.91`), gravity per tick (default `0.08`), max boat stack limit, and max tick search range.
- **Optimal Solutions Table**: Finds the best boat counts $(N_x, N_z)$ ranked by distance error.
- **Teleport Command Generator**: Copy `/tp @p` and `/tp @e[type=pig]` commands with 1 click.
- **Tick-by-Tick Telemetry Inspector**: Shows full position $(X, Y, Z)$, velocity $(V_x, V_y, V_z)$, speed, and phase (`Accelerating` / `Free Flight`) for every single tick.
- **Interactive Trajectory Visualizer**: Toggle between 2D Top Radar (X-Z) and Side Elevation Profile (X-Y).

## Usage

Simply open `index.html` in any modern web browser.
