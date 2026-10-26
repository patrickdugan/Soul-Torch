/** Soul Torch, deterministic simulation core. Zero dependencies, no browser APIs. */
import { CIVIC_PROJECTS, CIVIC_ACCORDS, CIVIC_LOTS, TOWN_HOMES, civicProject } from './civic.js';
export const WIDTH = 20;
export const HEIGHT = 13;
export const VERSION = 3;

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
function link(rooms, a, b, needs = null, origin = null) {
  const dir = directionBetween(a, b);
  if (rooms[a].doors.some(d => d.to === b)) return;
  rooms[a].doors.push({ to: b, dir, needs, origin });
  rooms[b].doors.push({ to: a, dir: REVERSE[dir], needs, origin });
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
  // Place future civic sites before any rescue choice, so opposing orders get
  // precisely the same underlying world and can be compared experimentally.
  const civicSites = Object.fromEntries(CIVIC_PROJECTS.map(project => {
    const roomId = project.key === 'orchard' ? rooms.find(room => room.boss).id :
      project.sector * 4 + randInt(random, 4);
    const room = rooms[roomId];
    const cells = shuffle(random, [[5, 3], [15, 3], [5, 9], [15, 9],
      [6, 10], [14, 10], [10, 10], [10, 2]]);
    const reachable = reachableTiles(room);
    const free = ([x, y]) => x >= 2 && x < WIDTH - 2 && y >= 2 && y < HEIGHT - 2 &&
      reachable.has(xyKey(x, y)) &&
      !room.enemies.some(e => e.x === x && e.y === y) &&
      Math.abs(x - 10) + Math.abs(y - 4) > 3 &&
      Math.abs(x - 10) + Math.abs(y - 8) > 2;
    const tile = cells.find(free) || [...reachable].map(key => key.split(',').map(Number)).find(free);
    if (!tile) throw new Error(`No civic site in room ${roomId}`);
    const [x, y] = tile;
    return [project.key, { room: roomId, x, y }];
  }));
  // The council charter is always discovered deep in the crypt. Its location is
  // fixed before rescue choices, so opposite histories remain comparable.
  const charterCandidates = rooms.filter(room => room.sector === 2 && !room.boss);
  const charterRoom = choice(random, charterCandidates);
  const occupied = new Set(charterRoom.enemies.map(enemy => xyKey(enemy.x, enemy.y)));
  for (const site of Object.values(civicSites)) if (site.room === charterRoom.id)
    occupied.add(xyKey(site.x, site.y));
  const tiles = shuffle(random, [[5, 3], [15, 3], [5, 9], [15, 9],
    [6, 10], [14, 10], [10, 10], [10, 2]]);
  const floor = reachableTiles(charterRoom);
  const free = ([x, y]) => floor.has(xyKey(x, y)) && !occupied.has(xyKey(x, y)) &&
    Math.abs(x - 10) + Math.abs(y - 4) > 3 &&
    Math.abs(x - 10) + Math.abs(y - 8) > 2;
  const pos = tiles.find(free) || [...floor].map(key => key.split(',').map(Number)).find(free);
  if (!pos) throw new Error('No charter site in the crypt');
  const charterSite = { room: charterRoom.id, x: pos[0], y: pos[1] };
  return { version: VERSION, seed: String(seed), rooms, souls, civicSites,
    charterSite, settlement: 'Drowned Village' };
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
        back.needs === edge.needs && back.origin === edge.origin &&
        back.dir === REVERSE[edge.dir])) {
        problems.push(`Door reciprocity failure ${room.id}->${edge.to}`);
      }
    }
  }
  for (const soul of ROLES) if (!seenSouls.has(soul.id)) problems.push(`Missing ${soul.id}`);
  for (const project of CIVIC_PROJECTS) {
    const site = world.civicSites?.[project.key];
    if (!site || world.rooms[site.room]?.sector !== project.sector ||
      !reachableTiles(world.rooms[site.room]).has(xyKey(site.x, site.y)) ||
      world.rooms[site.room]?.enemies.some(e => e.x === site.x && e.y === site.y)) {
      problems.push(`Invalid civic site ${project.key}`);
    }
  }
  const charter = world.charterSite;
  if (!charter || world.rooms[charter.room]?.sector !== 2 ||
    world.rooms[charter.room]?.boss ||
    !reachableTiles(world.rooms[charter.room]).has(xyKey(charter.x, charter.y)) ||
    world.rooms[charter.room]?.enemies.some(e => e.x === charter.x && e.y === charter.y) ||
    Object.values(world.civicSites).some(site => site.room === charter.room &&
      site.x === charter.x && site.y === charter.y)) {
    problems.push('Invalid charter site');
  }
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
    hero: { room: 0, x: 10, y: 8, face: 'up', hp: 8, maxHp: 8, power: 1, focus: 0, ward: 0 },
    home: { x: 10, y: 6 }, mode: 'dungeon',
    rescued: [], visited: [0], branches: [], accord: null, charter: null,
    usedSites: [], townTicks: 0,
    turns: 0, kills: 0, rests: 0, history: [],
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
  for (const project of CIVIC_PROJECTS) {
    if (!game.rescued.includes(project.a) || !game.rescued.includes(project.b) ||
      game.branches.some(branch => branch.key === project.key)) continue;
    const first = game.rescued.indexOf(project.a) < game.rescued.indexOf(project.b) ? project.a : project.b;
    const variant = project.variants[first];
    const site = game.world.civicSites[project.key];
    const branch = { key: project.key, first, name: variant.name, kind: variant.kind,
      effect: variant.effect, site: structuredClone(site), terrainCleared: [], passage: null };
    game.branches.push(branch);
    applyCivicProject(game, project, branch);
    game.events.push({ turn: game.turns, type: 'branch', key: branch.key, name: branch.name,
      first, room: site.room, terrainCleared: branch.terrainCleared.length, passage: branch.passage });
    message(game, `${branch.name} takes shape. ${branch.effect}`);
    if (game.branches.length === 2) establishAccord(game);
  }

}
function establishAccord(game) {
  const [first, second] = game.branches;
  const order = `${first.key}>${second.key}`;
  const spec = CIVIC_ACCORDS[order];
  if (!spec || game.accord) throw new Error(`Invalid founding accord ${order}`);
  const accord = { order, name: spec.name,
    dialogue: spec.dialogue, from: first.key, to: second.key,
    firstProject: first.name, secondProject: second.name };
  game.accord = accord;
  game.charter = { ...structuredClone(game.world.charterSite), name: spec.charter,
    oath: spec.oath, stage: 'seeking', infrastructure: null };
  game.events.push({type: 'charter', stage: 'seeking', turn: game.turns,
    order, name: spec.charter, room: game.charter.room });
  // The earliest completed project decides how the new civic center helps.
  if (first.key === 'waterside') { game.hero.maxHp++; game.hero.hp++; accord.gift = '+1 vitality'; }
  if (first.key === 'memory') { game.hero.focus += 2; accord.gift = '+2 focused strikes'; }
  if (first.key === 'orchard') { game.hero.ward += 2; accord.gift = '+2 protective wards'; }
  game.events.push({ type:'accord', turn:game.turns, order,
    name:accord.name, gift:accord.gift });
  message(game, `${accord.name} is founded: ${first.name} joins ${second.name}. ${accord.gift}.`);
}

