# VEIL model validity and research limits

VEIL is a synthetic software research demonstrator. Its state, fault rates, hardware thresholds, interface behavior and mission artifacts are not calibrated spacecraft measurements. The UI distinguishes modeled physical state, agent observations and planned/contracted actions. A simulated mission result only supports conclusions within the listed model and scenario assumptions.

The shipped spacecraft catalog uses a generic twelve-component schematic manifest covering the twelve fault classes. This is a practical demonstration of component selection and causal effects, not a complete enumeration of every logical component in the dossier's expanded OSV-REF hierarchy or a separately validated GENERAL-REF hardware model. See the verification report for the observed and automated checks.

## Units and provenance

Physical positions and velocities use an Earth-centered inertial frame in metres and metres per second. Time is simulation seconds. Mass is kg, inertia kg m², temperature K, power W and battery energy Wh (`1 Wh = 3600 J`). Presentation angles may be degrees. Earth rotation is a simplified constant-rate visual transform.

P1 denotes a conventional reference constant, P2 a synthetic regression/demo parameter, and P3 an independently calibrated spacecraft parameter. This release supplies P1 constants and P2 examples. It does not supply P3 flight calibration.

| Quantity | Value | Status |
|---|---|---|
| Earth gravitational parameter | 398600441800000 m³/s² | P1 reference |
| Earth equatorial radius | 6378137 m | P1 reference |
| Earth display rotation | 7.292115e−5 rad/s | P1 approximate |
| Reference circular altitude | 500000 m | P2 synthetic |
| Reference seed | 20261029 | P2 synthetic |
| Reference horizon | 86400 s | P2 synthetic |
| Battery usable capacity / initial energy / reserve | 120 / 84 / 24 Wh | P2 synthetic |
| Illuminated solar / eclipse solar / normal load | 20 / 0 / 8 W | P2 synthetic |
| Direct export cap / efficiency | 10 W / 0.85 | P2 synthetic |

## Orbit and geometry

The orbit model uses a deterministic closed-form two-body Kepler solution in double precision. For semimajor axis `a`, eccentricity `e` and mean anomaly `M`, it solves `E − e sin(E) = M` by iteration, advances `M` at `sqrt(mu/a³)`, then rotates orbital-plane position and velocity by inclination and ascending-node angle. The reference scenarios use circular or near-circular initial conditions.

This preserves the declared two-body orbit and permits analytical conservation regression. It does not model J2, drag, third-body forces, solar pressure, collisions or real ephemerides. The dossier also names adaptive Runge–Kutta as a baseline numerical choice; this implementation adopts the closed-form Kepler option described in its physics model section. No adaptive-integrator accuracy claim follows from this choice.

Rendezvous is a bounded near-coorbital approach proxy with finite duration, relative-state guards and maneuver-resource accounting. It is intended only for deliberately reachable demonstration configurations. It is not a flight-qualified six-degree-of-freedom GNC solution, optimal trajectory, general arbitrary-orbit rendezvous solver or collision prediction service. Coupled mass/COM/inertia calculations are simplified engineering proxies, not structural certification.

Line of sight tests the finite segment between spacecraft against the Earth sphere. Eclipse uses a fixed solar direction and cylindrical Earth shadow; real penumbra, seasonal geometry and attitude-dependent panel incidence are outside this approximation.

## Energy and thermal state

Battery change follows:

`E_next = E_now + (P_solar + P_received − P_load − P_exported − P_losses) dt / 3600`.

Transfer useful input is bounded by `P_received ≤ eta × P_exported`, with source export, recipient receipt and losses accounted separately. Normal loads and solar generation continue during a transfer. Donor reserve and recipient capacity are constraints. An aborted transfer preserves previously consumed resources; contract cancellation does not reverse physics.

The thermal model is a first-order lumped node:

`C dT/dt = P_heat − G(T − T_sink)`.

For a constant segment, the engine uses its exponential solution. The fault fixture changes conductance from 0.20 to 0.06 W/K, with C=150 J/K, heat=3 W, sink=295 K and initial T=310 K. The post-fault equilibrium is 345 K, time constant 2500 s and `T(t) = 345 − 35 exp(−t/2500)`. Threshold crossing at 333.15 K is calculated with the exact logarithmic expression, approximately 2707 s; the dossier requires an additional 10 s persistence. These fixtures are not component-level thermal qualification, battery electrochemistry or calibrated spacecraft heat rejection.

