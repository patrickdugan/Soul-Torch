import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, dispatch, analyzeWorld, analyzeGame, activeCivicSites,
  townNpcs, townDialogue, epilogue, replay, serialize, deserialize } from '../src/core.js';
import { CIVIC_PROJECTS } from '../src/civic.js';
import { botAction } from '../tools/autoplayer.mjs';

function rescue(game, id) {
  // Direct state injection here isolates the consequences of rescue order;
  // the branch-matrix tool exercises all eight orders using legitimate moves.
  const s = structuredClone(game);
  const room = s.world.rooms.find(r => r.soulId === id);
  s.hero.room = room.id; s.hero.x = 10; s.hero.y = 5;
  s.roomStates[room.id].enemies = [];
  return dispatch(s, {type:'interact'});
}
function variants(mask, seed = 'civic-regression') {
  const first = CIVIC_PROJECTS.map((p,i) => mask & (1<<i) ? p.b : p.a);
  const order = CIVIC_PROJECTS.flatMap((p,i) => [first[i], first[i]===p.a?p.b:p.a]);
  let game = newGame(seed);
  for (const id of order) game = rescue(game, id);
  return {game, first, order};
}
function gameWith(first, key, seed = 'site-test') {
  const p = CIVIC_PROJECTS.find(x => x.key === key);
  let game = newGame(seed);
  game = rescue(game, first);
  game = rescue(game, first === p.a ? p.b : p.a);
  return game;
}
function visitSite(game, key) {
  const state = structuredClone(game);
  const site = state.world.civicSites[key];
  state.hero.room = site.room; state.hero.x = site.x; state.hero.y = site.y;
  state.roomStates[site.room].enemies = [];
  return dispatch(state, {type:'interact'});
}

test('all eight rescue orders create unique endings, valid world graphs and coherent events', () => {
  const endings = new Set(), signatures = new Set();
  for (let mask = 0; mask < 8; mask++) {
    const {game,first} = variants(mask);
    assert.equal(game.rescued.length, 6);
    assert.equal(game.branches.length, 3);
    assert.equal(game.events.filter(e => e.type === 'branch').length, 3);
    assert.equal(game.events.filter(e => e.type === 'terrain').length, 3);
    assert.equal(analyzeWorld(game.world).valid, true, `mask ${mask}`);
    assert.deepEqual(analyzeGame(game).problems, []);
    const story = epilogue(game);
    assert.equal(story.chapters.length, 4);
    assert.deepEqual(game.branches.map(b=>b.first), first);
    endings.add(story.key);
    signatures.add(JSON.stringify({title:story.title,doors:game.world.rooms.map(r=>r.doors),
      obstacles:game.world.rooms.map(r=>r.obstacles), maxHp:game.hero.maxHp,power:game.hero.power}));
  }
  assert.equal(endings.size, 8);
  assert.equal(signatures.size, 8);
});

test('ferryman-first opens a new ferryman-gated crossing while herbalist-first clears the low quarry', () => {
  const canal = gameWith('ferryman','waterside');
  const reeds = gameWith('herbalist','waterside');
  const a = canal.branches.find(b=>b.key==='waterside'), b = reeds.branches.find(b=>b.key==='waterside');
  assert.equal(a.name, 'Canal Commons');
  assert.equal(b.name, 'Reed Sanctuary');
  assert.deepEqual(a.passage.length, 2);
  assert.equal(b.passage, null);
  assert.equal(b.terrainCleared.length, 4);
  assert.equal(b.site.room >= 4 && b.site.room < 8, true);
  assert.equal(canal.world.rooms.flatMap(r=>r.doors).filter(d=>d.origin==='canal').length,2);
  assert.equal(reeds.world.rooms.flatMap(r=>r.doors).filter(d=>d.origin==='canal').length,0);
  assert.equal(canal.world.rooms.flatMap(r=>r.doors).filter(d=>d.needs==='ferryman').length,4);
  assert.equal(reeds.world.rooms.flatMap(r=>r.doors).filter(d=>d.needs==='ferryman').length,2);
  assert.equal(reeds.hero.maxHp, canal.hero.maxHp+1);
});

