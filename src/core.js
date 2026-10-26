/** Soul Torch, deterministic simulation core. Zero dependencies, no browser APIs. */
export const WIDTH = 20;
export const HEIGHT = 13;
export const VERSION = 1;

const ROLES = [
  { id: 'ferryman', title: 'Ferryman', site: 'River Landing', line: 'The river remembers every crossing.', freed: 'The ferryman returns. A passage opens beyond the lowlands.' },
  { id: 'herbalist', title: 'Herbalist', site: 'Healing Garden', line: 'Every root knows which way is home.', freed: 'The garden stirs. You can recover your strength in the village.' },
  { id: 'mason', title: 'Mason', site: 'Stone Bridge', line: 'A bridge is a promise between two shores.', freed: 'The mason rebuilds the old bridge to the sunken crypt.' },
  { id: 'archivist', title: 'Archivist', site: 'Hall of Memory', line: 'A name written down is a soul kept near.', freed: 'The archive opens. The names of the lost can be spoken again.' },
  { id: 'gardener', title: 'Gardener', site: 'Moon Orchard', line: 'Even after darkness, the seeds wait.', freed: 'An orchard blooms. Your maximum vitality grows by two.' },
  { id: 'bellkeeper', title: 'Bellkeeper', site: 'Bell Tower', line: 'When the bell sounds, the scattered find their way.', freed: 'The tower rings. Your sword burns brighter.' },
];
const NAMES = [
  ['Ivo', 'Neris', 'Pavel'], ['Mira', 'Eli', 'Tala'],
  ['Roe', 'Bram', 'Asha'], ['Sel', 'Vera', 'Nim'],
  ['Orin', 'Ysol', 'Lenn'], ['Edda', 'Oro', 'Runa'],
];
const DIRECTIONS = { up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0] };
const REVERSE = { up: 'down', down: 'up', left: 'right', right: 'left' };
const TYPES = ['moss', 'wisp', 'shade'];
const inBounds = (x, y) => x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT;
const xyKey = (x, y) => `${x},${y}`;

export function normalizeSeed(value) {
  const str = String(value ?? '104729');
  let n = 2166136261;
  for (let i = 0; i < str.length; i++) {
    n = Math.imul(n ^ str.charCodeAt(i), 16777619);
  }
  return n >>> 0;
}
export function rng(seed) {
  let state = (seed >>> 0) || 0x9e3779b9;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}
