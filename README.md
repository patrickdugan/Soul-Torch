# Soul Torch

**A procedural world-restoration roguelike inspired by Quintet's *Soul Blazer*.**

Play the [local browser prototype](./index.html) to explore 12 generated dungeon chambers, free six captive souls, rebuild a drowned settlement, and confront the warden. Each soul changes the world. **Which soul returns first within each of three civic pairs determines the rebuilt village, the dungeon terrain, and its NPC routines.** The same seed supports eight civic project combinations and **24 distinct founding histories**, all achievable through ordinary gameplay. Once an accord exists, a **lost council charter** appears in the crypt. Retrieve it from a cleansed room and ratify it in the village to unlock a lasting new route or clear a ruin.

This is an **original, standalone prototype**, not a SNES ROM hack, and contains no copyrighted game assets. The code uses only generated canvas shapes, system fonts, and native JavaScript APIs.

## Run it

Requires Python 3 or any local HTTP static-file server. At repository root:

```sh
python3 -m http.server 8000
```

Open http://localhost:8000 in a modern browser. Enter a seed and select **Ignite**.

Move with **WASD** or **arrow keys**, attack with **Space**, release souls, activate civic shrines or talk with villagers using **E**, switch between dungeon and village with **T**, and rest in the village with **R**. Civic shrines activate when standing on or next to their tile, and each grants its gift once per run. The rebuilt town's occupants patrol between their homes and the civic buildings they create. On-screen buttons support touch or mouse. Saves use the browser's local storage under `soul-torch-v3`. The loader also reads v0.2 replay saves and migrates their action history.

## Tests

Requires Node.js 20+ and no installed dependencies:

```sh
npm test
npm run soak -- 10000
npm run autoplay -- 100
npm run branch-matrix -- 3
npm run history-matrix -- 1
npm run smoke-view
npm run charter-matrix -- 2
```

The world-generation soak checks dungeon connectivity, door reciprocity, traversable room geometry, six unique souls, and an abstract progression solve. The **branch matrix** executes all eight paired rescue orders against each supplied seed using actual moves and combat. The **history matrix** tests 24 distinct project-completion histories arising from 48 gate-compatible permutations. The view smoke test uses a dependency-free canvas stub to verify DOM event wiring and town rendering. The charter matrix plays all 24 civic histories with real dungeon travel, charter recovery, council return, and ratification. CI runs all these checks.

## Architecture

- [`src/core.js`](src/core.js): dependency-free seeded PRNG; graph generation; tile obstacles; soul assignment; gate validation; enemy turns; dynamic restoration rules; persistent NPC patrols; site interactions; persistence through action replay.
- [`src/civic.js`](src/civic.js): central declarative definitions of each civic pair, its two alternate settlements, and project lots.
- [`src/view.js`](src/view.js): pixel-art canvas rendering, village transformation, minimap, keyboard/touch input, log, browser save and load.
- [`src/style.css`](src/style.css): responsive interface.
- [`tests/core.test.js`](tests/core.test.js) and [`tests/civic.test.js`](tests/civic.test.js): deterministic invariants, all eight world outcomes, repeatable site effects, town schedules, enemy cadence, charter recovery, ratification, v2 migration, and replay checks.
- [`tools/branch-matrix.mjs`](tools/branch-matrix.mjs): controlled rescue-order playthroughs with an optional seed count.
- [`tools/smoke-view.mjs`](tools/smoke-view.mjs): a lightweight dependency-free UI render and event-handler check.
- [`tools/soak.mjs`](tools/soak.mjs): repeatable seed-sweep runner.
- [`tools/autoplayer.mjs`](tools/autoplayer.mjs): reference agent that fights through the actual turn-based game (no game-state overrides).

World generation uses three connected four-room sectors, each a random 2×2 spanning graph with optional loop. The first passage depends on freeing the ferryman in the first sector; the second depends on rescuing the mason in the next. This ordering is deliberately enforced by construction. Every room has a traversable path from its center to each exit and to the lair.

Game state is a pure action-replay format. The seed and ordered player commands can recreate a run without serializing all mutable world objects. This also provides a stable harness for future autonomous-player experiments.