function clearTerrain(room, count, prefer) {
  const initial = [...room.obstacles];
  const near = initial.filter(key => {
    const [x, y] = key.split(',').map(Number);
    return prefer(x, y);
  });
  const selected = [...near, ...initial.filter(k => !near.includes(k))].slice(0, count);
  room.obstacles = initial.filter(k => !selected.includes(k));
  return selected;
}
/** Ratification creates a durable route, or a cleared ruin when the seed
 * already contains every local door. Both transformations are monotone. */
function ratifyCharter(game) {
  const charter = game.charter, accord = game.accord;
  if (!accord || !charter || charter.stage !== 'carried') return;
  charter.stage = 'ratified';
  const sector = accord.from === 'waterside' ? 1 : 2;
  const k = sector * 4;
  const boundaries = [[k,k+1], [k,k+2], [k+1,k+3], [k+2,k+3]];
  const offset = normalizeSeed(`${game.seed}:${accord.order}`) % boundaries.length;
  const ordered = [...boundaries.slice(offset), ...boundaries.slice(0,offset)];
  const open = ordered.find(([a,b]) => !game.world.rooms[a].doors.some(d => d.to === b));
  if (open) {
    const [a,b] = open;
    link(game.world.rooms, a, b, null, 'charter');
    game.world.rooms[a].doors.sort((x,y)=>x.to-y.to);
    game.world.rooms[b].doors.sort((x,y)=>x.to-y.to);
    charter.infrastructure = { kind: 'passage', between: [a,b] };
  } else {
    const room = game.world.rooms[k + (normalizeSeed(accord.order) % 4)];
    charter.infrastructure = { kind: 'terrain', room: room.id,
      cleared: clearTerrain(room, 3, (x,y)=> accord.from === 'waterside' ? x < 10 : y < 7) };
  }
  const hero = game.hero;
  if (accord.from === 'waterside') {
    hero.maxHp += 2; hero.hp += 2;
    accord.legacy = 'The waterways grant two permanent vitality.';
  } else if (accord.from === 'memory') {
    hero.focus += 4;
    accord.legacy = 'The archive grants four empowered sword strikes.';
  } else {
    hero.ward += 3;
    accord.legacy = 'The living bells ward against three blows.';
  }
  accord.ratified = true;
  game.events.push({type: 'ratification', turn: game.turns, name: charter.name,
    order: accord.order, legacy: accord.legacy,
    infrastructure: structuredClone(charter.infrastructure) });
  message(game, `${charter.name} ratified. ${accord.legacy}`);
}

