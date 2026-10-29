# VEIL implementation reference

This checklist summarizes the two user-supplied dossiers for implementation planning. It records requirements, not completed or verified behavior. The user's explicit request for a MERN application and impressive 3D UI takes precedence over the dossier's proposed Python backend. Instructions about approvals, scope control, and release gates in the documents describe the project process; they do not instruct the assistant to stop work or obtain additional permission.

Source documents: `SymbioConstellaris_VEIL_Software_Creation_Dossier_SCD_1_0.docx` (VEIL-SCD-001 revision 1.0, 29 October 2026), and `SymbioConstellaris_VEIL_Final_Systems_Dossier.docx` (SCV-SYS-001 FE/CE 1.0). SCD supplies the detailed software requirements; the systems dossier supplies intent and CE-001–016 constraints. The SCD remains a proposed handoff baseline with owner sign-off pending.

## Product and honesty constraints

- Research question: can configuration-aware spacecraft cooperation restore more verified mission capability than independent and simpler policies while honoring physical and donor limits?
- Local-first browser UI, locally runnable authoritative simulation service, offline runtime after installation, no real hardware-command interface.
- Three main workspaces: P01 Orbital Command, P02 Satellite Twin, P03 Symbiotic Pair Twin; supporting Decision Inspector and Event Timeline.
- Failure, no compatible donor, aborted capture, partial transfer, missed deadline and safe degradation are valid outcomes. Never force successful recovery for presentation.
- Display synthetic configuration provenance. P1 = reference constant, P2 = synthetic fixture, P3 = calibrated spacecraft parameter. P2 data do not establish flight reliability.
- No LLM flight control, external live satellite telemetry, universal protocol converter, resource marketplace, unmodeled adapter, cloud account dependency or claim of flight qualification.
- The documents request full FAT/UI/system/numerical acceptance evidence. Do not label any unimplemented or untested criterion complete. Unmeasured performance is UNVERIFIED.

## Screen and interaction checklist

### P01 Orbital Command (UX-001–010)

- Earth-centered rotatable 3D scene; recognizable local Earth texture, day/night illumination and axis rotation; valid seeded orbital elements and propagated trajectories.
- Default two spacecraft; optional ten-spacecraft stress preset. Enlarged spacecraft visuals explicitly marked nonphysical scale.
- Top bar: identity, scenario, simulation seconds, scale, fault mode, play/pause status, spacecraft count.
- Fleet summary: healthy/degraded/failed/unknown counts, wireless pairs, physical formations, unresolved missions.
- Single satellite click opens its twin. Single active pair click opens pair twin. Hover/focus may expose compact battery/health/mission preview.
- Animated directional cyan data flows only while valid; visibly distinct physical coupling. Wireless sessions must not depict a mechanical bond or electrical power transfer.
- Event feed with simulation time, target, severity, class, cause link, satellite/class filters.
- Health colors also have readable text/icons. Camera transitions, labels, trail toggles and panel movement do not change physical state.

### P02 Satellite Twin (UX-011–019A)

- Rotatable/zoomable structural spacecraft model, component selection linked to hierarchy, optional exploded view, collapsible manifest tree and detail inspector.
- Show all declared components and only declared telemetry. OSV-REF and hardware-agnostic GENERAL-REF manifests must both be supplied and versioned.
- OSV minimum boards: alpha executive, beta regulated power, gamma comms, delta GNC, psi docking, Omega motherboard, xi energy, mission payload and declared expansion cards.
- Alpha: controller, watchdog, executive service, scheduler, configuration store, boot/reset state.
- Beta: input link, rails, protections/switches, sensors, EPS supervisor, per-rail voltage/current.
- Gamma: RF-A critical, RF-B mission, RF-C peer, controller, buffers, per-link state.
- Delta: attitude sensor, estimator, actuators, propulsion if present, docking controller.
- Psi: management link, route fabric, transfer path, isolation/protection, contact sensor.
- Omega: management MCU, slot presence/power, CAN/I2C/SPI/UART and slot health.
- Xi: battery/BMS, solar/MPPT, generation, external charging path.
- Mission: at least one processor or payload service, typed input/output and resource dependencies.
- Structural model: mass, center of mass, inertia, port orientation, panel/antenna geometry.
- Component detail: stable ID/name/parent, faultability, truth health only in research view, observed health/confidence, modeled power/temperature/operation, dependencies, incidents, last update.
- Satellite summary: identity, mission, mode, observation health, battery Wh/SoC, generation/load, alerts. Derive board health from essential services/dependencies, never a mean percentage.
- Context-sensitive fault console lists eligible target/model combinations only. Fault, symptom, diagnosis, affected task and recovery status remain separate.
- Trend plots use recorded model-produced battery, generation/load/transfer power, relevant temperatures and capability availability.