test('mason-first extends the crypt graph and archivist-first reconstructs an alternative crypt floor', () => {
  const forge = gameWith('mason','memory');
  const arcade = gameWith('archivist','memory');
  const f = forge.branches.find(b=>b.key==='memory');
  const a = arcade.branches.find(b=>b.key==='memory');
  assert.equal(f.name,'Stone Foundry');
  assert.equal(a.name,'Memorial Arcade');
  assert.equal(f.passage.length,2);
  assert.equal(a.passage,null);
  assert.equal(a.terrainCleared.length,5);
  assert.equal(forge.hero.power,arcade.hero.power+1);
  assert.equal(arcade.hero.maxHp,forge.hero.maxHp+2);
  assert.equal(analyzeGame(forge).valid,true);
  assert.equal(analyzeGame(arcade).valid,true);
});

test('both orchard origins reshape the warden room in distinct deterministic ways', () => {
  const bloom = gameWith('gardener','orchard');
  const bell = gameWith('bellkeeper','orchard');
  const roomId = bloom.world.rooms.find(r=>r.boss).id;
  const otherRoom = bell.world.rooms.find(r=>r.boss).id;
  assert.equal(roomId, otherRoom);
  assert.equal(bloom.branches[0].terrainCleared.length,5);
  assert.equal(bell.branches[0].terrainCleared.length,5);
  assert.notDeepEqual(bloom.world.rooms[roomId].obstacles,bell.world.rooms[roomId].obstacles);
  assert.equal(bloom.hero.maxHp,bell.hero.maxHp+1);
  assert.equal(bell.hero.power,bloom.hero.power+1);
});

test('the first two completed projects establish an order-sensitive founding accord', () => {
  const orders = [
    ['ferryman','herbalist','mason','archivist','gardener','bellkeeper'],
    ['ferryman','mason','archivist','herbalist','gardener','bellkeeper'],
    ['ferryman','mason','gardener','bellkeeper','herbalist','archivist'],
  ];
  const states = orders.map(order => order.reduce((g,soul)=>rescue(g,soul),newGame('founding-counterfactual')));
  assert.deepEqual(states.map(g=>epilogue(g).key),['AAA','AAA','AAA']);
  assert.deepEqual(states.map(g=>g.accord.order),[
    'waterside>memory','memory>waterside','orchard>waterside']);
  assert.equal(new Set(states.map(g=>epilogue(g).historyKey)).size,3);
  assert.equal(states[0].hero.maxHp,states[1].hero.maxHp+1);
  assert.equal(states[1].hero.focus,2);
  assert.equal(states[2].hero.ward,2);
  assert.equal(states[0].events.filter(e=>e.type==='accord').length,1);
  assert.ok(states.every(g=>analyzeGame(g).valid));
  const traveler = 'ferryman';
  const homePaths = states.map(g => {
    const sample = structuredClone(g);sample.townTicks=42;
    return townNpcs(sample).find(n=>n.id===traveler);
  });
  assert.notDeepEqual(homePaths[0],homePaths[1]);
});

test('each active civic site grants its unique, single-use resource', () => {
  const gifts = [
    ['waterside','ferryman','canal'], ['waterside','herbalist','spring'],
    ['memory','mason','forge'], ['memory','archivist','archive'],
    ['orchard','gardener','grove'], ['orchard','bellkeeper','resonator'],
  ];
  for (const [key,first,kind] of gifts) {
    let game = gameWith(first,key,'shrine-'+key);
    const site = game.world.civicSites[key];
    const views = activeCivicSites(game,site.room);
    assert.equal(views.length,1);
    assert.equal(views[0].kind,kind);
    game.hero.hp=1;
    game=visitSite(game,key);
    assert.deepEqual(game.usedSites,[key]);
    assert.equal(game.events.filter(e=>e.type==='site' && e.key===key).length,1);
    if (kind==='forge' || kind==='resonator') assert.equal(game.hero.focus,4);
    if (kind==='archive') assert.equal(game.hero.ward,3);
    if (['canal','spring','grove'].includes(kind)) assert.ok(game.hero.hp>1);
    const once = {hp:game.hero.hp,ward:game.hero.ward,focus:game.hero.focus};
    game=dispatch(game,{type:'interact'});
    assert.deepEqual({hp:game.hero.hp,ward:game.hero.ward,focus:game.hero.focus},once);
    assert.equal(game.usedSites.length,1);
  }
});