function randInt(random, n) { return Math.floor(random() * n); }
function choice(random, xs) { return xs[randInt(random, xs.length)]; }
function shuffle(random, xs) {
  const copy = [...xs];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = randInt(random, i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
function location(id) { return { x: id % 2, y: Math.floor(id / 2) }; }
function directionBetween(a, b) {
  const p = location(a), q = location(b);
  if (q.x === p.x + 1 && q.y === p.y) return 'right';
  if (q.x === p.x - 1 && q.y === p.y) return 'left';
  if (q.x === p.x && q.y === p.y + 1) return 'down';
  if (q.x === p.x && q.y === p.y - 1) return 'up';
  throw new Error(`Rooms ${a} and ${b} are not neighbors`);
}
function link(rooms, a, b, needs = null) {
  const dir = directionBetween(a, b);
  if (rooms[a].doors.some(d => d.to === b)) return;
  rooms[a].doors.push({ to: b, dir, needs });
  rooms[b].doors.push({ to: a, dir: REVERSE[dir], needs });
}
function pickSeals(random, rooms) {
  const bySector = [
    [1, 2, 3], [4, 5, 6, 7], [8, 9, 10, 11],
  ];
  const selected = [shuffle(random, bySector[0]).slice(0, 2),
    shuffle(random, bySector[1]).slice(0, 2),
    shuffle(random, bySector[2]).slice(0, 2)];
  // The soul with the gate key is always in the sector before that gate.
  rooms[selected[0][0]].soulId = 'ferryman';
  rooms[selected[0][1]].soulId = 'herbalist';
  rooms[selected[1][0]].soulId = 'mason';
  rooms[selected[1][1]].soulId = 'archivist';
  rooms[selected[2][0]].soulId = 'gardener';
  rooms[selected[2][1]].soulId = 'bellkeeper';
}
function decorate(random, room) {
  const banned = new Set();
  for (let x = 0; x < WIDTH; x++) banned.add(xyKey(x, 6));
  for (let y = 0; y < HEIGHT; y++) banned.add(xyKey(10, y));
  // Keep the center, seal, and all four entrances clear.
  for (let y = 3; y <= 9; y++) for (let x = 8; x <= 12; x++) banned.add(xyKey(x, y));
  const obstacles = new Set();
  for (let i = 0; i < 17; i++) {
    const x = 2 + randInt(random, WIDTH - 4), y = 2 + randInt(random, HEIGHT - 4);
    const key = xyKey(x, y);
    if (!banned.has(key)) obstacles.add(key);
  }
  room.obstacles = [...obstacles].sort();
  const reachable = reachableTiles(room);
  const enemies = [];
  const occupied = new Set([...obstacles, xyKey(10, 8), xyKey(10, 4), xyKey(10, 3)]);
  const count = 2 + room.sector + randInt(random, 2);
  for (let i = 0; i < count; i++) {
    for (let tries = 0; tries < 150; tries++) {
      const x = 2 + randInt(random, WIDTH - 4), y = 2 + randInt(random, HEIGHT - 4);
      const key = xyKey(x, y);
      if (occupied.has(key) || !reachable.has(key) || Math.abs(x - 10) + Math.abs(y - 8) < 4) continue;
      occupied.add(key);
      enemies.push({ id: `${room.id}:${i}`, kind: choice(random, TYPES), x, y,
        hp: room.sector === 0 ? 1 : 2, damage: 1 });
      break;
    }
  }
  room.enemies = enemies;
}
export function generateWorld(seed = '104729') {
  const random = rng(normalizeSeed(seed));
  const rooms = Array.from({ length: 12 }, (_, id) => ({
    id, ...location(id), sector: Math.floor(id / 4), doors: [], soulId: null,
    obstacles: [], enemies: [], boss: false,
  }));
  for (let sector = 0; sector < 3; sector++) {
    const k = 4 * sector;
    const candidates = shuffle(random, [[k, k + 1], [k, k + 2], [k + 1, k + 3], [k + 2, k + 3]]);
    const parent = new Map([0, 1, 2, 3].map(i => [k + i, k + i]));
    function find(a) { while (parent.get(a) !== a) a = parent.get(a); return a; }
    for (const [a, b] of candidates) {
      if (find(a) !== find(b)) { parent.set(find(a), find(b)); link(rooms, a, b); }
      else if (random() < 0.5) link(rooms, a, b);
    }
  }
  const firstCol = randInt(random, 2), secondCol = randInt(random, 2);
  link(rooms, 2 + firstCol, 4 + firstCol, 'ferryman');
  link(rooms, 6 + secondCol, 8 + secondCol, 'mason');
  pickSeals(random, rooms);
  const bosses = [8, 9, 10, 11].filter(id => !rooms[id].soulId);
  rooms[choice(random, bosses)].boss = true;
  for (const room of rooms) {
    decorate(random, room);
    if (room.boss) room.enemies.push({ id: `boss:${room.id}`, kind: 'warden', x: 10, y: 3, hp: 5, damage: 1 });
    room.doors.sort((a, b) => a.to - b.to);
  }
  const souls = ROLES.map((role, i) => ({ ...role, name: choice(random, NAMES[i]) }));
  return { version: VERSION, seed: String(seed), rooms, souls, settlement: 'Drowned Village' };
}
export function getSoul(world, id) { return world.souls.find(s => s.id === id); }
export function hasDoor(room, dir) { return room.doors.find(d => d.dir === dir); }
export function isBlocked(room, x, y) {
  if (!inBounds(x, y)) return true;
  if (x === 0) return !(y === 6 && hasDoor(room, 'left'));
  if (x === WIDTH - 1) return !(y === 6 && hasDoor(room, 'right'));
  if (y === 0) return !(x === 10 && hasDoor(room, 'up'));
  if (y === HEIGHT - 1) return !(x === 10 && hasDoor(room, 'down'));
  return room.obstacles.includes(xyKey(x, y));
}
function reachableTiles(room) {
  const seen = new Set([xyKey(10, 8)]), queue = [[10, 8]];
  for (let k = 0; k < queue.length; k++) {
    const [x, y] = queue[k];
    for (const [dx, dy] of Object.values(DIRECTIONS)) {
      const nx = x + dx, ny = y + dy, key = xyKey(nx, ny);
      if (!isBlocked(room, nx, ny) && !seen.has(key)) { seen.add(key); queue.push([nx, ny]); }
    }
  }
  return seen;
}
function floorReachable(room) {
  const seen = reachableTiles(room);
  const needed = [[10, 4], ...room.enemies.map(e => [e.x, e.y])];
  for (const door of room.doors) {
    const pos = door.dir === 'left' ? [0, 6] : door.dir === 'right' ? [WIDTH - 1, 6] :
      door.dir === 'up' ? [10, 0] : [10, HEIGHT - 1];
    needed.push(pos);
  }
  return needed.every(([x, y]) => seen.has(xyKey(x, y)));
}
/** Abstract progression solver used both by tests and tooling. */
export function analyzeWorld(world) {
  const problems = [];
  if (world.rooms.length !== 12) problems.push('Expected 12 rooms');
  const seenSouls = new Set();
  for (const room of world.rooms) {
    if (!floorReachable(room)) problems.push(`Room ${room.id} has disconnected floor`);
    if (room.soulId) {
      if (seenSouls.has(room.soulId)) problems.push(`Duplicate soul ${room.soulId}`);
      seenSouls.add(room.soulId);
    }
    for (const edge of room.doors) {
      if (!world.rooms[edge.to]?.doors.some(back => back.to === room.id &&
        back.needs === edge.needs && back.dir === REVERSE[edge.dir])) {
        problems.push(`Door reciprocity failure ${room.id}->${edge.to}`);
      }
    }
  }
  for (const soul of ROLES) if (!seenSouls.has(soul.id)) problems.push(`Missing ${soul.id}`);
  const unlocked = new Set(), visited = new Set();
  let changed = true;
  while (changed) {
    changed = false;
    const pending = [0], active = new Set([0]);
    while (pending.length) {
      const id = pending.shift();
      visited.add(id);
      const soul = world.rooms[id].soulId;
      if (soul && !unlocked.has(soul)) { unlocked.add(soul); changed = true; }
      for (const d of world.rooms[id].doors) {
        if ((!d.needs || unlocked.has(d.needs)) && !active.has(d.to)) {
          active.add(d.to); pending.push(d.to);
        }
      }
    }
  }
  if (visited.size !== 12) problems.push(`Only ${visited.size}/12 rooms reachable`);
  if (unlocked.size !== 6) problems.push(`Only ${unlocked.size}/6 souls unlockable`);
  return { valid: problems.length === 0, problems, roomsReachable: visited.size,
    soulsReachable: unlocked.size };
}
function message(game, content) {
  game.log.unshift(content);
  game.log = game.log.slice(0, 7);
}
export function newGame(seed = '104729') {
  const world = generateWorld(seed);
  const audit = analyzeWorld(world);
  if (!audit.valid) throw new Error(`World generation failed: ${audit.problems.join('; ')}`);
  return {
    version: VERSION, seed: String(seed), world,
    roomStates: world.rooms.map(room => ({ enemies: structuredClone(room.enemies), settled: false })),
    hero: { room: 0, x: 10, y: 8, face: 'up', hp: 8, maxHp: 8, power: 1 },
    home: { x: 10, y: 6 }, mode: 'dungeon',
    rescued: [], visited: [0], branches: [], turns: 0, kills: 0, rests: 0, history: [],
    events: [], log: ['The village waits in silence. Enter the dungeon.'],
    status: 'playing', finalScore: null,
  };
}
function release(game, soulId) {
  if (game.rescued.includes(soulId)) return;
  const soul = getSoul(game.world, soulId);
  game.rescued.push(soulId);
  game.events.push({ turn: game.turns, type: 'restoration', soulId, name: soul.name,
    site: soul.site });
  message(game, `${soul.name}, the ${soul.title.toLowerCase()}, is free. ${soul.freed}`);
  if (soulId === 'gardener') {
    game.hero.maxHp += 2;
    game.hero.hp += 2;
  }
  if (soulId === 'bellkeeper') game.hero.power += 1;
  const pairings = [
    ['ferryman', 'archivist', 'The archive reveals the names of those lost on the river.'],
    ['mason', 'gardener', 'The mason builds terraces for the moon orchard.'],
    ['herbalist', 'bellkeeper', 'A healing melody carries through the streets.'],
  ];
  for (const [a, b, text] of pairings) {
    if (game.rescued.includes(a) && game.rescued.includes(b) &&
      !game.events.some(e => e.type === 'memory' && e.key === `${a}:${b}`)) {
      game.events.push({ turn: game.turns, type: 'memory', key: `${a}:${b}`, text });
      message(game, text);
    }
  }
  // These civic outcomes depend on rescue order, and change the playable run.
  const pairs = [
    { key: 'waterside', a: 'ferryman', b: 'herbalist',
      first: ['Canal Commons', 'Village rests now cost six turns.'],
      second: ['Reed Sanctuary', 'The spring grants one additional maximum HP.'] },
    { key: 'memory', a: 'mason', b: 'archivist',
      first: ['Stone Foundry', 'Reclaimed iron strengthens the torchblade.'],
      second: ['Memorial Arcade', 'The ancestral shrine grants two maximum HP.'] },
    { key: 'orchard', a: 'gardener', b: 'bellkeeper',
      first: ['Living Bells', 'The blooming towers grant one maximum HP.'],
      second: ['Resonant Orchard', 'The orchard bell strengthens the torchblade.'] },
  ];
  for (const pair of pairs) {
    if (!game.rescued.includes(pair.a) || !game.rescued.includes(pair.b) ||
      game.branches.some(branch => branch.key === pair.key)) continue;
    const first = game.rescued.indexOf(pair.a) < game.rescued.indexOf(pair.b) ? pair.a : pair.b;
    const [name, effect] = first === pair.a ? pair.first : pair.second;
    game.branches.push({ key: pair.key, first, name, effect });
    game.events.push({ turn: game.turns, type: 'branch', key: pair.key, name, first });
    message(game, `${name} takes shape. ${effect}`);
    if (pair.key === 'waterside' && first === pair.b) { game.hero.maxHp++; game.hero.hp++; }
    if (pair.key === 'memory' && first === pair.a) game.hero.power++;
    if (pair.key === 'memory' && first === pair.b) { game.hero.maxHp += 2; game.hero.hp += 2; }
    if (pair.key === 'orchard' && first === pair.a) { game.hero.maxHp++; game.hero.hp++; }
    if (pair.key === 'orchard' && first === pair.b) game.hero.power++;
  }
}
function tickEnemies(game) {
  const hero = game.hero, room = game.world.rooms[hero.room];
  const current = game.roomStates[hero.room];
  const occupied = new Set(current.enemies.map(e => xyKey(e.x, e.y)));
  for (const enemy of current.enemies) {
    if (game.status !== 'playing') return;
    if (game.turns % (enemy.kind === 'warden' ? 2 : 3) !== 0) continue;
    const dist = Math.abs(enemy.x - hero.x) + Math.abs(enemy.y - hero.y);
    if (dist === 1) {
      hero.hp -= enemy.damage;
      message(game, `${enemy.kind === 'warden' ? 'The warden' : 'A shadow'} strikes. -${enemy.damage} HP`);
      if (hero.hp <= 0) { hero.hp = 0; game.status = 'lost'; message(game, 'The torch goes dark.'); }
    } else if (dist > 1 && dist <= 7) {
      const deltas = [...Object.values(DIRECTIONS)].sort((p, q) =>
        (Math.abs(enemy.x + p[0] - hero.x) + Math.abs(enemy.y + p[1] - hero.y)) -
        (Math.abs(enemy.x + q[0] - hero.x) + Math.abs(enemy.y + q[1] - hero.y)));
      for (const [dx, dy] of deltas) {
        const nx = enemy.x + dx, ny = enemy.y + dy, k = xyKey(nx, ny);
        if (!isBlocked(room, nx, ny) && !occupied.has(k) && !(nx === hero.x && ny === hero.y)) {
          occupied.delete(xyKey(enemy.x, enemy.y)); enemy.x = nx; enemy.y = ny; occupied.add(k);
          break;
        }
      }
    }
  }
}
function walk(game, dir) {
  if (!DIRECTIONS[dir]) throw new Error(`Invalid direction: ${dir}`);
  const [dx, dy] = DIRECTIONS[dir];
  if (game.mode === 'town') {
    game.home.x = Math.max(1, Math.min(WIDTH - 2, game.home.x + dx));
    game.home.y = Math.max(1, Math.min(HEIGHT - 2, game.home.y + dy));
    return;
  }
  const hero = game.hero, room = game.world.rooms[hero.room];
  hero.face = dir;
  const nx = hero.x + dx, ny = hero.y + dy;
  if (!inBounds(nx, ny)) {
    const door = hasDoor(room, dir);
    if (!door) return;
    if (door.needs && !game.rescued.includes(door.needs)) {
      message(game, `The path is sealed. Find the ${getSoul(game.world, door.needs).title.toLowerCase()}.`);
      return;
    }
    hero.room = door.to;
    if (!game.visited.includes(door.to)) game.visited.push(door.to);
    hero.x = dir === 'left' ? WIDTH - 2 : dir === 'right' ? 1 : 10;
    hero.y = dir === 'up' ? HEIGHT - 2 : dir === 'down' ? 1 : 6;
    message(game, `Entered chamber ${door.to + 1} / 12.`);
    return;
  }
  if (isBlocked(room, nx, ny)) return;
  if (game.roomStates[hero.room].enemies.some(e => e.x === nx && e.y === ny)) return;
  hero.x = nx; hero.y = ny;
}
function attack(game) {
  if (game.mode !== 'dungeon') return;
  const { x, y, face, power, room } = game.hero;
  const [dx, dy] = DIRECTIONS[face];
  const frontX = x + dx, frontY = y + dy;
  const enemies = game.roomStates[room].enemies;
  const enemy = enemies.find(e => e.x === frontX && e.y === frontY);
  if (enemy) {
    enemy.hp -= power;
    message(game, `Torchblade strikes ${enemy.kind} for ${power}.`);
    if (enemy.hp <= 0) {
      enemies.splice(enemies.indexOf(enemy), 1);
      game.kills++;
      message(game, `${enemy.kind === 'warden' ? 'The warden falls' : 'Shadow scattered'}.`);
    }
  } else message(game, 'The torchblade cuts through the air.');
}
function interact(game) {
  if (game.mode === 'town') {
    const places = [ [3, 3], [10, 3], [17, 3], [3, 9], [10, 9], [17, 9] ];
    let target = -1, dist = Infinity;
    for (let i = 0; i < places.length; i++) {
      if (!game.rescued.includes(ROLES[i].id)) continue;
      const d = Math.abs(game.home.x - places[i][0]) + Math.abs(game.home.y - places[i][1]);
      if (d <= 3 && d < dist) { target = i; dist = d; }
    }
    if (target === -1) { message(game, 'Only the wind answers.'); return; }
    const soul = game.world.souls[target];
    message(game, `${soul.name}: “${soul.line}”`);
    if (soul.id === 'herbalist') {
      game.hero.hp = game.hero.maxHp;
      message(game, `${soul.name} tends your wounds.`);
    }
    return;
  }
  const hero = game.hero, room = game.world.rooms[hero.room], current = game.roomStates[hero.room];
  if (Math.abs(hero.x - 10) + Math.abs(hero.y - 4) > 2) {
    message(game, 'Approach the sealed lair to release its soul.'); return;
  }
  if (current.settled) { message(game, 'The lair has already been purified.'); return; }
  if (current.enemies.length) { message(game, 'The remaining monsters sustain this seal.'); return; }
  current.settled = true;
  if (room.soulId) release(game, room.soulId);
  else { game.hero.hp = Math.min(game.hero.maxHp, game.hero.hp + 1);
    message(game, 'The empty lair fades. A spark restores one HP.'); }
  if (game.rescued.length === 6 && game.roomStates.some((s, i) => game.world.rooms[i].boss &&
    !s.enemies.some(e => e.kind === 'warden'))) {
    game.status = 'won';
    game.finalScore = Math.max(0, 1500 - game.turns - 40 * game.rests);
    game.events.push({ type: 'victory', turn: game.turns, score: game.finalScore });
    message(game, 'The last bell rings. The drowned village lives again.');
  }
}
/** Pure state transition. Every accepted command is recorded for reproducible replays. */
export function dispatch(state, action) {
  if (state.status !== 'playing') return state;
  if (!action || typeof action.type !== 'string') throw new TypeError('Action needs a type');
  const game = structuredClone(state);
  let enemyTurn = false;
  switch (action.type) {
    case 'move': walk(game, action.direction); enemyTurn = game.mode === 'dungeon'; break;
    case 'attack': attack(game); enemyTurn = game.mode === 'dungeon'; break;
    case 'interact': interact(game); enemyTurn = game.mode === 'dungeon'; break;
    case 'wait': enemyTurn = game.mode === 'dungeon'; break;
    case 'toggleTown':
      game.mode = game.mode === 'dungeon' ? 'town' : 'dungeon';
      message(game, game.mode === 'town' ? 'You return to the silent village.' : 'Back into the shadows.');
      break;
    case 'rest':
      if (game.mode === 'town') {
        game.hero.hp = game.hero.maxHp;
        const restCost = game.branches.some(b => b.key === 'waterside' && b.first === 'ferryman') ? 6 : 8;
        game.rests++; game.turns += restCost;
        message(game, `You rest by the torch. ${restCost} turns pass.`);
      }
      break;
    default: throw new Error(`Unknown action: ${action.type}`);
  }
  if (enemyTurn) { game.turns++; if (game.status === 'playing') tickEnemies(game); }
  game.history.push(action);
  return game;
}
export function replay(seed, history) {
  let game = newGame(seed);
  for (const action of history) game = dispatch(game, action);
  return game;
}
export function serialize(game) {
  return JSON.stringify({ version: VERSION, seed: game.seed, history: game.history });
}
export function deserialize(json) {
  const saved = JSON.parse(json);
  if (saved.version !== VERSION || typeof saved.seed !== 'string' ||
    !Array.isArray(saved.history) || saved.history.length > 100000) {
    throw new Error('Invalid or incompatible save');
  }
  return replay(saved.seed, saved.history);
}
