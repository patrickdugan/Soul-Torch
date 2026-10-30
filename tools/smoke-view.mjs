/** Dependency-free browser-adapter smoke check with a deterministic canvas stub. */
import assert from 'node:assert/strict';
import { newGame, dispatch, serialize } from '../src/core.js';
import { botAction } from './autoplayer.mjs';

const context = new Proxy({}, {
  get(target, name) { return target[name] ?? (() => {}); },
  set(target, name, value) { target[name] = value; return true; },
});
const elements = new Map();
for (const id of ['screen','minimap','seed','location','state-indicator','health','stats',
  'soul-counter','soul-list','branches','chronicle','journal','new-game','save','load']) {
  elements.set(id, {
    id, value:id==='seed'?'104729':'', textContent:'', innerHTML:'', width:id==='screen'?640:240,
    height:id==='screen'?416:236, listeners:{}, getContext(){return context;},
    addEventListener(event,handler){this.listeners[event]=handler;},
  });
}
const keyListeners = {};
const storage = new Map();
globalThis.HTMLInputElement = class HTMLInputElement {};
globalThis.document = {
  getElementById(id) { return elements.get(id); },
  addEventListener(event,handler){keyListeners[event]=handler;},
  querySelectorAll(){return [];},
};
globalThis.localStorage = {getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)};
globalThis.location = {search:'',href:'http://127.0.0.1/'};
globalThis.history = {replaceState(){}};
let queuedFrame;
globalThis.requestAnimationFrame = callback => {queuedFrame=callback;};
await import('../src/view.js');
assert.ok(queuedFrame, 'UI schedules rendering');
queuedFrame();
assert.ok(elements.get('journal').innerHTML.includes('village waits'));
// Create a legitimate two-soul run with the reference player, then use the
// actual UI load button to exercise branching panels and the settlement canvas.
let game = newGame('smoke-branches');
const priority = ['herbalist','ferryman','archivist','mason','gardener','bellkeeper'];
for (let i=0; i<10000 && game.branches.length===0 && game.status==='playing'; i++) {
  game = dispatch(game,botAction(game,priority));
}
assert.equal(game.branches.length,1);
assert.equal(game.branches[0].name,'Reed Sanctuary');
storage.set('soul-torch-v3',serialize(game));
elements.get('load').listeners.click();
assert.ok(elements.get('branches').innerHTML.includes('Reed Sanctuary'));
assert.ok(elements.get('chronicle').innerHTML.includes('restored'));
const event = key=>({key,repeat:false,target:{},preventDefault(){}});
keyListeners.keydown(event('t'));
queuedFrame(); // town mode exercises dynamic civic lot and moving NPC rendering
keyListeners.keydown(event('d'));
queuedFrame();
assert.ok(elements.get('state-indicator').textContent.includes('SANCTUARY'));
// Continue that legitimate run until a second project establishes the council.
for (let i=0; i<10000 && !game.accord && game.status==='playing'; i++) {
  game = dispatch(game,botAction(game,priority));
}
assert.ok(game.accord);
storage.set('soul-torch-v3',serialize(game));
elements.get('load').listeners.click();
assert.ok(elements.get('branches').innerHTML.includes('FOUNDING ACCORD'));
assert.ok(elements.get('chronicle').innerHTML.includes(game.accord.name));
assert.ok(elements.get('branches').innerHTML.includes(game.charter.name));
assert.ok(elements.get('branches').innerHTML.includes(`chamber ${game.charter.room+1}`));
keyListeners.keydown(event('t'));
queuedFrame();
console.log(JSON.stringify({rendered:true,branch:game.branches[0].name,accord:game.accord.name,
  journalEntries:game.log.length,uiAssets:'canvas stubs, no external dependencies'}));
