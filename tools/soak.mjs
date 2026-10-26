import { generateWorld, analyzeWorld } from '../src/core.js';

const count = Number(process.argv[2] || 10000);
if (!Number.isInteger(count) || count < 1 || count > 1_000_000) {
  console.error('Usage: npm run soak -- [1..1000000]');
  process.exit(2);
}
const started = performance.now();
let firstFailure = null;
for (let i = 0; i < count; i++) {
  const seed = `soak-${i}`;
  const result = analyzeWorld(generateWorld(seed));
  if (!result.valid) { firstFailure = { seed, problems: result.problems }; break; }
}
const elapsed = Math.round(performance.now() - started);
console.log(JSON.stringify({ checked: firstFailure ? 'stopped on failure' : count,
  elapsedMs: elapsed, success: !firstFailure, firstFailure }, null, 2));
if (firstFailure) process.exit(1);