### P03 Pair Twin (UX-020–029)

- Both spacecraft models visible together with independent selection/pan/zoom, synchronized simulation time, full selectable trees and telemetry for each.
- Header: both IDs, mode, SRCC ID, verification. Modes include WIRELESS/APPROACH/MECHANICAL/DIRECT_LINK/SYMBIOTIC/INTEGRATED/TERMINATING.
- Display individual batteries, reserve margins, power in/out, compute/data loads, health and alarms; distinguish observed and actual state.
- Center flow view shows only active verified exchanges, direction, rate, totals, losses; data and power paths visually distinct.
- Lifecycle actual timestamps: request → acceptance → rendezvous → capture → interfaces → service → verification → termination/abort → separation.
- Detachment ETA requires a feasible release plan. Otherwise show NOT DETERMINED or SEPARATION NOT CURRENTLY SAFE with grounded reason.
- Mid-bond failure updates contract, both twins, transfer and release forecast. Unsafe separation leaves SAFE COUPLED/ISOLATED.
- Successful separation resumes independent propagation with updated resources and relative state, preserving outcome summary.
- Wireless pair labeled CROSS-LINK, without latch/direct electrical flow.

### Shared controls and journeys

- Play/pause, 1x/10x/100x, numeric simulation seconds, deterministic step to next event or configured unit.
- Reset restores saved initial state and seed; confirm before discarding unsaved run. Reseed only explicitly.
- Scenario/checkpoint save and compatible load; corrupt/incompatible versions explain rejection.
- Truth/Agent Observations switch affects visibility only, never planner inputs.
- Fault mode HYBRID/MANUAL/AUTOMATIC; Demo/Research profile, seed, spacecraft/subsystem/component, eligible fault, physical parameters with units, now/future activation.
- Decision inspector: local/no-help and all eligible peer alternatives, hard checks/rejections, normalized score terms/weights, costs, chosen provider/mode, confidence, predicted completion and actual outcome.
- Event timeline supports cause/root/descendant inspection and replay branch.
- UJ-01 inspect board/component; UJ-02 inject mission fault; UJ-03 hybrid auto fault; UJ-04 wireless assistance; UJ-05 physical support then separation; UJ-06 mid-bond incident; UJ-07 matched policy comparison and export.

## Architecture and data checklist

| Module | Ownership |
|---|---|
| M01 World/kernel | One authoritative clock, physical state, event queue, propagators, RNG streams and ledger |
| M02 Agents | Local observations, beliefs, policies, authority, consent and local safety |
| M03 Missions/capabilities | Typed services, task DAG, quality, deadlines, compatibility and dependencies |
| M04 Fault/FDIR | Triggering, effects, propagation, observations, causal links and bounded recovery |
| M05 Feasibility | Hard physics, interface, time, energy, thermal, permission and reserve gates |
| M06 Planner | Eligible alternatives, normalized ranking, forecasts and reasons |
| M07 SRCC | Bilateral consent, reservations, caps, expiration, revisions and veto |
| M08 Executor | Guarded approach/capture/transfer/separation, accounting and aborts |
| M09 Verification | Independent output evidence, experiments, metrics, exports and limits |

