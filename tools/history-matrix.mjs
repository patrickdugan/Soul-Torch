/** Tests the 24 distinct rescue histories reachable with the two original gates. */
import { playSeed } from './autoplayer.mjs';
import { CIVIC_PROJECTS } from '../src/civic.js';

const count = Number(process.argv[2] || 1);
if (!Number.isInteger(count) || count < 1 || count > 20) throw new Error('Seed count must be 1..20');
const souls = ['ferryman','herbalist','mason','archivist','gardener','bellkeeper'];
function* permute(xs, prefix=[]) {
  if (!xs.length) { yield prefix; return; }
  for (let i=0;i<xs.length;i++) yield* permute([...xs.slice(0,i),...xs.slice(i+1)], [...prefix,xs[i]]);
}
const unique = new Map();
for (const order of permute(souls)) {
  const n = Object.fromEntries(order.map((s,i)=>[s,i]));
  // Progression gates: ferry is needed to reach sector 1; mason for sector 2.
  if (n.ferryman > n.mason || n.ferryman > n.archivist ||
    n.mason > n.gardener || n.mason > n.bellkeeper) continue;
  const pairCode = CIVIC_PROJECTS.map(p=>n[p.a]<n[p.b]?'A':'B').join('');
  const projectOrder = CIVIC_PROJECTS.map(p=>({key:p.key,finished:Math.max(n[p.a],n[p.b])}))
    .sort((a,b)=>a.finished-b.finished).map(p=>p.key);
  const signature = `${pairCode}/${projectOrder[0]}>${projectOrder[1]}`;
  if (!unique.has(signature)) unique.set(signature,order);
}
if (unique.size !== 24) throw new Error(`Expected 24 attainable histories, got ${unique.size}`);
const rows=[],failures=[];
for (let i=0;i<count;i++) {
  const seed=`history-matrix-${i}`;
  for (const [expected,order] of unique) {
    const actual=playSeed(seed,15000,order);
    rows.push({seed,expected,status:actual.status,got:actual.historyKey,turns:actual.turns});
    if (actual.status!=='won' || actual.historyKey!==expected) {
      failures.push({seed,order,expected,...actual});
    }
  }
}
console.log(JSON.stringify({seeds:count,uniqueTopologicalHistories:unique.size,
  playthroughs:rows.length,wins:rows.filter(r=>r.status==='won').length,
  uniqueCompleted:[...new Set(rows.map(r=>r.got))].length,failures:failures.slice(0,5),
  examples:rows.slice(0,6)},null,2));
if (failures.length) process.exitCode=1;
