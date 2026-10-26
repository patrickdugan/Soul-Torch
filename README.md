# Soul Torch

**A procedural world-restoration roguelike inspired by Quintet's *Soul Blazer*.**

Play the [local browser prototype](./index.html) to explore 12 generated dungeon chambers, free six captive souls, rebuild a drowned settlement, and confront the warden. Each soul changes the world. **Which soul returns first within each of three civic pairs determines the rebuilt village, the dungeon terrain, and its NPC routines.** The same seed supports eight civic project combinations and **24 distinct founding histories**, all achievable through ordinary gameplay.

This is an **original, standalone prototype**, not a SNES ROM hack, and contains no copyrighted game assets. The code uses only generated canvas shapes, system fonts, and native JavaScript APIs.

## Run it

Requires Python 3 or any local HTTP static-file server. At repository root:

```sh
python3 -m http.server 8000
```

Open http://localhost:8000 in a modern browser. Enter a seed and select **Ignite**.

Move with **WASD** or **arrow keys**, attack with **Space**, release souls, activate civic shrines or talk with villagers using **E**, switch between dungeon and village with **T**, and rest in the village with **R**. Civic shrines activate when standing on or next to their tile, and each grants its gift once per run. The rebuilt town's occupants patrol between their homes and the civic buildings they create. On-screen buttons support touch or mouse. Saves use the browser's local storage (v0.2 keys and save format).

## Tests

Requires Node.js 20+ and no installed dependencies:

```sh
npm test
npm run soak -- 10000
npm run autoplay -- 100
npm run branch-matrix -- 3
npm run history-matrix -- 1
npm run smoke-view
```

The world-generation soak checks dungeon connectivity, door reciprocity, traversable room geometry, six unique souls, and an abstract progression solve. The **branch matrix** executes all eight paired rescue orders against each supplied seed using actual moves and combat. The **history matrix** tests 24 distinct project-completion histories arising from 48 gate-compatible permutations. The view smoke test uses a dependency-free canvas stub to verify DOM event wiring and town rendering. CI runs all these checks.

## Architecture

- [`src/core.js`](src/core.js): dependency-free seeded PRNG; graph generation; tile obstacles; soul assignment; gate validation; enemy turns; dynamic restoration rules; persistent NPC patrols; site interactions; persistence through action replay.
- [`src/civic.js`](src/civic.js): central declarative definitions of each civic pair, its two alternate settlements, and project lots.
- [`src/view.js`](src/view.js): pixel-art canvas rendering, village transformation, minimap, keyboard/touch input, log, browser save and load.
- [`src/style.css`](src/style.css): responsive interface.
- [`tests/core.test.js`](tests/core.test.js) and [`tests/civic.test.js`](tests/civic.test.js): deterministic invariants, all eight world outcomes, repeatable site effects, town schedules, enemy cadence, and replay checks.
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

A site's location is generated **once from the seed** and its effect becomes active when its civic pair resolves. Orders modify the same underlying map, so differences are attributable to the rescue choice. The journal retains events, the village houses and civic lots change, and returned characters visit their joint project. The last boss concludes with one of eight project-themed endings, annotated with the founding accord. The sector gates permit 48 unique rescue orders and 24 distinct project-plus-accord histories.

## Prototype limits and next tasks

Combat remains simple directional melee with periodic enemy motion. Civic sites have one-time effects. NPCs follow deterministic patrols and talk through authored dialogue selected by civic state; there is no LLM execution at runtime. The original six-room restoration premise has expanded to twelve procedural dungeon chambers.

Further work should address character-directed quests, restoration-triggered monster mutations, real terrain obstacles that unlock without deadlocks, recurring civic economies, and calibrated difficulty across the eight paths. The run solver and reference agent make these changes regression-testable.

Old v0.1 local saves use an incompatible simulation version. New saves have `version: 2` and use the key `soul-torch-v2`.

The long-term possibility of an `.smc` cartridge build would require a separate SNES-compatible engine or a ROM-hack implementation; the current release remains HTML/JavaScript.

## Project relationship

Soul Torch aims to keep the original game's causal rescue loop while making settlement reconstruction and dungeon exploration procedural. It does not redistribute or replace the original *Soul Blazer* ROM.

## License

Licensing of the original Soul Torch source is reserved for the repository owner. No third-party assets are bundled.