export function activeCharterSite(game, roomId) {
  if (!game.charter || game.charter.stage !== 'seeking' ||
    game.charter.room !== roomId) return null;
  return { ...game.charter };
}

function openParallelCrossing(game, project, branch) {
  const [a, b] = project.key === 'waterside' ? [2, 4] : [6, 8];
  const other = game.world.rooms[a].doors.some(d => d.to === b) ? 1 : 0;
  link(game.world.rooms, a + other, b + other, project.a, branch.kind);
  game.world.rooms[a + other].doors.sort((p, q) => p.to - q.to);
  game.world.rooms[b + other].doors.sort((p, q) => p.to - q.to);
  branch.passage = [a + other, b + other];
}
function applyCivicProject(game, project, branch) {
  const { site, first } = branch;
  if (project.key === 'waterside') {
    if (first === 'ferryman') {
      openParallelCrossing(game, project, branch);
      branch.terrainCleared = clearTerrain(game.world.rooms[site.room], 2, (x) => x < 9);
    } else {
      branch.terrainCleared = clearTerrain(game.world.rooms[site.room], 4, (x) => x < 9);
      game.hero.maxHp++; game.hero.hp++;
    }
  } else if (project.key === 'memory') {
    if (first === 'mason') {
      openParallelCrossing(game, project, branch);
      game.hero.power++;
    } else {
      branch.terrainCleared = clearTerrain(game.world.rooms[site.room], 5, (x) => x > 11);
      game.hero.maxHp += 2; game.hero.hp += 2;
    }
  } else if (project.key === 'orchard') {
    if (first === 'gardener') {
      branch.terrainCleared = clearTerrain(game.world.rooms[site.room], 5, (_, y) => y < 7);
      game.hero.maxHp++; game.hero.hp++;
    } else {
      branch.terrainCleared = clearTerrain(game.world.rooms[site.room], 5, (_, y) => y >= 7);
      game.hero.power++;
    }
  }
  game.events.push({ turn: game.turns, type: 'terrain', key: branch.key,
    site: structuredClone(site), cleared: [...branch.terrainCleared] });
  if (branch.passage) game.events.push({ turn: game.turns, type: 'passage',
    key: branch.key, between: [...branch.passage] });
}
/** The site is generated with the seed and appears when its associated civic pair is complete. */
export function activeCivicSites(game, roomId) {
  return game.branches.filter(b => b.site.room === roomId).map(b => ({
    key: b.key, name: b.name, kind: b.kind, x: b.site.x, y: b.site.y,
    used: game.usedSites.includes(b.key),
  }));
}
function activateCivicSite(game, site) {
  if (site.used) { message(game, `${site.name} is quiet. Its gift has already been received.`); return; }
  game.usedSites.push(site.key);
  const hero = game.hero;
  const messages = {
    canal: 'The canal water refreshes you. +2 HP.',
    spring: 'The reed spring restores your strength. +4 HP.',
    forge: 'The forge grants four empowered sword strikes.',
    archive: 'The memorial wards you against the next three blows.',
    grove: 'Roots of the living bell restore your strength. +4 HP.',
    resonator: 'The orchard bell grants four empowered sword strikes.',
  };
  if (['canal', 'spring', 'grove'].includes(site.kind)) {
    const bonus = site.kind === 'canal' ? 2 : 4;
    hero.hp = Math.min(hero.maxHp, hero.hp + bonus);
  }
  if (['forge', 'resonator'].includes(site.kind)) hero.focus += 4;
  if (site.kind === 'archive') hero.ward += 3;
  game.events.push({ turn: game.turns, type: 'site', key: site.key, kind: site.kind });
  message(game, messages[site.kind]);
}
function patrol(home, goal) {
  const [x0, y0] = home, [x1, y1] = goal;
  const path = [[x0, y0]];
  let x = x0, y = y0;
  while (x !== x1) { x += Math.sign(x1 - x); path.push([x, y]); }
  while (y !== y1) { y += Math.sign(y1 - y); path.push([x, y]); }
  path.push([x, y], [x, y], [x, y]);
  const backwards = path.slice(0, -1).reverse();
  return [...path, ...backwards];
}
/** Every returned villager has a deterministic schedule, altered by its shared civic project. */
export function townNpcs(game) {
  return game.world.souls.filter(soul => game.rescued.includes(soul.id)).map(soul => {
    const i = game.world.souls.findIndex(s => s.id === soul.id);
    const home = TOWN_HOMES[i];
    const project = CIVIC_PROJECTS.find(p => p.a === soul.id || p.b === soul.id);
    const branch = game.branches.find(b => b.key === project.key);
    const townCouncil = branch && (game.accord?.from === project.key ||
      (game.accord?.ratified && game.accord.to === project.key));
    const [px, py] = townCouncil ? [10, 6] : branch ? CIVIC_LOTS[project.key] : home;
    const goal = branch ? [px + (project.a === soul.id ? -1 : 1), py] :
      [Math.max(1, Math.min(WIDTH - 2, home[0] + 1)), home[1] + 1];
    const path = patrol(home, goal);
    const [x, y] = path[Math.floor((game.townTicks + i * 3) / 2) % path.length];
    return { id: soul.id, name: soul.name, title: soul.title, x, y,
      activity: branch ? branch.name : soul.site, branch: branch?.key || null };
  });
}
export function townDialogue(game, soulId) {
  const soul = getSoul(game.world, soulId);
  const project = CIVIC_PROJECTS.find(p => p.a === soulId || p.b === soulId);
  const branch = game.branches.find(b => b.key === project.key);
  if (!branch) return soul.line;
  if (game.accord?.ratified && game.accord.to === project.key && game.townTicks % 5 === 4)
    return `${game.charter.name}: ${game.charter.oath}`;
  if (game.accord && (game.accord.from === project.key || game.accord.to === project.key) &&
    game.townTicks % 4 === 3) return `${game.accord.name}: ${game.accord.dialogue}`;
  const partner = getSoul(game.world, project.a === soulId ? project.b : project.a);
  const variant = project.variants[branch.first];
  return (game.townTicks % 3 === 0) ? variant.dialogue :
    (game.townTicks % 3 === 1) ? `${partner.name} and I have work to do at ${branch.name}.` : soul.line;
}
export function epilogue(game) {
  if (game.branches.length !== 3) return null;
  const picked = Object.fromEntries(game.branches.map(b => [b.key, b.first]));
  const water = picked.waterside === 'ferryman' ? 'Canal' : 'Reed';
  const stone = picked.memory === 'mason' ? 'Iron' : 'Names';
  const tree = picked.orchard === 'gardener' ? 'Bloom' : 'Chime';
  const chapters = CIVIC_PROJECTS.map(p => p.variants[picked[p.key]].dialogue);
  const key = CIVIC_PROJECTS.map(p => picked[p.key] === p.a ? 'A' : 'B').join('');
  return { title: `The ${water} of ${stone} and ${tree}`,
    chapters: game.accord ? [...chapters, game.accord.dialogue] : chapters,
    key, accord: game.accord?.name || null,
    historyKey: `${key}/${game.accord?.order || 'none'}`,
    charter: game.charter?.stage === 'ratified' ? game.charter.name : null };
}
/** Validates the dynamic graph and the consistency of civic projects after an arbitrary rescue sequence. */
export function analyzeGame(game) {
  const problems = [...analyzeWorld(game.world).problems];
  const branches = new Set();
  const expectedCompletion = CIVIC_PROJECTS.filter(p => game.rescued.includes(p.a) &&
    game.rescued.includes(p.b)).sort((p,q) =>
    Math.max(game.rescued.indexOf(p.a),game.rescued.indexOf(p.b)) -
    Math.max(game.rescued.indexOf(q.a),game.rescued.indexOf(q.b)));
  if (expectedCompletion.map(p => p.key).join(',') !== game.branches.map(b => b.key).join(','))
    problems.push('Civic projects do not follow rescue chronology');
  for (const branch of game.branches) {
    const project = civicProject(branch.key);
    if (!project || branches.has(branch.key) || !game.rescued.includes(project.a) ||
        !game.rescued.includes(project.b) ||
        game.rescued.indexOf(branch.first) !== Math.min(game.rescued.indexOf(project.a),
          game.rescued.indexOf(project.b)) ||
        JSON.stringify(branch.site) !== JSON.stringify(game.world.civicSites[branch.key]))
      problems.push(`Invalid civic branch ${branch.key}`);
    branches.add(branch.key);
  }
  if (game.branches.length >= 2) {
    const order = `${game.branches[0].key}>${game.branches[1].key}`;
    if (game.accord?.order !== order || game.accord.name !== CIVIC_ACCORDS[order]?.name)
      problems.push(`Invalid founding accord ${order}`);
  } else if (game.accord) problems.push('Premature founding accord');
  if (game.accord) {
    if (!game.charter || game.charter.name !== CIVIC_ACCORDS[game.accord.order]?.charter ||
      JSON.stringify([game.charter.room,game.charter.x,game.charter.y]) !==
        JSON.stringify([game.world.charterSite.room,game.world.charterSite.x,
          game.world.charterSite.y]) ||
      !['seeking','carried','ratified'].includes(game.charter.stage) ||
      Boolean(game.accord.ratified) !== (game.charter.stage === 'ratified'))
      problems.push('Invalid council charter');
    if (game.charter?.stage === 'ratified') {
      if (game.events.filter(e=>e.type==='ratification').length !== 1 ||
        !game.charter.infrastructure) problems.push('Missing charter ratification evidence');
      if (game.charter.infrastructure?.kind === 'passage') {
        const [a,b] = game.charter.infrastructure.between;
        if (!game.world.rooms[a]?.doors.some(d=>d.to===b && d.origin==='charter') ||
            !game.world.rooms[b]?.doors.some(d=>d.to===a && d.origin==='charter'))
          problems.push('Charter passage not reciprocal');
      } else if (game.charter.infrastructure?.kind === 'terrain') {
        const detail = game.charter.infrastructure;
        if (!detail.cleared?.length || detail.cleared.some(k=>
          game.world.rooms[detail.room]?.obstacles.includes(k)))
          problems.push('Charter terrain not cleared');
      } else problems.push('Unknown charter infrastructure');
    }
  } else if (game.charter) problems.push('Premature charter');
  if (new Set(game.usedSites).size !== game.usedSites.length)
    problems.push('A civic shrine was consumed more than once');
  for (const key of game.usedSites) if (!branches.has(key)) problems.push(`Unrestored site used: ${key}`);
  return { valid: problems.length === 0, problems };
}

