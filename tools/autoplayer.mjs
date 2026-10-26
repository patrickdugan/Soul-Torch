/** A reference agent for end-to-end gameplay smoke tests, not an optimal player. */
import { newGame, dispatch, isBlocked, WIDTH, HEIGHT } from '../src/core.js';

const DIRS = [ ['up', 0, -1], ['right', 1, 0], ['down', 0, 1], ['left', -1, 0] ];
const key = (x, y) => `${x},${y}`;
const opposite = {up:'down',down:'up',left:'right',right:'left'};
function pathTo(room, start, predicate, enemies = []) {
  const blocked = new Set(enemies.map(e => key(e.x, e.y)));
  const queue = [start], parent = new Map([[key(start.x, start.y), null]]);
  for (let i = 0; i < queue.length; i++) {
    const pos = queue[i];
    if (predicate(pos.x, pos.y)) {
      const commands = [];
      let curr = key(pos.x, pos.y);
      while (parent.get(curr)) {
        const item = parent.get(curr);
        commands.unshift(item.dir);
        curr = item.from;
      }
      return commands;
    }
    for (const [dir, dx, dy] of DIRS) {
      const x = pos.x + dx, y = pos.y + dy, k = key(x, y);
      if (isBlocked(room, x, y) || blocked.has(k) || parent.has(k)) continue;
      parent.set(k, { from: key(pos.x, pos.y), dir }); queue.push({ x, y });
    }
  }
  return null;
}
function inFront(hero, enemy) {
  const d = DIRS.find(([dir]) => dir === hero.face);
  return enemy.x === hero.x + d[1] && enemy.y === hero.y + d[2];
}
function routeRooms(game, start, goal) {
  const queue = [[start, []]], seen = new Set([start]);
  while (queue.length) {
    const [id, path] = queue.shift();
    if (goal(id)) return path;
    for (const door of game.world.rooms[id].doors) {
      if (seen.has(door.to) || (door.needs && !game.rescued.includes(door.needs))) continue;
      seen.add(door.to); queue.push([door.to, [...path, door]]);
    }
  }
  return null;
}
function approach(game, predicate, enemies = []) {
  const hero = game.hero, room = game.world.rooms[hero.room];
  return pathTo(room, hero, predicate, enemies);
}
function followDoor(game, door) {
  const hero = game.hero;
  const destination = door.dir === 'up' ? [10,0] : door.dir === 'down' ? [10,HEIGHT - 1] :
    door.dir === 'left' ? [0,6] : [WIDTH - 1,6];
  if (hero.x === destination[0] && hero.y === destination[1]) return {type:'move', direction:door.dir};
  const path = approach(game, (x,y) => x === destination[0] && y === destination[1]);
  return path?.length ? {type:'move',direction:path[0]} : {type:'wait'};
}
/** Optional priority controls which captive to free first, without bypassing simulation rules. */
export function botAction(game, priority = null) {
  if (game.mode === 'town') return game.hero.hp < game.hero.maxHp ? {type:'rest'} : {type:'toggleTown'};
  if (game.hero.hp <= 3 && game.hero.maxHp > 3) return {type:'toggleTown'};
  const hero = game.hero, room = game.world.rooms[hero.room], state = game.roomStates[hero.room];
  if (state.enemies.length) {
    const touching = state.enemies.find(e => Math.abs(hero.x - e.x) + Math.abs(hero.y - e.y) === 1);
    if (touching) {
      if (inFront(hero, touching)) return {type:'attack'};
      const d = DIRS.find(([, dx, dy]) => hero.x + dx === touching.x && hero.y + dy === touching.y);
      return {type:'move',direction:d[0]}; // rotate while blocked by enemy
    }
    const path = approach(game, (x, y) => state.enemies.some(e =>
      Math.abs(x - e.x) + Math.abs(y - e.y) === 1), state.enemies);
    if (path?.length) return {type:'move', direction:path[0]};
    return {type:'wait'};
  }
  // Travel through cleared or uncleared rooms to honor a requested rescue order.
  // Enemies are defeated en route, but a non-target lair can remain sealed.
  const target = priority?.find(soul => !game.rescued.includes(soul) &&
    routeRooms(game, hero.room, id => game.world.rooms[id].soulId === soul) !== null);
  if (target && room.soulId !== target) {
    const toTarget = routeRooms(game, hero.room, id => game.world.rooms[id].soulId === target);
    if (toTarget?.length) return followDoor(game, toTarget[0]);
  }
  if (!state.settled) {
    const near = Math.abs(hero.x - 10) + Math.abs(hero.y - 4) <= 2;
    if (near) return {type:'interact'};
    const path = approach(game, (x,y) => Math.abs(x - 10) + Math.abs(y - 4) <= 2);
    return path?.length ? {type:'move', direction:path[0]} : {type:'wait'};
  }
  const route = routeRooms(game, hero.room, id => !game.roomStates[id].settled);
  if (!route || route.length === 0) return {type:'wait'};
  return followDoor(game, route[0]);
}
export function playSeed(seed, limit = 15000, priority = null) {
  let game = newGame(seed);
  for (let i = 0; i < limit && game.status === 'playing'; i++) {
    const next = botAction(game, priority);
    game = dispatch(game, next);
  }
  return { seed, status: game.status, turns: game.turns, kills: game.kills,
    rests: game.rests, rooms: game.roomStates.filter(s=>s.settled).length,
    rescued: game.rescued.length, score: game.finalScore,
    actions: game.history.length, lastLog: game.log[0],
    ending: game.epilogue?.key, historyKey: game.epilogue?.historyKey,
    accord: game.accord?.order, branches: game.branches.map(b=>[b.key,b.first]) };
}
const invoked = process.argv[1]?.endsWith('autoplayer.mjs');
if (invoked) {
  const batches = Number(process.argv[2] || 10);
  if (!Number.isInteger(batches) || batches < 1 || batches > 10000) throw new Error('Count must be in [1,10000]');
  const results = [];
  for (let i=0;i<batches;i++) results.push(playSeed(`autoplay-${i}`));
  const failures = results.filter(r => r.status !== 'won');
  console.log(JSON.stringify({ count: batches, won: batches - failures.length,
    winRate: (batches - failures.length) / batches,
    meanTurns: Math.round(results.reduce((n,r)=>n+r.turns,0)/batches),
    failures: failures.slice(0, 10), example: results[0] },null,2));
  if (failures.length) process.exitCode = 1;
}