- ARCH-001–003: UI sends validated commands rather than mutating truth; enforce module boundaries; commands idempotent by ID or explicitly reject duplicates.
- DATA-001–007: internal SI, explicit ECI versus ECEF, versioned UTC epoch with monotonic simulation seconds, parameter units/provenance/ranges/model versions, versioned schemas, append-only events, deterministic RNG/event-queue checkpoints, one energy/propellant ledger.
- Required entities: Scenario, Spacecraft, Component, Capability, MissionTask, Observation, FaultDefinition, FaultEvent, CandidatePlan, SRCC, Connection, LedgerEntry, ExperimentRun, Checkpoint.
- Checkpoint includes world state, queue, per-stream RNG, contracts, ledger heads and checksum. Replay compares agreed run hashes/state tolerances.
- Agents receive only measured messages/estimators with time/uncertainty/staleness. Truth overlay must never leak to planner input.
- Observation model supports sample period, latency, noise, bias, dropouts and stale timeout.
- Capability match checks typed function, semantic versions, IO, quality, prerequisites, costs, windows, permissions and permitted modes. Matching names alone is insufficient.
- Mission DAG states: WAITING, READY, EXECUTING, PAUSED, COMPLETED, FAILED, EXPIRED. Evidence, provider, quality and deadline determine verification.
- Separate physical repair, local recovery, external support, degraded completion and unresolved failure.

## Physics and planning checklist

- Two-body Kepler propagation from valid orbital elements; no teleportation as cooperation effect. Numerical or closed-form solver is described as allowed in §8.1; NUM-001 additionally names adaptive Runge–Kutta as baseline. State and document chosen fidelity.
- Battery power ledger, geometric eclipse, finite usable capacity and protected donor commitments; receiver gets no more than exported energy times efficiency.
- Lumped thermal dynamics evolve physical temperature and threshold persistence/hysteresis.
- Links need LOS/contact windows, useful bitrate, integrated capacity, latency/errors and radio energy.
- Rendezvous finite time with valid relative regime, maneuver/fuel/control/attitude corridor; capture checks distance, speed, orientation, port geometry and structural proxies.
- Recompute coupled mass, COM, inertia with parallel-axis theorem, available control and applicable safety after capture.
- Mechanical state, data state, power state and functional state remain orthogonal. Coupling does not merge executive authority.
- No negative mass, energy, fuel, capacity or impossible transfer. Epsilon corrections require documented tolerance and ledger entry.
- Event times stored at least 1 ms precision. Reference telemetry output maximum 10 s orbit and 1 s resources; event substeps near threshold/contact/docking.
- Reference 24 h orbit energy and angular momentum relative drift ≤0.1%; thermal threshold error ±2 s in specified test.
- Planner checks authority, typed quality, deadlines/link windows, rendezvous/capture, ratings, donor/recipient energy/thermal, control/fuel, reservations and expiration before ranking.
- Candidate alternatives include local recovery, controlled degradation, defer/no-cooperation, wireless, temporary physical and scenario-permitted persistent integration; consider all discoverable compatible donors.
- Feasible-only score: `0.40 B + 0.20 (1-T) + 0.15 (1-C) + 0.15 (1-R) + 0.10 (1-D)`, normalized [0,1] by explicit positive scenario scales.
- Unknown quality, costs, donor impact, bounds or horizon => UNSCORABLE, grounded conservative fallback/refusal. Never NaN/divide-by-zero/hidden constants.
- Within score .01 choose C0, then C1, C2, C3; then earliest completion; then stable participant ID.
- Relevant event or decision epoch triggers replan, 30 s synthetic cooldown unless hard safety demands immediate action.
- Plan is a proposal; fresh feasibility, bilateral acceptance, reservations, authorization and local veto precede execution.

## Fault engine checklist

