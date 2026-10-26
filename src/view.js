import { newGame, dispatch, serialize, deserialize, isBlocked,
  activeCivicSites, townNpcs, epilogue, WIDTH, HEIGHT } from './core.js';
import { CIVIC_PROJECTS, CIVIC_LOTS, TOWN_HOMES } from './civic.js';

const el = id => document.getElementById(id);
const canvas = el('screen'), ctx = canvas.getContext('2d');
const mini = el('minimap'), mc = mini.getContext('2d');
const SIZE = 32;
const glyphs = ['≈', '✿', '▥', '◈', '♣', '♫'];

const floors = [
  { base: '#30453d', tile: '#3b5447', dark: '#1e3531', edge: '#59755b', accent: '#96be89' },
  { base: '#3d4441', tile: '#51574b', dark: '#2b3434', edge: '#697260', accent: '#d9c48d' },
  { base: '#352c41', tile: '#47394d', dark: '#282533', edge: '#605268', accent: '#c09cb6' },
];
const params = new URLSearchParams(location.search);
let game = newGame(params.get('seed') || el('seed').value);
el('seed').value = game.seed;
let frames = 0;
ctx.imageSmoothingEnabled = false;
mc.imageSmoothingEnabled = false;

function rect(x, y, w, h, color) {
  ctx.fillStyle = color; ctx.fillRect(Math.floor(x), Math.floor(y), Math.ceil(w), Math.ceil(h));
}
function text(x, y, value, color = '#f9e7ba', size = 12, align = 'left') {
  ctx.fillStyle = color;
  ctx.font = `bold ${size}px monospace`;
  ctx.textAlign = align;
  ctx.fillText(value, x, y);
}
function tint(id, x, y) { return ((id + 1) * 103 + x * 37 + y * 71) % 19; }
function groundTile(room, x, y, palette) {
  rect(x * SIZE, y * SIZE, SIZE, SIZE, tint(room.id, x, y) < 5 ? palette.tile : palette.base);
  if (tint(room.id, y, x) < 3) {
    rect(x * SIZE + 8, y * SIZE + 13, 2, 2, palette.edge);
    rect(x * SIZE + 16, y * SIZE + 23, 3, 2, palette.edge);
  }
}
function rock(x, y, palette) {
  const px = x * SIZE, py = y * SIZE;
  rect(px + 4, py + 8, 24, 20, '#18292b');
  rect(px + 7, py + 4, 20, 18, palette.edge);
  rect(px + 7, py + 6, 13, 8, palette.tile);
  rect(px + 19, py + 15, 8, 9, palette.dark);
  rect(px + 10, py + 5, 4, 3, '#9ca58a');
}
function drawDoor(room, door, palette) {
  const positions = { left: [0, 6], right: [WIDTH - 1, 6], up: [10, 0], down: [10, HEIGHT - 1] };
  const [x, y] = positions[door.dir];
  rect(x * SIZE, y * SIZE, SIZE, SIZE, door.needs && !game.rescued.includes(door.needs) ? '#a77e44' : '#0d2023');
  const side = door.dir === 'left' || door.dir === 'right';
  if (side) {
    rect(x * SIZE, y * SIZE, 32, 7, palette.edge);
    rect(x * SIZE, y * SIZE + 25, 32, 7, palette.edge);
  } else {
    rect(x * SIZE, y * SIZE, 7, 32, palette.edge);
    rect(x * SIZE + 25, y * SIZE, 7, 32, palette.edge);
  }
  if (door.needs && !game.rescued.includes(door.needs)) {
    text(x * SIZE + 16, y * SIZE + 22, '◆', '#fbd392', 17, 'center');
  } else if (door.origin) {
    const color = door.origin === 'canal' ? '#8fd1dd' : '#f0bd7c';
    text(x * SIZE + 16, y * SIZE + 22, '✦', color, 17, 'center');
  }
}
function drawLair(room, status, palette) {
  const x = 10 * SIZE + 16, y = 4 * SIZE + 16;
  ctx.lineWidth = 4;
  ctx.strokeStyle = status.settled ? '#61746b' : palette.accent;
  ctx.beginPath(); ctx.arc(x, y, 12 + (status.settled ? 0 : Math.sin(frames / 18) * 1.4), 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2);
  ctx.fillStyle = status.settled ? '#263f3e' : room.soulId ? '#fad187' : '#82afb8'; ctx.fill();
  if (!status.settled) {
    rect(x - 2, y - 19, 4, 4, '#f6e9a8');
    text(x, y + 31, room.soulId ? 'SOUL LAIR' : 'SEALED LAIR', '#ede2bb', 8, 'center');
  }
}
function drawCivicSite(site) {
  const px = site.x * SIZE, py = site.y * SIZE;
  const palette = {
    canal: ['#4b8796', '#c3e8da', '≈'],
    spring: ['#5da58a', '#e8f1bb', '✿'],
    forge: ['#bd7248', '#ffe0a0', '✦'],
    archive: ['#8372ae', '#e4d6fa', '◈'],
    grove: ['#5a9b6b', '#d9e8a5', '♣'],
    resonator: ['#c9a55c', '#fae4a5', '♫'],
  }[site.kind];
  rect(px + 3, py + 3, 26, 26, '#132c31');
  rect(px + 5, py + 5, 22, 22, site.used ? '#4f6564' : palette[0]);
  rect(px + 8, py + 8, 16, 16, '#273d44');
  text(px + 16, py + 23, palette[2], site.used ? '#91a2a0' : palette[1], 17, 'center');
  if (!site.used && Math.floor(frames / 20) % 2 === 0) {
    rect(px + 1, py + 14, 3, 4, palette[1]);
    rect(px + 28, py + 14, 3, 4, palette[1]);
  }
}
function drawCivicLot(branch) {
  const [cx, cy] = CIVIC_LOTS[branch.key];
  const px = cx * SIZE, py = cy * SIZE;
  const color = branch.kind === 'canal' ? '#6cabbc' : branch.kind === 'spring' ? '#a6c28a' :
    branch.kind === 'forge' ? '#dd9561' : branch.kind === 'archive' ? '#a99bcb' :
      branch.kind === 'grove' ? '#8cbb76' : '#e3c780';
  rect(px - 25, py - 22, 80, 78, '#334b4b');
  rect(px - 21, py - 18, 72, 70, color);
  rect(px - 14, py - 11, 58, 56, '#274446');
  const glyph = {canal:'≈',spring:'✿',forge:'▥',archive:'◈',grove:'♣',resonator:'♫'}[branch.kind];
  text(px + 15, py + 26, glyph, color, 30, 'center');
  text(px + 16, py + 45, branch.name.toUpperCase(), '#faedcf', 7, 'center');
}
function drawVillager(npc) {
  const px = npc.x * SIZE, py = npc.y * SIZE;
  rect(px + 8, py + 18, 16, 13, '#233b3b');
  rect(px + 11, py + 14, 10, 13, '#89ba9e');
  rect(px + 12, py + 7, 8, 9, '#f4bc8e');
  rect(px + 11, py + 5, 10, 5, '#65505b');
  text(px + 16, py + 5, npc.name.toUpperCase(), '#ffecc6', 9, 'center');
}
function drawEnemy(enemy) {
  const px = enemy.x * SIZE, py = enemy.y * SIZE;
  if (enemy.kind === 'warden') {
    rect(px + 4, py + 7, 24, 23, '#111b23');
    rect(px + 7, py + 2, 18, 20, '#a06471');
    rect(px + 9, py + 9, 5, 4, '#ffd59f'); rect(px + 19, py + 9, 5, 4, '#ffd59f');
    rect(px + 2, py + 20, 28, 8, '#704557');
    rect(px + 2, py, 28 * (enemy.hp / 5), 3, '#e3aa64');
  } else {
    const ink = enemy.kind === 'moss' ? '#87b48b' : enemy.kind === 'wisp' ? '#8cacc3' : '#ad88b8';
    rect(px + 4, py + 16, 24, 12, '#1c2830');
    rect(px + 7, py + 8, 18, 17, ink);
    rect(px + 10, py + 14, 4, 4, '#12272b');rect(px + 19, py + 14, 4, 4, '#12272b');
    rect(px + 8, py + 6, 10, 4, '#d1d5ae');
    if (enemy.hp > 1) rect(px + 5, py + 3, 22, 2, '#d8a586');
  }
}
function drawHero(x, y, face, wobble = true) {
  const px = x * SIZE, py = y * SIZE + (wobble ? Math.round(Math.sin(frames / 13) * 1.2) : 0);
  ctx.fillStyle = '#efd293';
  ctx.globalAlpha = .09 + .05 * Math.sin(frames / 20);
  ctx.beginPath();ctx.arc(px + 16, py + 16, 40, 0, Math.PI * 2);ctx.fill();ctx.globalAlpha = 1;
  rect(px + 5, py + 10, 22, 20, '#131f2b');
  rect(px + 8, py + 12, 16, 16, '#77afaa');
  rect(px + 10, py + 5, 12, 13, '#efcd9e');
  rect(px + 9, py + 4, 15, 5, '#e4e1bc');
  rect(px + 9, py + 25, 6, 5, '#243338');rect(px + 19, py + 25, 6, 5, '#243338');
  const facing = { up: [16, 5], right: [26, 16], down: [16, 25], left: [5, 16] }[face];
  rect(px + facing[0] - 2, py + facing[1] - 2, 4, 4, '#f9f0cc');
  rect(px + 25, py + 2, 4, 19, '#ffcf7f');
  rect(px + 25, py + 1, 4, 6, '#f9f0c7');
}
function drawDungeon() {
  const room = game.world.rooms[game.hero.room];
  const palette = floors[room.sector];
  for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
    if (isBlocked(room, x, y) && (x === 0 || x === WIDTH - 1 || y === 0 || y === HEIGHT - 1)) {
      rect(x * SIZE, y * SIZE, SIZE, SIZE, '#12292d');
      rect(x * SIZE + 3, y * SIZE + 3, 25, 25, '#314a49');
      rect(x * SIZE + 3, y * SIZE + 3, 25, 5, palette.edge);
    } else groundTile(room, x, y, palette);
  }
  for (const key of room.obstacles) {
    const [x, y] = key.split(',').map(Number); rock(x, y, palette);
  }
  for (const door of room.doors) drawDoor(room, door, palette);
  for (const site of activeCivicSites(game, room.id)) drawCivicSite(site);
  drawLair(room, game.roomStates[room.id], palette);
  for (const enemy of game.roomStates[room.id].enemies) drawEnemy(enemy);
  drawHero(game.hero.x, game.hero.y, game.hero.face);
  text(13, 20, ['THE LOWLANDS', 'THE OLD QUARRY', 'THE SUNKEN CRYPT'][room.sector], '#f1e4bd', 11);
  if (room.boss && game.roomStates[room.id].enemies.some(e => e.kind === 'warden')) {
    text(WIDTH * SIZE - 12, 20, 'THE WARDEN', '#e5a2a5', 11, 'right');
  }
}
function drawTown() {
  const restored = game.rescued.length;
  for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
    const bright = (x * 31 + y * 17 + restored) % 11 < 3;
    rect(x * SIZE, y * SIZE, SIZE, SIZE, bright ? '#425c4c' : '#354e43');
    if ((x * 17 + y * 43) % 13 === 0) rect(x * SIZE + 14, y * SIZE + 21, 3, 3, '#859a71');
  }
  // Rescue order can turn the village center into a canal market or spring sanctuary.
  const water = game.branches.find(b => b.key === 'waterside');
  if (water?.first === 'ferryman') {
    for (let x = 0; x < WIDTH; x++) {
      rect(x * SIZE, 5 * SIZE + 4, SIZE, 16, '#548c91');
      if (x % 2 === 0) rect(x * SIZE + 9, 5 * SIZE + 8, 11, 3, '#9bc1ba');
    }
  }
  if (water?.first === 'herbalist') {
    for (let x = 1; x < WIDTH; x += 2) {
      rect(x * SIZE + 4, 7 * SIZE + 8, 15, 7, '#8eb582');
      rect(x * SIZE + 10, 7 * SIZE + 4, 5, 5, '#e2cc8a');
    }
  }
  for (let x = 0; x < WIDTH; x++) rect(x * SIZE, 6 * SIZE + 6, SIZE, 20, '#637365');
  for (let y = 0; y < HEIGHT; y++) rect(10 * SIZE + 8, y * SIZE, 15, SIZE, '#637365');
  rect(9 * SIZE + 11, 6 * SIZE - 2, 58, 44, '#253b43');
  rect(9 * SIZE + 17, 6 * SIZE + 5, 44, 30, restored ? '#72a5a5' : '#425d65');
  if (game.accord) {
    const tint = game.accord.from === 'waterside' ? '#83bdc2' :
      game.accord.from === 'memory' ? '#e1ab82' : '#a4cc90';
    rect(10 * SIZE - 41, 6 * SIZE - 18, 83, 69, '#152d32');
    rect(10 * SIZE - 35, 6 * SIZE - 11, 71, 55, tint);
    rect(10 * SIZE - 30, 6 * SIZE - 4, 61, 40, '#355553');
    text(10 * SIZE, 6 * SIZE + 17, '✣', tint, 25, 'center');
    text(10 * SIZE, 6 * SIZE + 31, 'COUNCIL', '#ffedd2', 9, 'center');
  }
  for (let i = 0; i < TOWN_HOMES.length; i++) {
    const [x, y] = TOWN_HOMES[i],
      free = game.rescued.includes(game.world.souls[i].id);
    const cx = x * SIZE + 16, cy = y * SIZE + 16;
    const left = cx - 38, top = cy - 28;
    rect(left, top + 12, 76, 44, free ? '#a2a07d' : '#586059');
    rect(left + 6, top + 12, 64, 8, free ? '#d1bb83' : '#64726a');
    rect(left - 4, top + 1, 84, 19, free ? '#8f6b5d' : '#4b5956');
    rect(left + 9, top + 29, 13, 12, free ? '#e6cf8b' : '#425250');
    rect(left + 43, top + 29, 13, 12, free ? '#e6cf8b' : '#425250');
    rect(left + 29, top + 37, 18, 19, '#263a3b');
    text(cx, cy - 10, free ? glyphs[i] : '·', free ? '#ffe0a1' : '#9ba399', 16, 'center');
    text(cx, top + 70, free ? game.world.souls[i].title.toUpperCase() : 'FORGOTTEN',
      free ? '#f9e0b3' : '#91a096', 10, 'center');

  }
  for (const branch of game.branches) drawCivicLot(branch);
  for (const npc of townNpcs(game)) drawVillager(npc);
  drawHero(game.home.x, game.home.y, 'up', false);
  text(13, 20, game.world.settlement.toUpperCase(), '#fff0c4', 12);
  text(13, HEIGHT * SIZE - 11, `${restored} RESTORED / 6`, '#ffe3b9', 12);
}
function minimap() {
  mc.clearRect(0, 0, mini.width, mini.height);
  mc.fillStyle = '#102126';mc.fillRect(0, 0, mini.width, mini.height);
  const box = 32, ox = 73, oy = 9, gapX = 64, gapY = 37;
  for (const room of game.world.rooms) {
    const cx = ox + room.x * gapX + box / 2, cy = oy + room.y * gapY + box / 2;
    for (const door of room.doors) {
      if (door.to < room.id) continue;
      const target = game.world.rooms[door.to];
      const tx = ox + target.x * gapX + box / 2, ty = oy + target.y * gapY + box / 2;
      mc.beginPath(); mc.moveTo(cx, cy);mc.lineTo(tx, ty);
      mc.lineWidth = 6;
      mc.strokeStyle = door.needs && !game.rescued.includes(door.needs) ? '#b28b51' :
        door.origin === 'canal' ? '#7fcce2' : door.origin === 'forge' ? '#eeb87b' : '#577b68';
      mc.stroke();
    }
  }
  for (const room of game.world.rooms) {
    const x = ox + room.x * gapX, y = oy + room.y * gapY;
    const explored = game.visited.includes(room.id);
    mc.fillStyle = explored ? (room.sector === 0 ? '#668a70' : room.sector === 1 ? '#888d75' : '#766c8c') : '#25383b';
    mc.fillRect(x, y, box, box);
    mc.strokeStyle = game.hero.room === room.id && game.mode === 'dungeon' ? '#f9e3a5' : '#34484a';
    mc.lineWidth = 3;mc.strokeRect(x + 1, y + 1, box - 2, box - 2);
    mc.fillStyle = explored ? '#f9f1d6' : '#556866';
    mc.font = '12px monospace';mc.textAlign = 'center';mc.fillText(`${room.id + 1}`, x + 16, y + 21);
    if (explored && room.soulId && !game.rescued.includes(room.soulId)) {
      mc.fillStyle = '#f4d192';mc.fillRect(x + 24, y + 3, 5, 5);
    }
    if (room.soulId && game.rescued.includes(room.soulId)) {
      mc.fillStyle = '#d2f7ab'; mc.fillRect(x + 23, y + 3, 6, 6);
    }
  }
}
function updatePanel() {
  const room = game.world.rooms[game.hero.room];
  el('location').textContent = game.mode === 'town' ? 'THE DROWNED VILLAGE / SANCTUARY' :
    `CHAMBER ${String(room.id + 1).padStart(2, '0')} / ${['LOWLANDS', 'OLD QUARRY', 'SUNKEN CRYPT'][room.sector]}`;
  el('state-indicator').textContent = game.status === 'won' ? `RESTORED · ${game.finalScore} PTS` :
    game.status === 'lost' ? 'THE TORCH IS OUT' : game.mode === 'town' ? 'SANCTUARY' : 'TORCH LIT';
  el('health').textContent = '♥'.repeat(game.hero.hp) + '♡'.repeat(game.hero.maxHp - game.hero.hp);
  el('stats').textContent = `TURN ${game.turns} · SHADOWS ${game.kills} · RESTS ${game.rests}` +
    (game.hero.focus ? ` · FOCUS ${game.hero.focus}` : '') +
    (game.hero.ward ? ` · WARD ${game.hero.ward}` : '');
  el('soul-counter').textContent = `${game.rescued.length} / 6`;
  el('soul-list').innerHTML = game.world.souls.map((soul, i) => {
    const free = game.rescued.includes(soul.id);
    const order = game.rescued.indexOf(soul.id);
    return `<div class="soul ${free ? 'free' : ''}"><span class="symbol">${free ? order + 1 : glyphs[i]}</span><span><strong>${free ? soul.name + ' · ' + soul.title : 'Unknown soul · ' + soul.title}</strong><small>${free ? 'Rescue #' + (order + 1) + ' · ' + soul.site : 'Awaiting release'}</small></span></div>`;
  }).join('');
  el('branches').innerHTML = (game.branches.length ?
    `<div class="branch-title">RESTORATION CONSEQUENCES</div>` + game.branches.map(b => {
      const project = CIVIC_PROJECTS.find(p => p.key === b.key);
      const second = b.first === project.a ? project.b : project.a;
      const route = b.passage ? `New route: chambers ${b.passage[0] + 1} ↔ ${b.passage[1] + 1}.` :
        `${b.terrainCleared.length} stones cleared in chamber ${b.site.room + 1}.`;
      const used = game.usedSites.includes(b.key);
      return `<div class="branch-item"><b>✧ ${b.name}</b><small>${b.first} → ${second}</small>` +
        `<small>${route} ${used ? 'Shrine visited.' : 'Discover its dungeon shrine.'}</small></div>`;
    }).join('') : '') + (game.accord ?
    `<div class="accord-banner"><b>FOUNDING ACCORD · ${game.accord.name}</b>` +
    `<small>${game.accord.firstProject} → ${game.accord.secondProject}</small>` +
    `<small>${game.accord.gift} · Council activity established</small></div>` : '');
  el('chronicle').innerHTML = game.events.filter(e => ['restoration','branch','site','passage','accord'].includes(e.type))
    .slice(-8).reverse().map(e => {
      if (e.type === 'restoration') return `<p>✧ ${e.name} restored ${e.site}.</p>`;
      if (e.type === 'branch') return `<p>◈ ${e.name} emerged through rescue order.</p>`;
      if (e.type === 'accord') return `<p>✣ ${e.name}: ${e.gift}.</p>`;
      if (e.type === 'passage') return `<p>↔ New passage: chambers ${e.between[0]+1} and ${e.between[1]+1}.</p>`;
      return `<p>✦ ${e.kind} shrine awakened.</p>`;
    }).join('') || '<p>Every released soul writes a new chapter.</p>';
  el('journal').innerHTML = game.log.map(line => `<p>${line.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')}</p>`).join('');
  minimap();
}
function action(a) {
  if (a.type === 'rest' && game.mode !== 'town') { showTemporary('Rest in the village (T).'); return; }
  try {
    game = dispatch(game, a);
    updatePanel();
    if (game.status !== 'playing') showTemporary(game.status === 'won' ? 'WORLD RESTORED · IGNITE A NEW SEED' : 'THE TORCH IS OUT · IGNITE A NEW SEED');
  } catch (err) { showTemporary(err.message); }
}
let temporaryUntil = 0, temporaryText = '';
function showTemporary(txt) { temporaryText = txt; temporaryUntil = frames + 130; }
function draw() {
  frames++;
  if (game.mode === 'town') drawTown(); else drawDungeon();
  if (frames < temporaryUntil) {
    rect(0, canvas.height - 34, canvas.width, 34, '#192a2d');
    text(canvas.width / 2, canvas.height - 13, temporaryText, '#f7d593', 13, 'center');
  }
  if (game.status !== 'playing') {
    rect(90, 132, 460, 136, '#10252be8');
    ctx.strokeStyle = '#d9b876';ctx.lineWidth = 3;ctx.strokeRect(90, 132, 460, 136);
    const ending = game.epilogue || epilogue(game);
    text(320, 179, game.status === 'won' ? (ending?.title || 'THE WORLD RETURNS').toUpperCase() :
      'THE TORCH IS DARK', '#fae0a2', ending ? 15 : 21, 'center');
    text(320, 213, game.status === 'won' ? `SCORE ${game.finalScore} · ${game.turns} TURNS` : 'YOUR STORY ENDS HERE', '#cce2c5', 13, 'center');
    text(320, 244, game.status === 'won' ? `FOUNDING ACCORD: ${ending?.accord || 'THE RETURNED'}` :
      'ENTER A NEW SEED AND IGNITE AGAIN', '#98bdac', 11, 'center');
  }
  requestAnimationFrame(draw);
}
const keymap = {
  ArrowUp: { type: 'move', direction: 'up' }, w: { type: 'move', direction: 'up' },
  ArrowRight: { type: 'move', direction: 'right' }, d: { type: 'move', direction: 'right' },
  ArrowDown: { type: 'move', direction: 'down' }, s: { type: 'move', direction: 'down' },
  ArrowLeft: { type: 'move', direction: 'left' }, a: { type: 'move', direction: 'left' },
  ' ': { type: 'attack' }, e: { type: 'interact' }, t: { type: 'toggleTown' },
  r: { type: 'rest' }, '.': { type: 'wait' },
};
document.addEventListener('keydown', ev => {
  if (ev.target instanceof HTMLInputElement) return;
  const mapped = keymap[ev.key] || keymap[ev.key.toLowerCase()];
  if (mapped) { ev.preventDefault(); if (!ev.repeat) action(mapped); }
});
document.querySelectorAll('[data-action]').forEach(b => b.addEventListener('click', () =>
  action({ type: b.dataset.action, ...(b.dataset.direction ? { direction: b.dataset.direction } : {}) })));
function ignite() {
  game = newGame(el('seed').value.trim() || '104729');
  el('seed').value = game.seed;
  const url = new URL(location.href);url.searchParams.set('seed', game.seed);history.replaceState({}, '', url);
  updatePanel();
}
el('new-game').addEventListener('click', ignite);
el('seed').addEventListener('keydown', event => { if (event.key === 'Enter') ignite(); });
el('save').addEventListener('click', () => {
  try { localStorage.setItem('soul-torch-v2', serialize(game));showTemporary('RUN SAVED IN THIS BROWSER'); }
  catch { showTemporary('BROWSER STORAGE UNAVAILABLE'); }
});
el('load').addEventListener('click', () => {
  try {
    const data = localStorage.getItem('soul-torch-v2');
    if (!data) { showTemporary('NO SAVED RUN FOUND');return; }
    game = deserialize(data);el('seed').value = game.seed;updatePanel();showTemporary('RUN RESTORED');
  } catch { showTemporary('COULD NOT RESTORE SAVE'); }
});
updatePanel();requestAnimationFrame(draw);
