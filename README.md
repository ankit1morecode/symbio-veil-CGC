# SymbioConstellaris VEIL

VEIL is a local spacecraft-cooperation research application with an interactive 3D orbital command center, component-level spacecraft inspection, fault injection, explainable recovery planning and joint operations. It explores when independent, wireless, temporarily coupled or persistently integrated spacecraft can preserve a mission within explicit physical and donor-safety constraints.

This implementation uses the requested MERN stack: React, Express and Node.js, with optional MongoDB persistence through Mongoose. A local JSON persistence mode lets the application run without a MongoDB installation. All reference spacecraft and fault parameters are synthetic research fixtures; the application is not flight software or a real spacecraft-command interface.

## Run locally

Install Node.js 22.12 or newer and npm. A current desktop browser with WebGL2 is recommended for the 3D scenes.

```powershell
cd symbio-veil
npm install
npm run dev
```

Open `http://127.0.0.1:5173`. The development command starts the Express simulation service on `127.0.0.1:4000` and Vite on port 5173. Vite proxies `/api` and WebSocket traffic to the local service. Stop both processes with Ctrl+C.

Dependencies need network access for their initial installation. Earth textures and application assets are bundled locally; the running simulation does not require a cloud account or external telemetry service.

To use a running local MongoDB instance, set the environment variable before starting the application:

```powershell
$env:MONGODB_URI = 'mongodb://127.0.0.1:27017/veil'
npm run dev
```

The server reads `MONGODB_URI` from its process environment and automatically loads an optional local `.env` file from the project directory with Node's environment-file loader. You may therefore put `MONGODB_URI=mongodb://127.0.0.1:27017/veil` in the ignored `.env` file instead of setting it in PowerShell. Without a usable MongoDB connection, local atomic JSON run journals under `data/runs/` provide the documented fallback; check the application/server persistence status to distinguish connected, not configured and unavailable modes. `DATA_DIRECTORY` can override the local journal directory. Never place database credentials in source control. `PORT` can override the backend's default port, but the Vite proxy must then point at the same port.

## Deploy online

For a Vercel frontend, a Render simulation service, and MongoDB Atlas persistence, follow the [deployment guide](docs/deploy-vercel-render.md). The hosted version is a shared synthetic research demonstration; user authentication, private run ownership, and multi-instance coordination are not implemented.

## Build and verify

```powershell
npm test
npm run build
npm start
```

`npm test` runs the implemented Node test suite. `npm run build` creates the production frontend in `dist/`. `npm start` serves both the built frontend and Express API at `http://127.0.0.1:4000`. A Vite production preview is also available with `npm run preview`; simulation behavior still requires the local API service.

The test suite covers implemented foundations and regression cases. It must not be interpreted as full dossier release acceptance. Full FAT-001–030, UI/SYS matrices, E0–E6 research validation, the G7 release gate, hardware calibration and reference-machine performance remain subject to recorded evidence. See the [verification report](docs/verification-report.md), [model validity](docs/model-validity.md) and [requirements reference](docs/requirements-reference.md).

## Explore the application

1. Start a new six-spacecraft constellation from the dashboard. Rotate and zoom the Earth scene; select a spacecraft to open its digital twin. The scenario library also offers two, five and ten spacecraft.
2. Inspect the component hierarchy and its modeled health, battery, mission and dependencies. Use the observation/truth controls to understand the difference between what exists and what an agent knows.
3. Select an eligible component in the fault console, choose a supported fault model and inject or schedule an incident. Manual, automatic and hybrid modes share the simulation engine.
4. Inspect recovery candidates, hard rejection reasons, weighted scores, contract state and actual outcome. External assistance can complete a task while the original component remains failed.
5. Open an active pair to inspect each participant, separate mechanical/data/power states, flow direction, resource accounting and termination feasibility.
6. Try E0–E6, pause/step/change simulation speed, inspect events, save checkpoints and export the run evidence. Compare policies using shared initial conditions and seeds.

New runs launched in the browser default to six spacecraft. The app resumes a previously saved run without changing its spacecraft count; use **Start six-satellite simulation** or choose six in the scenario library to create a new one. Existing saved runs are not converted. The backend API retains its two-spacecraft default unless a count is supplied.

In a six-spacecraft run, the synthetic coordination network selects feasible peer links in 30-second simulation slots. It ranks links by mission urgency, health and energy reserve, then rotates among previously contacted pairs. One spacecraft participates in at most one coordination link per slot; Earth occlusion, radio availability, authorization, temperature, reserve protection and active mission reservations can block a link. Coordination traffic records data and radio energy separately from a mission-service contract. The network is disabled for independent policy B0 and scenario E0, and for other constellation sizes. Pausing stops simulated transmissions; stepping advances them by the requested simulation time.

Controls send validated commands to one authoritative local simulation service. Changing camera position or opening a panel does not advance the simulation or change physical resources. Satellite models and selection indicators are enlarged schematic visuals.

## Reference scenarios

| ID | Purpose |
|---|---|
| VEIL-REF-01 | Reference constellation with an operator-selected fault; the browser defaults to six spacecraft |
| E0 | Independent baseline after processor loss |
| E1 | Wireless processing assistance |
| E2 | Temporary physical support in deliberately reachable geometry |
| E3 | Reciprocal compatible services |
| E4 | Low-energy emergency and donor reserve protection |
| E5 | Cross-generation compatible service versus incompatible direct interface |
| E6 | Persistent integration and coupled physical properties |

Policy families are B0 independent/local, B1 reactive compatible donor, B2 docking-first recovery and B3 VEIL configuration-aware planning. Treat comparison results as outputs of the declared demonstration model, with its assumptions and limits.

## Source map

- `src/`: React interface, charts and 3D scenes.
- `server/`: Express/WebSocket API, deterministic simulation, physics, scenario/component catalog and persistence.
- `tests/`: implemented automated regression tests.
- `src/assets/`: local Earth textures.
- `docs/requirements-reference.md`: dossier-derived scope and acceptance checklist.
- `docs/model-validity.md`: equations, fixtures, fidelity boundaries and unverified criteria.
- `docs/licenses.md`: dependency and asset credits.

The source dossiers are project references. The explicit request for MERN determines this implementation's stack; their proposed Python service is not used.

## Optional MongoDB service with Docker

Run `docker compose up -d` from the project folder, then copy `.env.example` to `.env` and enable `MONGODB_URI=mongodb://127.0.0.1:27017/veil`. Restart the app. The database port binds to localhost. Without a running configured database, the UI discloses the local journal fallback.

For Windows, double-click `Start-VEIL.cmd` to start the application after installation.