- One physical-effects path for manual and auto incidents. HYBRID default, also MANUAL and AUTOMATIC.
- Triggers: exponential constant hazard, Weibull age hazard with valid beta/eta/units/provenance, condition threshold with persistence/hysteresis, progressive degradation, explicit schedule.
- Durations: PERMANENT, TRANSIENT, INTERMITTENT, PROGRESSIVE only where supported, each with defined clearing/recovery.
- Spontaneous off suppresses new random incidents, preserves current faults and physical threshold/degradation consequences. Passed auto times logged SUPPRESSED; re-enable resamples without retroactive burst.
- Stable event/root/parent IDs, deterministic ordering by time, priority, spacecraft ID, stable event ID. Apply simultaneous physical effects before observations/decisions.
- Concurrent effects use declared commutative rules or reject; dependency propagation is cycle-safe and applied once.
- Physical event lifecycle SCHEDULED/ACTIVE/SUPPRESSED/CLEARED/TERMINATED; observation UNKNOWN/OBSERVED/CONFIRMED; diagnosis UNASSESSED/SUSPECTED/DIAGNOSED; mission task state independent.
- Paused manual injection is an explicit simulation event, without bypassing safety or revealing hidden root cause to agents.
- Faults alter physical service, torque/navigation/links/power models; red UI alone is insufficient. Assistance never repairs physical source hardware automatically.

| ID | Class | Synthetic fixture |
|---|---|---|
| F-01 | Controller/computation | Capacity 1/.5/0; heartbeat 2 s, timeout 3 missed |
| F-02 | Regulated rail | 3.3 V; trip <3 V for .2 s, recover >3.15 V for 1 s |
| F-03 | Solar/MPPT | Sun generation 20/4/0 W; eclipse healthy and distinct |
| F-04 | Battery | Usable capacity 120→96 Wh with consistent stored/usable accounting |
| F-05 | Radio | 256/64/0 kbit/s; optional .10 packet loss |
| F-06 | Bus | Delivery 1/.7/0; monitor timeout 2 s |
| F-07 | Navigation measurement | Bias .05 deg/s, noise sigma .01 deg/s |
| F-08 | Attitude actuator | Torque .002/.001/0 N m; impacts dynamics/plans |
| F-09 | Thermal | C=150 J/K, P=3 W, sink=295 K, G=.20→.06 W/K |
| F-10 | Docking interface | 10 W permitted, 12 W attempt triggers configured protection |
| F-11 | Mission payload | Quality 1/.5/0; example requirement ≥.8 |
| F-12 | Monitoring | Temperature +8 K bias, sigma .5 K or frozen sample; truth unaffected |

## Cooperation and accounting checklist

- C0 independent local/defer/degrade; C1 authorized wireless data/compute/relay with no direct RF power; C2 temporary physical support; C3 persistent coupled integration.
- Mechanical: SEPARATE/APPROACH/CAPTURED/RELEASED. Data: ISOLATED/MANAGEMENT/OPERATIONAL. Power: ISOLATED/PROTECTED_ACTIVE/FAULT_ISOLATED. Functional: INDEPENDENT/REMOTE_SUPPORT/SYMBIOTIC/INTEGRATED.
- SRCC includes participants, mode/services, budget caps, reserves, expiry, interfaces, evidence, abort/veto rules, revision and signed policy acceptances.
- Lifecycle PROPOSED→ACCEPTED→RESERVED→AUTHORIZED→ACTIVE→VERIFIED→COMPLETED, with ABORTED/EXPIRED/REJECTED paths. No double allocation. Completion/abort releases unspent reservation, never spent energy/fuel.
- Transfer validates versions, V/I/W ratings, direction, efficiency, protections, donor forecast reserve and recipient capacity; enforce caps continuously.
- Aborted transfer isolates unsafe paths but retains delivered energy, losses, heat and spent propulsion.
- Separation requires valid release, safe relative motion, control and isolated interfaces. Unsafe case stays coupled with invalidated ETA.

## Numerical regression fixtures

All spacecraft/fault configuration values below are P2 synthetic unless marked P1.

