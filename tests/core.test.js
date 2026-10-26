import test from 'node:test';
import assert from 'node:assert/strict';
import { generateWorld, analyzeWorld, newGame, dispatch, replay,
  deserialize, serialize, getSoul, hasDoor, isBlocked, WIDTH, HEIGHT } from '../src/core.js';

const directions = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
function clearRoom(game, roomId) {
  const copy = structuredClone(game);
  copy.hero.room = roomId;
  copy.hero.x = 10;
  copy.hero.y = 5;
  copy.roomStates[roomId].enemies = [];
  return dispatch(copy, { type: 'interact' });
}

test('one thousand distinct seeds have six unique souls, a warden, and solvable gates', () => {
  const seen = new Set();
  for (let i = 0; i < 1000; i++) {
    const world = generateWorld(`smoke-${i}`);
    const audit = analyzeWorld(world);
    assert.equal(audit.valid, true, `${i}: ${audit.problems.join(', ')}`);
    assert.equal(audit.roomsReachable, 12);
    assert.equal(audit.soulsReachable, 6);
    assert.equal(world.rooms.filter(r => r.boss).length, 1);
    assert.equal(world.rooms.filter(r => r.soulId).length, 6);
    assert.equal(world.rooms.find(r => r.soulId === 'ferryman').sector, 0);
    assert.equal(world.rooms.find(r => r.soulId === 'mason').sector, 1);
    seen.add(JSON.stringify(world.rooms.map(r => [r.soulId, r.doors.map(d => d.to), r.obstacles])));
  }
  assert.ok(seen.size > 950, 'generator should offer varied maps');
});

test('generating the same seed returns byte-identical worlds', () => {
  const original = generateWorld('104729');
  assert.equal(JSON.stringify(generateWorld('104729')), JSON.stringify(original));
  assert.notEqual(JSON.stringify(generateWorld('104730')), JSON.stringify(original));
});

test('portal interactions require adjacent player, a cleared room and a soul', () => {
  const initial = newGame('104729');
  const soulRoom = initial.world.rooms.find(r => r.soulId)?.id;
  let state = structuredClone(initial);
  state.hero.room = soulRoom;
  state.hero.x = 10;
  state.hero.y = 5;
  state = dispatch(state, { type: 'interact' });
  assert.deepEqual(state.rescued, []);
  state.roomStates[soulRoom].enemies = [];
  state = dispatch(state, { type: 'interact' });
  assert.equal(state.rescued.length, 1);
  const again = dispatch(state, { type: 'interact' });
  assert.equal(again.rescued.length, 1);
});

test('the ferryman and mason unlock their respective gates', () => {
  let state = newGame('gate-test');
  const first = state.world.rooms.find(r => r.soulId === 'ferryman');
  const second = state.world.rooms.find(r => r.soulId === 'mason');
  assert.ok(state.world.rooms.some(r => r.doors.some(d => d.needs === 'ferryman')));
  assert.ok(state.world.rooms.some(r => r.doors.some(d => d.needs === 'mason')));
  state = clearRoom(state, first.id);
  assert.ok(state.rescued.includes('ferryman'));
  assert.ok(!state.rescued.includes('mason'));
  state = clearRoom(state, second.id);
  assert.ok(state.rescued.includes('mason'));
  assert.ok(state.events.some(e => e.type === 'restoration' && e.soulId === 'mason'));
});

test('restoration pair memories trigger exactly once regardless of release order', () => {
  for (const backwards of [false, true]) {
    let state = newGame(`pairs-${backwards}`);
    const order = backwards ? ['archivist', 'ferryman'] : ['ferryman', 'archivist'];
    for (const id of order) {
      const room = state.world.rooms.find(r => r.soulId === id);
      state = clearRoom(state, room.id);
    }
    assert.equal(state.events.filter(e => e.type === 'memory' && e.key === 'ferryman:archivist').length, 1);
    assert.ok(state.events.some(e => e.type === 'restoration' && e.soulId === 'archivist'));
  }
});

test('non-soul chambers can be purified only once, restoring one health', () => {
  let state = newGame('empty-room');
  const room = state.world.rooms.find(r => !r.soulId);
  state.hero.hp = 3;
  state = clearRoom(state, room.id);
  assert.equal(state.hero.hp, 4);
  state = clearRoom(state, room.id);
  assert.equal(state.hero.hp, 4);
});

