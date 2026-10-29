# VEIL verification report

Recorded on 29 October 2026 for the `symbio-veil` version 1.0.0 working copy. This report distinguishes implemented regression evidence and observed UI behavior from full acceptance of the supplied dossiers. It does not certify flight readiness, hardware calibration or completion of every dossier requirement.

## Recorded checks

| Check | Recorded result | Scope |
|---|---|---|
| `npm test` / `node --test tests/*.test.js` | PASS — 43 tests, zero failures | 42 functional/numerical tests plus one HTTP/WebSocket/filesystem integration test |
| `npm run build` | PASS on final implementation | 3,131 modules; local textures and production assets emitted. Vite reports a large bundle warning; performance remains unmeasured. |
| Browser dashboard walkthrough | PASS for the observed local session | Orbital dashboard, local scene and navigation rendered |
| Component inspection | PASS for the observed local session | Declared component hierarchy and correct solar-component preselection when opening its fault console |
| E1 operator workflow | PASS for the observed local session | Scenario load, play, pause, pair inspection and verified assistance |
| E1 accounting and physical/mission distinction | PASS for the observed local session | Source processor remained failed while mission was assisted; 8 Mbit delivered; zero electrical power transferred; pair contract completed |
| Research comparison UI | PASS for observed E1 session | Four policy runs displayed actual results: B0 51.1% fleet verified availability; B1/B2/B3 95.9%, 68 s recovery; zero safety violations. Synthetic single run only. |
| Checkpoint UI | PASS for observed E1 session | Saved CP-000123 at T+131 s; Restore recorded exact RNG and event queue retained. |
| Replay export UI | PASS for observed E1 session | Downloaded VEIL-E1-replay.json, 203,526 bytes, through the browser. |
| Replay import | API PASS / file-picker walkthrough UNVERIFIED | Version/checksum import is covered by automated tests; interface routes a selected local JSON file to the same endpoint. |
| Final production navigation | PASS for observed session | Fresh :4000 browser switched orbit, twin, cooperation, and orbit with no console errors after replacement of DOM labels with WebGL sprites. |
| Live MongoDB persistence | NOT EXERCISED | Optional Mongoose path is implemented; recorded integration check uses local filesystem persistence |

These browser entries describe a local operator walkthrough, not a cross-browser screenshot campaign or reference-hardware benchmark. Pending entries must not be presented as passed until the corresponding observation is recorded.

## Automated evidence

The executable test sources are `tests/simulation.test.js` and `tests/api.test.js`. Requirement IDs in test names identify related source requirements; one grouped regression does not establish every case of a full acceptance family.

| Area | Implemented checks |
|---|---|
| Orbit | Reference 24-hour closed-form orbit energy/angular-momentum conservation; circular period; eccentric-orbit invariants; seed-dependent, repeatable initialization |
| Power and thermal | Reserve-time arithmetic fixture; exact exported/received/loss identity; analytic thermal threshold and sustained derate; geometric eclipse distinct from solar hardware failure |
| Fault generation | Exponential sampler behavior; positive-parameter Weibull sampling and run profile; deterministic seeded schedules; manual/hybrid suppression semantics; display-rate independence |
| Fault effects and causality | All twelve declared classes alter their model/observations; compatible target validation; dependent rail effects; monitoring bias/freeze; independent incident roots; progressive and recurring intermittent behavior |
| Observations | Frozen monitoring prevents a hidden processor failure from entering agent decisions; short transients can clear before diagnosis |
| Planner and donor protection | No-donor outcome; donor reserve hard rejection; output-quality mismatch; invalid distant docking; failed source payload cannot be repaired by unrelated compute |
| Cooperation execution | Finite wireless execution before verification; temporary capture/inertia update; direct-path mid-bond isolation; consumed resources preserved on abort; guarded detachment forecast |
| Mission outcomes | Remote assistance preserves failed source hardware; deterministic output predicate and deadline; declared E0–E6 demonstration outcomes including release, reciprocal relay and persistent integration |
| Research comparison | Shared scenario/seed/exogenous scheduled fault; independent baseline versus weighted outcome; selected policy subsets and invalid-policy rejection |
| Persistence and replay | Checkpoint RNG/event queue/physical state reproduction; corrupted checkpoint rejection; replay context/checksum import; durable journal integration |
| API and streaming | Local HTTP service, WebSocket snapshot, command validation, idempotency, expected revision, exports and filesystem persistence |
| Size sanity check | Ten-spacecraft compact checkpoint is below 25 MB; this is explicitly not the full 10000-event/100-checkpoint benchmark |

Some fixtures deliberately isolate an equation or sampler. For example, the 7.5-hour reserve test verifies the reference arithmetic, and the hazard test verifies the seeded sampler distribution. They do not replace a fully instrumented long-duration spacecraft validation campaign.

## Model and scope limitations

- All spacecraft, fault, resource and mission-quality parameters are P2 synthetic examples. P1 Earth constants do not validate the chosen spacecraft model. No P3 calibration is supplied.
- Orbital propagation is closed-form two-body Kepler. J2, drag, third-body perturbations, radiation pressure and collision prediction are omitted.
- Physical approach is a bounded near-coorbital smooth relative-motion proxy with finite duration/resource guards. It is not an arbitrary-orbit trajectory solver, flight-qualified six-degree-of-freedom docking controller, or validated capture/release mechanism.
- Thermal behavior is a single lumped node; RF uses geometric contact and configured useful rates; mission artifacts and quality predicates are synthetic.
- The catalog supplies a generic twelve-component schematic covering the twelve fault classes. It does not reproduce the dossier's full expanded OSV logical hierarchy, every board subcomponent, or independently validated configurable hardware classes.
- The E0–E6 automated test checks expected outcomes of the declared demonstration model. It does not establish a calibrated research result, comprehensive sensitivity campaign, all negative-case combinations, or scientific superiority of B3 across missions.
- The UI walkthrough records specific observed workflows. Full UI-01–14 coverage, screen-reader/keyboard audit, browser matrix and every truth/observation display combination have not been signed off.

## Criteria remaining unverified

Full dossier acceptance remains UNVERIFIED. In particular:

1. Complete FAT-001–030, UI and SYS acceptance records with exhaustive edge cases, full requirement-to-test traceability and independent review.
2. G7 release acceptance, product-owner signature, model/hardware calibration and any flight or hardware-command safety claim.
3. Reference-machine performance: ≥30 FPS for two spacecraft and ≥20 FPS for ten at 1920×1080; P95 inspector ≤300 ms and fault acknowledgment ≤500 ms.
4. Ten-spacecraft/24-hour sustained memory ≤2 GB and compact 10000-event/100-checkpoint storage ≤25 MB under the specified workload.
5. Crash/restart durability campaign, multiple simultaneous browser sessions, live MongoDB deployment and controlled offline installation/runtime campaign on the target machine.
6. All scenario authoring/schema edge cases, expanded OSV/GENERAL manifests, calibrated interface/protection behavior, real scientific mission artifacts and general rendezvous validity.

Source tests and a successful build make the implemented application reviewable and runnable. They do not imply that the entire research software dossier has been accepted.

## Visual evidence

`veil-dashboard.png` captures the final production dashboard at the observed 1280 × 720 viewport. The lower cards continue below the captured fold. This is visual evidence of that session, not an FPS benchmark.