| Test | Inputs | Expected evidence |
|---|---|---|
| NR-01 | P1 μ=398600441800000 m³/s², Earth R=6378137 m; circular r=6878137 m | Period `2π sqrt(r³/μ)` and conserved energy/angular momentum |
| NR-02 | 84 Wh, reserve 24 Wh, 8 W eclipse load, zero generation | Reserve at 7.5 h |
| NR-03 | 10 W exported, eta=.85, 600 s | 1.6667 Wh exported, ≤1.4167 Wh received, ≥.25 Wh lost |
| NR-04 | C=150, P=3, sink=295, G=.06, T0=310 | T=345−35 exp(−t/2500); crossing 333.15 K about 2707 s, then 10 s persistence |
| NR-05 | N=500, lambda=2e−4 per node-hour, T=24 h | Expected ≈2.4 primary incidents; P(any)≈.9093 |
| NR-06 | True 320 K, bias +8 K, zero test noise | Agent measured 328 K, evaluator true 320 K |
| NR-07 | Task quality ≥.8, donor output .5 | Reject despite free CPU |
| NR-08 | Torque .002→0 N m at known time | Physical authority changes and applicable plans invalidate |
| NR-09 | 10 Mbit at 256 kbit/s full contact | Ideal serialization ≈39.0625 s plus latency/overhead/outages |
| NR-10 | Valid termination ETA, later actuator fault | ETA invalidated; unsafe release stays coupled |

Reference seed 20261029; 24 h simulated duration; initial 120 Wh usable / 84 Wh stored / 24 Wh reserve / 20 W sun / 8 W load; Earth rotation 7.292115e−5 rad/s; optional initialization altitude 450–650 km, e≤.01, inclination 20°–98°. Hazard lambda=2e−4 per eligible node-hour is a low-rate research fixture and must not guarantee an incident in each short demo. Thermal release below 328.15 K for 60 s.

## Experiments and verification

| Scenario | Required evidence |
|---|---|
| E0 | Mission processor failure with no peer help; local/degraded outcome |
| E1 | Compatible wireless processing, modeled cost/deadline, assisted hardware stays failed |
| E2 | Reachable initial geometry, negotiate/approach/capture/validate/bounded exchange/verify/separate |
| E3 | B assists A and A performs feasible reciprocal service; net benefit accounts for cost |
| E4 | Rescue before survival horizon versus infeasible/late rescue, donor protected |
| E5 | Compatible generations accepted; incompatible interface/service rejected; no adapter invented |
| E6 | Persistent coupling changes COM/inertia/control/power and mission availability |

- Compare B0 independent, B1 nearest/first-compatible with same safety guards, B2 docking-first sequential, B3 VEIL weighted. Identical initial physics, exogenous events, seed streams where causally valid.
- Export scenario hash, software/model versions, initial states, numerical settings, seed, fault models, policy/weights, decisions, full ledger totals and limitations.
- Metrics: verified availability; quality/deadline/success/degradation/external dependence; detection and recovery times; energy/data/fuel and losses; donor reserve/mission impact; rejected/unsafe/aborted separately; unnecessary docking; robustness with justified confidence intervals; conservation/validity/reproducibility.
- Negative cases: no/unavailable donor, incompatible or unauthorized service, missed window, bandwidth shortfall, low donor reserve, power path failure, failed capture, infeasible rendezvous, late rescue, thermal excess, failed output quality.

## Acceptance test index

| FAT | Assertion |
|---|---|
| 001–007 | Hybrid single effects path; MANUAL no spontaneous; hazard statistics permit zero; same seed replay; FPS independent; step tolerances; invalid target no mutation |
| 008–014 | Rail dependencies only; thermal persistence; monitoring changes observed only; hidden fault unknown; concurrent combination; cycle-safe causal propagation; spontaneous off preserves active faults |
| 015–021 | No-donor unresolved; fault revalidates contract; protected reserve; short transient may escape detection; exact checkpoint resume; storage benchmark measured/reported; timeline correct target/root |
| 022–030 | Mid-bond twin/forecast update; essential health recompute; assistance no repair; GNC affects dynamics; direct power isolation; root grouping; disable/enable no burst; physical degradation persists; matched-policy causal randomness |