## Communication, services and decisions

Radio service uses geometry and configured useful bitrate rather than a calibrated antenna/link budget. Data volume is bounded by useful rate integrated over valid contact, with configured latency and energy costs. Wireless contact provides permitted data/compute service; it is not a direct electrical energy path.

Task verification uses synthetic typed artifacts, quality thresholds, deadline and provider state. It does not independently validate the scientific content of a real image product. Mission assistance is distinct from physical repair of the original failed board.

Hard feasibility gates precede ranking. Eligible candidates use the synthetic initial policy:

`S = .40 B + .20(1−T) + .15(1−C) + .15(1−R) + .10(1−D)`.

Benefit, time, cost, risk proxy and donor impact are scenario-normalized values, not calibrated probabilities or a proof of optimal policy. Missing required knowledge must yield a reasoned refusal or unscorable candidate. A selected plan is not proof of authorized execution or verified success.

## Faults and reproducibility

Faults model computation, rails, solar, battery, radio, bus, navigation, actuators, thermal rejection, docking interface, payload quality and monitoring. A monitoring fault may change observations while physical state stays unchanged. A GNC fault must affect approach feasibility and available actuation rather than only a health color.

The synthetic constant hazard is `lambda = 2e−4 per eligible node-hour`. Waiting-time sampling is based on simulation time, not browser frame rate. This low rate permits zero spontaneous incidents during short runs. Weibull sampling requires explicit positive shape beta and characteristic life eta. Neither distribution establishes a real spacecraft failure rate.

Reproduction requires matching software/model versions, scenario, seed, initial state, policy, commands and event order. Checkpoints must preserve queue/RNG state and contracts/ledger; comparing only a screenshot or visible timestamp does not establish deterministic replay. Camera and decorative starfield randomness are separate from authoritative simulation state.

## Regression targets

| Fixture | Expected model result |
|---|---|
| Circular orbit at r=6878137 m | Period `2π sqrt(r³/mu)`; reference 24 h relative energy/angular momentum drift ≤0.1% |
| 84 Wh, reserve 24 Wh, load 8 W, no generation | Reserve reached in 7.5 h |
| Export 10 W for 600 s, eta=.85 | Export 1.6666667 Wh, receive 1.4166667 Wh, loss .25 Wh |
| Thermal conductance fault | Exact threshold expression; numerical benchmark target ±2 s, then persistence |
| 500 eligible nodes, lambda=2e−4/h, 24 h | Expected ≈2.4 primary incidents; P(any)≈.9093 under independent constant hazard |
| True temperature 320 K, +8 K sensor bias, zero test noise | Observed 328 K; true state remains 320 K |
| Required output quality .8, available provider .5 | Ineligible despite free compute |
| 10 Mbit at useful 256 kbit/s | Ideal serialization 39.0625 s before extra overhead/latency |
| Actuator failure after detachment forecast | Revalidate; unsafe separation invalidates ETA |

Automated tests report the implemented checks. This table defines targets and does not itself prove that all are tested or passed.

## Unverified release criteria

The following require separate recorded evidence and are not asserted by this source delivery:

- Full FAT-001–030, UI-01–14 and SYS-01–15 acceptance, complete E0–E6 positive/negative verification and every dossier requirement's traceability evidence.
- Human visual/interaction acceptance, all keyboard/accessibility and cross-browser walkthroughs.
- G7 release acceptance and product-owner signature; hardware-specific model validation, P3 calibration and flight qualification.
- Reference 4-core/16 GB/WebGL2 machine targets of ≥30 FPS for two spacecraft and ≥20 FPS for ten at 1920×1080.
- P95 cached inspector ≤300 ms and fault acknowledgment ≤500 ms.
- Ten-spacecraft/24-hour sustained backend RAM ≤2 GB; compact 10000-event/100-checkpoint storage ≤25 MB; crash/restart durability campaign.
- General arbitrary-orbit safe docking, six-degree-of-freedom controlled capture, structural loads, calibrated thermal/electrical hardware behavior and real mission-output science.

Claims about these criteria must remain UNVERIFIED until an actual test result, environment, scenario, software version and measurement method are recorded.
