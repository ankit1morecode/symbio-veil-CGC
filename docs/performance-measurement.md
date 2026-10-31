# VEIL performance measurement

Recorded 31 October 2026 against the budgets in the implementation reference.
Reproduce with `node tests/performance.bench.mjs`.

These are **not** reference-hardware numbers. The dossier specifies a 4-core
64-bit desktop with 16 GB RAM and WebGL2; this run was taken on the development
machine (Windows 11, Node 24.18.0, x64). Treat the backend figures as indicative
and the rendering figures as still unmeasured.

## Measured

| Budget | Target | Measured | Verdict |
|---|---|---|---|
| Backend sustained RAM, 10-satellite 24 h benchmark | ≤ 2048 MB | 137 MB process RSS | PASS, wide margin |
| P95 cached inspector response | ≤ 300 ms | 8.5 ms `snapshot()` p95 at 10 spacecraft | PASS, wide margin |
| Config + events + 100 checkpoints | ≤ 25 MB | 26.14 MB | NEAR MISS, 4.6% over |

Supporting figures from the same run:

- 10-spacecraft 24 h simulation completes in 14.2 s wall time, about 6100x real time.
- `snapshot()` median 5.5 ms, max 11.6 ms over 200 calls.
- Ledger reaches 42,527 rows over 24 h at 10 spacecraft (per-minute aggregation
  across generation, consumption and coordination for each vehicle).
- A single checkpoint is 0.261 MB.

## Not measured

- Rendered frame rate at 1080p, two spacecraft (target ≥ 30 FPS) and ten
  spacecraft (target ≥ 20 FPS). This needs a browser on the reference machine.
- 50 faultable nodes per stress satellite. The manifest declares 42 components
  per vehicle, of which 12 are independently faultable.

## Checkpoint size: what changed

The storage budget was originally missed by a wide margin, not a narrow one.
Each checkpoint deep-copied the entire append-only ledger, so 100 checkpoints of
a 10-spacecraft 24 h run reached roughly **975 MB**.

The implementation reference specifies that a checkpoint carries "ledger heads",
not the log itself. Checkpoints now store:

- the frozen ledger prefix as a length and checksum, plus running totals;
- the still-accumulating aggregate tail in full, bounded at `6 x spacecraft + 16`
  rows, since per-minute aggregate rows are mutated until their bucket closes;
- an event head as a length and checksum.

On restore the logs are rewound to the recorded head and the checksums are
verified, so a checkpoint from a different run is rejected rather than silently
grafted on. Display trend arrays are also excluded, since they are chart data
rather than simulation state and the reference asks for bounded trends with no
render-frame persistence. A restored run starts its charts empty.

Result: one checkpoint fell from 9.75 MB to 0.261 MB, and the 100-checkpoint
total from about 975 MB to 26.14 MB.

The residual 4.6% overage is dominated by, per checkpoint, the spacecraft records
(about 100 kB at 10 vehicles with 42 declared components each), the pending
hazard queue (about 23 kB, roughly 120 scheduled items), and the decision records
(about 53 kB each, carrying every candidate's checks and the agent inputs that
make the decision explainable). Trimming the decision record would bring the
total inside the budget at the cost of the explainability evidence, which did not
look like the right trade to make without asking.
