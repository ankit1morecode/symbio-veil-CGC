// Backend performance measurement against the dossier's stated budgets.
// Run with: node tests/performance.bench.mjs
// This measures the simulation service only. Rendering frame rates need a
// browser on reference hardware and are still unmeasured.
import { makeRun, advance, snapshot, checkpoint, exportRun } from '../server/engine.js';

const mb = bytes => (bytes / 1024 / 1024).toFixed(2);
const sizeOf = value => Buffer.byteLength(JSON.stringify(value), 'utf8');
const percentile = (values, p) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
};

console.log(`node ${process.version} · ${process.platform} ${process.arch}`);
console.log('');

// --- 10-spacecraft 24 h run -------------------------------------------------
const run = makeRun({ scenarioId: 'E1', seed: 20261029, spacecraftCount: 10 });
const started = performance.now();
advance(run, 86400);
const elapsedS = (performance.now() - started) / 1000;
const peakRssMb = process.memoryUsage().rss / 1024 / 1024;

console.log('10-spacecraft 24 h benchmark');
console.log(`  wall time                 ${elapsedS.toFixed(2)} s`);
console.log(`  simulated/real ratio      ${(86400 / elapsedS).toFixed(0)}x`);
console.log(`  process RSS               ${peakRssMb.toFixed(0)} MB   (budget 2048 MB)`);
console.log(`  events retained           ${run.events.length}`);
console.log(`  ledger rows               ${run.ledger.length}`);
console.log('');

// --- snapshot latency, the inspector's read path ---------------------------
const samples = [];
for (let i = 0; i < 200; i++) {
  const t0 = performance.now();
  snapshot(run);
  samples.push(performance.now() - t0);
}
console.log('snapshot() latency over 200 calls (10 spacecraft)');
console.log(`  median                    ${percentile(samples, .5).toFixed(1)} ms`);
console.log(`  p95                       ${percentile(samples, .95).toFixed(1)} ms   (budget 300 ms)`);
console.log(`  max                       ${Math.max(...samples).toFixed(1)} ms`);
console.log('');

// --- stored size: config + events + checkpoints ----------------------------
const checkpoints = [];
for (let i = 0; i < 100; i++) checkpoints.push(checkpoint(run, `bench-${i}`));
const stored = sizeOf(run.scenario) + sizeOf(run.events) + sizeOf(run.checkpoints);
console.log('storage footprint');
console.log(`  config + events + 100 checkpoints   ${mb(stored)} MB   (budget 25 MB)`);
console.log(`  single checkpoint                   ${mb(sizeOf(run.checkpoints[0]))} MB`);
console.log(`  full replay bundle                  ${mb(sizeOf(exportRun(run)))} MB`);
console.log('');
console.log('Not measured here: rendered frame rate at 1080p, which needs a browser');
console.log('on the reference 4-core / 16 GB / WebGL2 machine.');
