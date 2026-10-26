# Soul Torch

**A procedural world-restoration roguelike inspired by Quintet's *Soul Blazer*.**

Play the [local browser prototype](./index.html) to explore 12 generated dungeon chambers, free six captured souls, rebuild a drowned settlement, and confront the warden. A rescued character restores a place in the village and can change dungeon access, combat capability, or the memories of other villagers. Every run is deterministic under its seed.

This is an **original, standalone prototype**, not a SNES ROM hack, and contains no copyrighted game assets. The code uses only generated canvas shapes, system fonts, and native JavaScript APIs.

## Run it

Requires Python 3 or any local HTTP static-file server. At repository root:

```sh
python3 -m http.server 8000
```

Open http://localhost:8000 in a modern browser. Enter a seed and select **Ignite**.

Move with **WASD** or **arrow keys**, attack with **Space**, release souls or speak to people with **E**, switch between dungeon and village with **T**, and rest in the village with **R**. On-screen buttons support touch or mouse. Saves use the browser's local storage.

## Tests

Requires Node.js 20+ and no installed dependencies:

```sh
npm test
npm run soak -- 10000
npm run autoplay -- 100
```

The world-generation soak checks dungeon connectivity, door reciprocity, traversable room geometry, all six souls' uniqueness, and an abstract progression solve. Tests also exercise one-turn melee, restoration effects, memories, ending logic, and deterministic replay.

## Architecture

- [`src/core.js`](src/core.js): dependency-free seeded PRNG; graph generation; tile obstacles; soul assignment; gate validation; enemy turns; restoration rules; persistence through action replay.
- [`src/view.js`](src/view.js): pixel-art canvas rendering, village transformation, minimap, keyboard/touch input, log, browser save and load.
- [`src/style.css`](src/style.css): responsive interface.
- [`tests/core.test.js`](tests/core.test.js): deterministic invariants and gameplay checks.
- [`tools/soak.mjs`](tools/soak.mjs): repeatable seed-sweep runner.
- [`tools/autoplayer.mjs`](tools/autoplayer.mjs): reference agent that fights through the actual turn-based game (no game-state overrides).

World generation uses three connected four-room sectors, each a random 2×2 spanning graph with optional loop. The first passage depends on freeing the ferryman in the first sector; the second depends on rescuing the mason in the next. This ordering is deliberately enforced by construction. Every room has a traversable path from its center to each exit and to the lair.

Game state is a pure action-replay format. The seed and ordered player commands can recreate a run without serializing all mutable world objects. This also provides a stable harness for future autonomous-player experiments.

## Prototype limits and next tasks

Combat currently consists of directional sword attacks, simple periodic enemy movement, HP and village healing. A monster-free lair yields a healing spark. Each rescued NPC restores their named site; the ferryman and mason unlock the next two regions, the gardener raises maximum HP, and the bellkeeper strengthens the sword. Three pairs of restored NPCs generate additional shared memories and **rescue-order-dependent village branches**. Each pair has two distinct civic outcomes with corresponding vitality, sword, or resting-cost effects.

For the next slice, add room-specific objectives, terrain puzzles, more detailed alternate village scenes, enemy archetypes with telegraphed attacks, and quantitative bot benchmarks. Current reference-agent success demonstrates basic playability under the existing simple combat rules and is not a balance or entertainment evaluation.

## Project relationship

Soul Torch aims to keep the original game's causal rescue loop while making settlement reconstruction and dungeon exploration procedural. It does not redistribute or replace the original *Soul Blazer* ROM.

## License

Licensing of the original Soul Torch source is reserved for the repository owner. No third-party assets are bundled.
