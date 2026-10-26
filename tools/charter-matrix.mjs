/** Real-play acceptance for every gate-compatible rescue history and its charter. */
import { playSeed } from './autoplayer.mjs';
import { CIVIC_PROJECTS, CIVIC_ACCORDS } from '../src/civic.js';

const count = Number(process.argv[2] || 1);
if (!Number.isInteger(count) || count < 1 || count > 20) throw new Error('Seed count must be 1..20');
const souls = ['ferryman','herbalist','mason','archivist','gardener','bellkeeper'];
function* permute(xs, prefix = []) {
  if (!xs.length) {yield prefix;return;}
  for(let i = 0; i < xs.length; i++)
    yield* permute([...xs.slice(0,i),...xs.slice(i+1)], [...prefix,xs[i]]);
}
const unique = new Map();
for (const order of permute(souls)) {
  const at = Object.fromEntries(order.map((id,i)=>[id,i]));
  if(at.ferryman > at.mason || at.ferryman > at.archivist ||
      at.mason > at.gardener || at.mason > at.bellkeeper) continue;
  const key = CIVIC_PROJECTS.map(p => at[p.a] < at[p.b] ? 'A':'B').join('');
  const completed = CIVIC_PROJECTS.map(p=>({key:p.key,index:Math.max(at[p.a],at[p.b])}))
    .sort((a,b)=>a.index-b.index);
  const history = `${key}/${completed[0].key}>${completed[1].key}`;
  if (!unique.has(history)) unique.set(history,order);
}
if (unique.size!==24) throw new Error(`Expected 24 founding histories, saw ${unique.size}`);
const rows=[], failures=[];
for (let i = 0; i < count; i++) {
  const seed = `charter-${i}`;
  for(const [expected,priority] of unique) {
    const got = playSeed(seed,15000,priority,{charter:true});
    const expectedOrder = expected.split('/')[1];
    const valid = got.status==='won' && got.historyKey===expected &&
      got.accord === expectedOrder && got.charter==='ratified' &&
      ['passage','terrain'].includes(got.infrastructure);
    rows.push({ seed, expected, got:got.historyKey, status:got.status,
      charter:got.charter, infrastructure:got.infrastructure, turns:got.turns });
    if (!valid) failures.push({seed,expected,priority,...got});
  }
}
const orders = [...new Set(rows.map(r=>r.expected.split('/')[1]))].sort();
if (orders.length !== Object.keys(CIVIC_ACCORDS).length) throw new Error('Accord coverage changed');
console.log(JSON.stringify({seeds:count,worlds:rows.length,ratifications:rows.filter(r=>r.charter==='ratified').length,
  victories:rows.filter(r=>r.status==='won').length,uniqueHistories:unique.size,accords:orders,
  failures:failures.slice(0,10),examples:rows.slice(0,6)},null,2));
if (failures.length) process.exitCode=1;