test('the focused torchblade consumes charges only on hit, and memorial wards absorb attacks', () => {
  let blade = visitSite(gameWith('mason','memory'), 'memory');
  blade.hero.x=10; blade.hero.y=8; blade.hero.face='up';
  blade.roomStates[blade.hero.room].enemies=[];
  const empty = dispatch(blade,{type:'attack'});
  assert.equal(empty.hero.focus,4);
  empty.roomStates[empty.hero.room].enemies=[{id:'focus',x:10,y:7,hp:10,kind:'shade',damage:1}];
  const hit=dispatch(empty,{type:'attack'});
  assert.equal(hit.hero.focus,3);
  assert.equal(hit.roomStates[hit.hero.room].enemies[0].hp,10-(hit.hero.power+1));
  let shield = visitSite(gameWith('archivist','memory'), 'memory');
  shield.hero.room=shield.world.rooms.find(r=>r.boss).id;
  shield.hero.x=10;shield.hero.y=8;shield.hero.hp=5;shield.turns=2;
  shield.roomStates[shield.hero.room].enemies=[{id:'shade',kind:'shade',x:10,y:7,hp:2,damage:1}];
  const warded=dispatch(shield,{type:'wait'});
  assert.equal(warded.hero.hp,5);
  assert.equal(warded.hero.ward,2);
});

test('bellkeeper-first slows the warden specifically on every fourth turn', () => {
  function wardenAttack(first) {
    const state = gameWith(first,'orchard');
    state.hero.room=state.world.rooms.find(r=>r.boss).id;
    state.hero.x=10;state.hero.y=4;state.turns=3;
    state.hero.hp=6;
    state.roomStates[state.hero.room].enemies=[{id:'boss',kind:'warden',x:10,y:3,hp:5,damage:1}];
    return dispatch(state,{type:'wait'});
  }
  assert.equal(wardenAttack('gardener').hero.hp,5);
  assert.equal(wardenAttack('bellkeeper').hero.hp,6);
});

test('villagers patrol between restored homes and order-specific civic buildings', () => {
  const canal=gameWith('ferryman','waterside'), reeds=gameWith('herbalist','waterside');
  assert.notEqual(townDialogue(canal,'ferryman'),townDialogue(reeds,'ferryman'));
  const positions=new Set();
  for (let i=0;i<100;i++) {
    const sample=structuredClone(canal);sample.townTicks=i;
    const ferry=townNpcs(sample).find(n=>n.id==='ferryman');
    assert.ok(ferry.x>=1 && ferry.x<=18 && ferry.y>=1 && ferry.y<=11);
    positions.add(`${ferry.x},${ferry.y}`);
    assert.deepEqual(townNpcs(sample),townNpcs(sample));
  }
  assert.ok(positions.size>=4, 'returned NPC must visit several locations');
  const moved=dispatch({...canal,mode:'town'}, {type:'move',direction:'right'});
  assert.equal(moved.townTicks,canal.townTicks+1);
});

test('dynamic encounters remain reproducible through v2 action-history saves', () => {
  const plan=['herbalist','ferryman','archivist','mason','bellkeeper','gardener'];
  let game=newGame('replay-civic-history');
  for(let i=0;i<16000 && game.status==='playing';i++) game=dispatch(game,botAction(game,plan));
  assert.equal(game.status,'won');
  assert.equal(game.epilogue.key,'BBB');
  assert.deepEqual(deserialize(serialize(game)),game);
  assert.deepEqual(replay(game.seed,game.history),game);
  assert.throws(()=>deserialize('{"version":1,"seed":"104729","history":[]}'),/incompatible/);
});

test('thirty two random initial worlds remain valid under both versions of each civic pair', () => {
  for(let i=0;i<32;i++) for(let mask=0;mask<8;mask++) {
    const {game}=variants(mask,`stress-${i}`);
    const audit=analyzeGame(game);
    assert.equal(audit.valid,true,`seed ${i} mask ${mask}: ${audit.problems.join(', ')}`);
    for(const branch of game.branches) {
      const site=activeCivicSites(game,branch.site.room).find(s=>s.key===branch.key);
      assert.ok(site);
      assert.equal(site.used,false);
    }
  }
});
