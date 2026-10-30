/** Reproducible eight-outcome playthrough comparison on the same initial world seed. */
import { playSeed } from './autoplayer.mjs';
import { CIVIC_PROJECTS } from '../src/civic.js';

const count = Number(process.argv[2] || 1);
if (!Number.isInteger(count) || count < 1 || count > 100) throw new Error('Seed count must be 1..100');
const variants = Array.from({length:8}, (_,mask)=>{
  const first = CIVIC_PROJECTS.map((p,i)=>mask&(1<<i)?p.b:p.a);
  const order = CIVIC_PROJECTS.flatMap((p,i)=>[first[i],first[i]===p.a?p.b:p.a]);
  const code = first.map((id,i)=>id===CIVIC_PROJECTS[i].a?'A':'B').join('');
  return {code,first,order};
});
const rows = [], failures=[];
for (let i=0; i<count; i++) {
  const seed = `branch-matrix-${i}`;
  for (const variant of variants) {
    const r = playSeed(seed, 15000, variant.order);
    const expected = variant.first.every((id,j)=>r.branches.find(b=>b[0]===CIVIC_PROJECTS[j].key)?.[1]===id);
    if (r.status!=='won' || r.ending!==variant.code || !expected) {
      failures.push({seed, requested:variant.code, ...r});
    }
    rows.push({seed,requested:variant.code,ending:r.ending,status:r.status,turns:r.turns,actions:r.actions});
  }
}
console.log(JSON.stringify({seeds:count,playthroughs:rows.length,wins:rows.filter(r=>r.status==='won').length,
  uniqueEndings:[...new Set(rows.map(r=>r.ending))].sort(), failures:failures.slice(0,10),
  examples: rows.slice(0,8)},null,2));
if (failures.length) process.exitCode=1;
