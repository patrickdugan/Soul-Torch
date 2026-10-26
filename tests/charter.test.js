import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, dispatch, replay, serialize, deserialize, analyzeGame, analyzeWorld,
  activeCharterSite, townNpcs, epilogue } from '../src/core.js';
import { CIVIC_ACCORDS } from '../src/civic.js';
import { botAction } from '../tools/autoplayer.mjs';

function rescue(game, id) {
  const g = structuredClone(game);
  const room = g.world.rooms.find(r => r.soulId === id);
  g.hero.room = room.id; g.hero.x = 10; g.hero.y = 5;
  g.roomStates[room.id].enemies = [];
  return dispatch(g,{type:'interact'});
}
function buildAccord(order,seed='charter-counterfactual') {
  return order.reduce((game,id) => rescue(game,id),newGame(seed));
}
function collect(game) {
  const g = structuredClone(game);
  const {room,x,y} = g.charter;
  g.hero.room=room; g.hero.x=x; g.hero.y=y;
  g.roomStates[room].enemies=[];
  return dispatch(g,{type:'interact'});
}
function ratify(game) {
  const atHome = dispatch(game,{type:'toggleTown'});
  assert.equal(atHome.mode,'town');
  return dispatch(atHome,{type:'interact'});
}
const ORDERS = [
  { order:'waterside>memory', names:['ferryman','herbalist','mason','archivist'] },
  { order:'waterside>orchard', names:['ferryman','herbalist','mason','gardener','bellkeeper'] },
  { order:'memory>waterside', names:['ferryman','mason','archivist','herbalist'] },
  { order:'memory>orchard', names:['ferryman','mason','archivist','gardener','bellkeeper'] },
  { order:'orchard>waterside', names:['ferryman','mason','gardener','bellkeeper','herbalist'] },
  { order:'orchard>memory', names:['ferryman','mason','gardener','bellkeeper','archivist'] },
];

test('the six civic accords reveal six distinct charter quests at stable reachable sites', () => {
  const names = new Set();
  for (const {order,names:ids} of ORDERS) {
    const state=buildAccord(ids);
    assert.equal(state.accord.order,order);
    assert.equal(state.charter.stage,'seeking');
    assert.equal(state.charter.name,CIVIC_ACCORDS[order].charter);
    assert.deepEqual({room:state.charter.room,x:state.charter.x,y:state.charter.y},state.world.charterSite);
    assert.equal(activeCharterSite(state,state.charter.room)?.name,state.charter.name);
    assert.equal(activeCharterSite(state,0),null);
    assert.deepEqual(analyzeGame(state).problems,[]);
    names.add(state.charter.name);
  }
  assert.equal(names.size,6);
});

test('only a cleared chamber can yield a charter and the player must return it to council', () => {
  const game=buildAccord(ORDERS[0].names);
  const contested=structuredClone(game);
  const {room,x,y} = contested.charter;
  contested.hero.room=room;contested.hero.x=x;contested.hero.y=y;
  // It must be a live threat, away from the stone itself.
  contested.roomStates[room].enemies=[{id:'guardian',kind:'shade',x:10,y:3,hp:2,damage:1}];
  const resisted=dispatch(contested,{type:'interact'});
  assert.equal(resisted.charter.stage,'seeking');
  assert.ok(resisted.log[0].includes('remaining shadows'));
  const found=collect(game);
  assert.equal(found.charter.stage,'carried');
  assert.equal(activeCharterSite(found,room),null);
  assert.equal(found.events.filter(e=>e.type==='charter'&&e.stage==='carried').length,1);
  assert.equal(analyzeGame(found).valid,true);
  const delivered=ratify(found);
  assert.equal(delivered.charter.stage,'ratified');
  assert.equal(delivered.accord.ratified,true);
  assert.equal(delivered.events.filter(e=>e.type==='ratification').length,1);
  assert.equal(delivered.hero.maxHp,found.hero.maxHp+2);
  assert.equal(analyzeGame(delivered).valid,true);
  assert.equal(analyzeWorld(delivered.world).valid,true);
  const twice=dispatch(delivered,{type:'interact'});
  assert.equal(twice.events.filter(e=>e.type==='ratification').length,1);
});