| UI | Assertion |
|---|---|
| 01–07 | Earth/two spacecraft; pause holds inertial state; seeded init; SAT-A correct summary; component dependencies/observation; UNKNOWN not green; compatible console |
| 08–14 | Explain alternatives/checks; wireless no latch/power; physical pair ledger; unsafe ETA absent; separate propagation; stress navigation; incident descendants/diagnosis |

| SYS | Assertion |
|---|---|
| 01–05 | 24 h orbit conservation; eclipse healthy; transfer conservation; abort retains spending; quality mismatch rejection |
| 06–10 | Reservation expiry/conflict; physical capture guards; inertia/control update; independent verification; no truth leak |
| 11–15 | Export provenance; offline E0–E6; actionable schema errors; one world across UI users; matched B0–B3 |

## API contract checklist

- `GET /api/v1/scenarios`, `POST /api/v1/runs`, `GET /api/v1/runs/:id/state`.
- `POST /api/v1/runs/:id/control`, `GET /api/v1/runs/:id/spacecraft/:satId`, `POST /api/v1/runs/:id/faults`.
- `GET /api/v1/runs/:id/decisions`, `/contracts`, `/connections`, `/events`; `POST /api/v1/runs/:id/checkpoints`.
- `POST /api/v1/experiments`, `GET /api/v1/exports/:runId`, `WS /api/v1/runs/:id/stream` with sequence/revision snapshot resync.
- Mutations require command/idempotency ID, run ID, expected state revision, server validation. No direct truth overwrite endpoint.
- Errors: INVALID_PARAMETER, UNSUPPORTED_FAULT, UNKNOWN_COMPONENT, MODEL_INVALID, FEASIBILITY_REJECTED, CONTRACT_CONFLICT, VERSION_MISMATCH, RUN_NOT_FOUND; actionable text and previous valid state retained.

## Delivery and unverified budgets

- One-command startup, install/build/run instructions, pinned lockfile, scenarios/manifests/versioned sample payloads, API/schema docs and ownership, model validity/units/calibration limits, asset/license inventory, release source/archive.
- Acceptance gates G0 schemas, G1 physics, G2 12 fault classes/FAT-001–030, G3 planner, G4 SRCC/executor, G5 UI journeys, G6 experiments/replay, G7 offline/performance/docs.
- 4-core 64-bit desktop, 16 GB RAM, WebGL2 reference: two spacecraft at 1080p ≥30 FPS; ten spacecraft ≥20 FPS; 50 faultable nodes per stress satellite.
- P95 cached inspector ≤300 ms, idle fault acknowledgment ≤500 ms; compact config+10,000 events+100 checkpoints ≤25 MB excluding assets/dense exports; backend sustained RAM ≤2 GB in 10-satellite 24 h benchmark.
- Keep last 10,000 recent UI events, preserve full evidence in archive; bounded trends, no render-frame persistence, crash-safe checksummed checkpoints.

## Omissions to flag during implementation review

The most consequential risks are a visually moving globe without deterministic propagation; decorative live charts; fake link or dock success; recovery that marks broken hardware repaired; truth leaking to planner; power transfer during wireless mode; unguarded detach; missing clock/RNG/event queue in checkpoint; static fabricated experiment metrics; omitted GENERAL-REF manifest; twelve menu labels without physical fault effects; and claiming full dossier acceptance without all FAT/UI/SYS/NR evidence.

Source inconsistency: reconciliation cites DOCK-004, but the detailed docking section defines only DOCK-001–003. Do not invent a separate DOCK-004 requirement. Thermal fixture prose rounds crossing time differently (2707/2708/~2707.55 s); use the exact expression and stated ±2 s tolerance. E2 must use deliberately reachable geometry rather than arbitrary randomized orbits.