test('arrival doors are reciprocal and their border tiles remain traversable', () => {
  const world = generateWorld('doors');
  for (const room of world.rooms) {
    for (const door of room.doors) {
      const target = world.rooms[door.to];
      assert.ok(target.doors.some(d => d.to === room.id && d.needs === door.needs));
      const cell = door.dir === 'left' ? [0, 6] : door.dir === 'right' ? [WIDTH - 1, 6] :
        door.dir === 'up' ? [10, 0] : [10, HEIGHT - 1];
      assert.equal(isBlocked(room, ...cell), false);
    }
  }
});

test('combat resolves and dead enemies cannot attack again', () => {
  let state = newGame('combat');
  const room = state.hero.room;
  state.roomStates[room].enemies = [ { id: 'demo', kind: 'moss', x: 10, y: 7, hp: 1, damage: 1 } ];
  state = dispatch(state, { type: 'attack' });
  assert.equal(state.kills, 1);
  assert.equal(state.hero.hp, 8);
  assert.equal(state.roomStates[room].enemies.length, 0);
});

test('return to village, healing and run serialization preserve replay', () => {
  let game = newGame('replay-check');
  game = dispatch(game, { type: 'move', direction: 'up' });
  game = dispatch(game, { type: 'attack' });
  game = dispatch(game, { type: 'toggleTown' });
  game = dispatch(game, { type: 'move', direction: 'left' });
  game = dispatch(game, { type: 'rest' });
  game = dispatch(game, { type: 'toggleTown' });
  assert.equal(game.rests, 1);
  assert.equal(game.hero.hp, game.hero.maxHp);
  assert.deepEqual(deserialize(serialize(game)), game);
  assert.deepEqual(replay(game.seed, game.history), game);
});

test('six souls and the defeated warden conclude with a scored victory', () => {
  let game = newGame('complete-arc');
  for (const room of game.world.rooms.filter(r => r.soulId)) game = clearRoom(game, room.id);
  const boss = game.world.rooms.find(r => r.boss);
  game = clearRoom(game, boss.id);
  assert.equal(game.status, 'won');
  assert.equal(game.rescued.length, 6);
  assert.ok(game.finalScore > 0);
  assert.equal(game.events.at(-1).type, 'victory');
});

test('invalid actions fail closed, completed runs stay immutable', () => {
  const game = newGame('invalid-actions');
  assert.throws(() => dispatch(game, { type: 'unknown' }), /Unknown action/);
  assert.throws(() => dispatch(game, { type: 'move', direction: 'northwest' }), /Invalid direction/);
  assert.throws(() => deserialize('{"version":999,"seed":"1","history":[]}'), /Invalid/);
  const finished = structuredClone(game); finished.status = 'lost';
  assert.equal(dispatch(finished, { type: 'move', direction: 'down' }), finished);
});

test('rescue order creates distinct village traits and passive effects', () => {
  const world = newGame('branch-outcomes').world;
  const ferryRoom = world.rooms.find(r => r.soulId === 'ferryman').id;
  const herbRoom = world.rooms.find(r => r.soulId === 'herbalist').id;
  let ferryFirst = newGame('branch-outcomes');
  ferryFirst = clearRoom(ferryFirst, ferryRoom);
  ferryFirst = clearRoom(ferryFirst, herbRoom);
  let herbFirst = newGame('branch-outcomes');
  herbFirst = clearRoom(herbFirst, herbRoom);
  herbFirst = clearRoom(herbFirst, ferryRoom);
  assert.equal(ferryFirst.branches[0].name, 'Canal Commons');
  assert.equal(herbFirst.branches[0].name, 'Reed Sanctuary');
  assert.equal(herbFirst.hero.maxHp, ferryFirst.hero.maxHp + 1);
  for (const [state, cost] of [[ferryFirst, 6], [herbFirst, 8]]) {
    const town = dispatch(state, { type: 'toggleTown' });
    const rest = dispatch(town, { type: 'rest' });
    assert.equal(rest.turns, town.turns + cost);
  }
});