## Rescue-order projects (v0.2)

Each pair resolves when both members are rescued. The **first** rescued member chooses the settlement and dungeon effect. All eight permutations of the three paired choices are possible. The **first two completed projects** also form one of six founding accords, which alters the civic center, town patrols, dialogue, and a defensive or offensive bonus. `docs/RESCUE_ORDER.md` gives the exact matrix and validation rules.

| Pair | First returned | Village | Dungeon consequence |
| --- | --- | --- | --- |
| Ferryman + Herbalist | Ferryman | Canal Commons | New ferry-gated crossing, canal shrine, faster village rest |
| Ferryman + Herbalist | Herbalist | Reed Sanctuary | Four rocks cleared from a quarry room, healing shrine, +1 maximum HP |
| Mason + Archivist | Mason | Stone Foundry | New masonry-gated crypt crossing, forge shrine, +1 sword power |
| Mason + Archivist | Archivist | Memorial Arcade | Five rocks cleared from a crypt room, ward shrine, +2 maximum HP |
| Gardener + Bellkeeper | Gardener | Living Bells | Five rocks cleared from the warden chamber, healing grove, +1 maximum HP |
| Gardener + Bellkeeper | Bellkeeper | Resonant Orchard | Different warden terrain, resonator shrine, +1 sword power, slower warden attacks |

A site's location is generated **once from the seed** and its effect becomes active when its civic pair resolves. Orders modify the same underlying map, so differences are attributable to the rescue choice. The journal retains events, the village houses and civic lots change, and returned characters visit their joint project. The last boss concludes with one of eight project-themed endings, annotated with the founding accord. The sector gates permit 48 unique rescue orders and 24 distinct project-plus-accord histories. Each accord also has a unique charter relic and a second, player-earned restoration effect.

## Council charter pilgrimage (v0.3)

The first two completed civic projects form one of six founding accords. The council then reveals a **different charter for each accord order**. A stone bearing the charter appears in a seeded, reachable crypt chamber, always chosen before any rescue decision. The map and restoration panel show its location.

1. Clear that chamber of enemies and interact with the glowing stone (**E**) to carry the charter.
2. Return to the village (**T**), walk to the council if needed, and interact (**E**) to ratify it.
3. Ratification adds a reciprocal local dungeon shortcut when a missing edge exists. In a fully connected sector, it clears three obstacles. The earliest completed project determines an additional permanent gift:

| Earliest project | Gift on ratification | Infrastructure sector |
| --- | --- | --- |
| Waterside | +2 max HP and healing | Quarry (rooms 5–8) |
| Memory | +4 focused sword strikes | Crypt (rooms 9–12) |
| Orchard | +3 incoming-hit wards | Crypt (rooms 9–12) |

The council changes appearance, the second guild begins visiting the council, and the ending records the ratified charter. Finishing the game after ratification grants 150 bonus points. The quest is optional. `docs/COUNCIL_CHARTERS.md` documents the state machine, all six relics, and invariants.

## Prototype limits and next tasks

Combat remains simple directional melee with periodic enemy motion. Civic sites have one-time effects. NPCs follow deterministic patrols and talk through authored dialogue selected by civic state; there is no LLM execution at runtime. The original six-room restoration premise has expanded to twelve procedural dungeon chambers.

Further work should address character-directed quests, restoration-triggered monster mutations, real terrain obstacles that unlock without deadlocks, recurring civic economies, and calibrated difficulty across the eight paths. The run solver and reference agent make these changes regression-testable.

v0.1 saves remain incompatible. New saves have `version: 3` and use the key `soul-torch-v3`; v0.2 action-history saves are replayed into the new engine on load.

The long-term possibility of an `.smc` cartridge build would require a separate SNES-compatible engine or a ROM-hack implementation; the current release remains HTML/JavaScript.

## Project relationship

Soul Torch aims to keep the original game's causal rescue loop while making settlement reconstruction and dungeon exploration procedural. It does not redistribute or replace the original *Soul Blazer* ROM.

## License

Licensing of the original Soul Torch source is reserved for the repository owner. No third-party assets are bundled.