test('ratification produces exactly one deterministic infrastructure change, with different gifts', () => {
  const rewards = {waterside:'maxHp',memory:'focus',orchard:'ward'};
  const sites = new Set();
  for (const {order,names} of ORDERS) {
    const game=buildAccord(names,`ratify-${order}`);
    const before=collect(game);
    const after=ratify(before);
    assert.equal(after.accord.legacy,{
      waterside:'The waterways grant two permanent vitality.',
      memory:'The archive grants four empowered sword strikes.',
      orchard:'The living bells ward against three blows.',
    }[after.accord.from]);
    assert.equal(after.hero[rewards[after.accord.from]]-before.hero[rewards[after.accord.from]],
      {waterside:2,memory:4,orchard:3}[after.accord.from]);
    assert.equal(after.charter.stage,'ratified');
    assert.deepEqual(analyzeGame(after).problems,[]);
    assert.deepEqual(analyzeWorld(after.world).problems,[]);
    const extra=after.charter.infrastructure;
    assert.ok(['passage','terrain'].includes(extra.kind));
    if (extra.kind==='passage') assert.equal(extra.between.length,2);
    else assert.equal(extra.cleared.length,3);
    assert.equal(epilogue(after)?.charter??null,null); // All souls aren't rescued in these partial histories.
    sites.add(`${order}/${extra.kind}`);
  }
  assert.equal(sites.size,6);
});

test('ratified accord shifts the second guild into council patrol and changes its dialogue', () => {
  const state=buildAccord(ORDERS[0].names);
  const before=structuredClone(state);before.townTicks=20;
  const delivered=ratify(collect(state));delivered.townTicks=20;
  const archivistBefore=townNpcs(before).find(n=>n.id==='archivist');
  const archivistAfter=townNpcs(delivered).find(n=>n.id==='archivist');
  assert.notDeepEqual(archivistBefore,archivistAfter);
});

test('actual charter pilgrimage remains reproducible and a v2 replay upgrades safely', () => {
  const order=['ferryman','herbalist','mason','archivist','gardener','bellkeeper'];
  let state=newGame('pilgrim-archive');
  for(let i=0;i<13000 && state.status==='playing';i++)
    state=dispatch(state,botAction(state,order,{charter:true}));
  assert.equal(state.status,'won');
  assert.equal(state.charter.stage,'ratified');
  assert.equal(state.epilogue.charter,CIVIC_ACCORDS['waterside>memory'].charter);
  assert.ok(state.finalScore>0);
  assert.deepEqual(analyzeGame(state).problems,[]);
  assert.deepEqual(replay(state.seed,state.history),state);
  assert.deepEqual(deserialize(serialize(state)),state);
  const v2=JSON.stringify({version:2,seed:state.seed,history:state.history});
  assert.deepEqual(deserialize(v2),state);
  assert.throws(()=>deserialize(JSON.stringify({version:1,seed:'x',history:[]})),/incompatible/);
});

test('seeded charter anchors never overlap enemies, shrines or the warden in a 1,000-world sweep', () => {
  for(let i=0;i<1000;i++) {
    const game=newGame(`charter-anchor-${i}`);
    const site=game.world.charterSite;
    const room=game.world.rooms[site.room];
    assert.equal(room.sector,2);
    assert.equal(room.boss,false);
    assert.ok(room.enemies.every(e=>e.x!==site.x||e.y!==site.y));
    assert.ok(Object.values(game.world.civicSites).every(s=>s.room!==site.room ||
      s.x!==site.x||s.y!==site.y));
    assert.deepEqual(analyzeWorld(game.world).problems,[]);
  }
});

test('ratification produces both shortcut and terrain outcomes across fixed-seed counterfactuals', () => {
  const observed=new Set();
  for (let i=0; i<64; i++) {
    const state=buildAccord(ORDERS[i % ORDERS.length].names,`ratification-modes-${i}`);
    const completed=ratify(collect(state));
    observed.add(completed.charter.infrastructure.kind);
    assert.deepEqual(analyzeWorld(completed.world).problems,[]);
    assert.deepEqual(analyzeGame(completed).problems,[]);
  }
  assert.deepEqual([...observed].sort(),['passage','terrain']);
});
