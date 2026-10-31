# Automatic faults and board safety status

The fault panel exposes the actual run mode, seed, random model, eligible component count, scenario incident, and recent automatic incidents. All timing uses simulation seconds: pause stops fault progression, and time scale speeds up simulation time. Camera motion and browser frame rate do not generate faults.

## Fault sources and modes

- Scenario E0–E6 schedules one declared incident on SAT-A at T+20 s. E0/E1/E3/E5 use F-01 computation loss; E2/E4/E6 use F-03 solar loss. The reference VEIL-REF-01 scenario has no scripted incident.
- Each eligible modeled component has a seeded random waiting time. The default exponential hazard is 0.0002 per component per simulated hour. Six spacecraft have 72 eligible modeled components. This low rate makes a random incident unlikely during a short demonstration; it is not a periodic every-few-seconds effect.
- A configured Weibull model uses positive shape beta and characteristic life eta in node-hours. The UI displays these settings instead of the exponential rate.
- AUTOMATIC permits automatic incidents and rejects manual injection. HYBRID permits both. MANUAL suppresses automatic incidents when they become due. Changing mode preserves existing faults; suppressed incidents are not replayed as a burst.
- Faults first change the physical model. Most component faults enter the diagnosis path after a six-second simulation timeout. Monitoring bias or frozen observations can hide or delay what the agent knows. Planner inputs continue to use observations.
- Scenario and random faults are permanent in the default automatic schedule. The manual console additionally offers transient, intermittent and progressive faults. Incidents record their origin, status and causal identifiers.

## Board tables

The twin sidebar groups components by board and displays health, active fault count, watchdog/heartbeat, power/rail, thermal margin, declared dependencies and implemented protections. Simulation truth updates from physical state. Agent observations can lag diagnosis or become unknown when monitoring is stale.

Digital-board watchdog status is synthetic supervision of the existing six-second observation window: an unavailable interface warns while the window is pending and alarms after timeout. It does not implement an independent watchdog processor or automatic hardware reset. Analog groups without a modeled digital heartbeat show N/A. Depleted power alarms; unavailable power evidence does not claim a responding heartbeat.

Thermal status uses the shared spacecraft thermal node. Docking protections report the existing capture/isolation guards, and battery protections report reserve/capacity guards. Boards without a separately modeled protection actuator show N/A. Specialist reference boards remain Not modeled rather than showing unsupported green safety checks.

## Cooperation workspace

The operations page includes filters and search, actual pair resource totals, reserve margins, mechanical/data/power states, actual milestones, matching event evidence, and links to decisions and spacecraft twins. The fleet readiness view shows routine telemetry when no mission-support contract exists. Play/pause, a 60-second step, and a docking demonstration use existing engine controls. Release requests are revalidated by the engine and may be refused when local safety conditions fail.