function tickEnemies(game) {
  const hero = game.hero, room = game.world.rooms[hero.room];
  const current = game.roomStates[hero.room];
  const occupied = new Set(current.enemies.map(e => xyKey(e.x, e.y)));
  for (const enemy of current.enemies) {
    if (game.status !== 'playing') return;
    if (game.turns % (enemy.kind === 'warden' ? 2 : 3) !== 0) continue;
    // Bellkeeper-first orchards interrupt the warden's combat cadence.
    if (enemy.kind === 'warden' && game.branches.some(b => b.key === 'orchard' &&
      b.first === 'bellkeeper') && game.turns % 4 === 0) continue;
    const dist = Math.abs(enemy.x - hero.x) + Math.abs(enemy.y - hero.y);
    if (dist === 1) {
      const protectedHit = hero.ward > 0;
      if (protectedHit) hero.ward--;
      else hero.hp -= enemy.damage;
      message(game, protectedHit ? 'A memorial ward absorbs the blow.' :
        `${enemy.kind === 'warden' ? 'The warden' : 'A shadow'} strikes. -${enemy.damage} HP`);
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
    game.townTicks++;
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
    const damage = power + (game.hero.focus > 0 ? 1 : 0);
    if (game.hero.focus > 0) game.hero.focus--;
    enemy.hp -= damage;
    message(game, `Torchblade strikes ${enemy.kind} for ${damage}.`);
    if (enemy.hp <= 0) {
      enemies.splice(enemies.indexOf(enemy), 1);
      game.kills++;
      message(game, `${enemy.kind === 'warden' ? 'The warden falls' : 'Shadow scattered'}.`);
    }
  } else message(game, 'The torchblade cuts through the air.');
}
function interact(game) {
  if (game.mode === 'town') {
    const actors = townNpcs(game).map(npc => ({ ...npc,
      distance: Math.abs(game.home.x - npc.x) + Math.abs(game.home.y - npc.y) }))
      .filter(npc => npc.distance <= 2).sort((a, b) => a.distance - b.distance);
    const nearestProject = game.branches.map(b => ({ branch: b, lot: CIVIC_LOTS[b.key],
      distance: Math.abs(game.home.x - CIVIC_LOTS[b.key][0]) +
        Math.abs(game.home.y - CIVIC_LOTS[b.key][1]) }))
      .filter(x => x.distance <= 1).sort((a, b) => a.distance - b.distance)[0];
    const councilNear = game.accord && Math.abs(game.home.x - 10) + Math.abs(game.home.y - 6) <= 1;
    if (councilNear && game.charter?.stage === 'carried') {
      ratifyCharter(game);
    } else if (councilNear && (!actors.length || actors[0].distance >= 1)) {
      message(game, `${game.accord.name}: ${game.accord.dialogue} (${game.accord.gift})`);
    } else if (nearestProject && (!actors.length || nearestProject.distance < actors[0].distance)) {
      message(game, `${nearestProject.branch.name}. ${nearestProject.branch.effect}`);
    } else if (actors.length) {
      const soul = getSoul(game.world, actors[0].id);
      message(game, `${soul.name}: “${townDialogue(game, soul.id)}”`);
      if (soul.id === 'herbalist') {
        game.hero.hp = game.hero.maxHp;
        message(game, `${soul.name} tends your wounds.`);
      }
    } else message(game, 'Only the wind answers.');
    game.townTicks++;
    return;
  }
  const hero = game.hero, room = game.world.rooms[hero.room], current = game.roomStates[hero.room];
  const charter = activeCharterSite(game, hero.room);
  if (charter && Math.abs(hero.x - charter.x) + Math.abs(hero.y - charter.y) <= 1) {
    if (current.enemies.length) {
      message(game, 'The charter is bound by the remaining shadows.');
    } else {
      game.charter.stage = 'carried';
      game.events.push({type:'charter', stage:'carried', turn:game.turns,
        name: charter.name, room: charter.room });
      message(game, `${charter.name} recovered. Return it to the village council.`);
    }
    return;
  }
  const site = activeCivicSites(game, hero.room).find(s =>
    Math.abs(hero.x - s.x) + Math.abs(hero.y - s.y) <= 1);
  if (site) { activateCivicSite(game, site); return; }
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
    game.finalScore = Math.max(0, 1500 - game.turns - 40 * game.rests +
      (game.charter?.stage === 'ratified' ? 150 : 0));
    const ending = epilogue(game);
    game.epilogue = ending;
    game.events.push({ type: 'victory', turn: game.turns, score: game.finalScore,
      ending: ending?.title, endingKey: ending?.key, historyKey: ending?.historyKey });
    message(game, `The last bell rings. ${ending?.title || 'The drowned village lives again.'}`);
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
        game.townTicks += 8;
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
  // v2 action histories can be replayed into v3 because the new charter is
  // optional and the original dungeon topology is generated unchanged.
  if (![2, VERSION].includes(saved.version) || typeof saved.seed !== 'string' ||
    !Array.isArray(saved.history) || saved.history.length > 100000) {
    throw new Error('Invalid or incompatible save');
  }
  return replay(saved.seed, saved.history);
}
