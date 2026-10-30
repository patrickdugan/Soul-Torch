# Rescue order: world-shaping design and acceptance evidence

## Player-facing rule

Six captive souls belong to three **civic pairs**. Each pair has two potential settlements. The partner who returns first determines which settlement emerges when the second partner is released. The completion order of the first two pairs decides a further **founding accord**, which influences the town council and the hero. The pair's rescue order stays in `game.rescued`, and the chosen variant is recorded in `game.branches`.

Rescue-order branching is a procedural design primitive. It alters the same generated dungeon, village, NPC routes, and concluding history. The game generates a world seed once and resolves decisions from the sequence of player commands.

## All six variants

| Pair | First rescued | Project | Permanent effect | Dungeon graph / terrain | Active shrine (E, once) |
| --- | --- | --- | --- | --- | --- |
| Ferryman/Herbalist | Ferryman | Canal Commons | Town rest cost 8 -> 6 turns | Add reciprocal second sector 0 -> 1 crossing, remove 2 stones | Canal, heal 2 HP |
| Ferryman/Herbalist | Herbalist | Reed Sanctuary | +1 max HP | Remove 4 stones in predetermined sector-1 room | Spring, heal 4 HP |
| Mason/Archivist | Mason | Stone Foundry | +1 permanent power | Add reciprocal second sector 1 -> 2 crossing | Forge, next 4 successful sword hits +1 damage |
| Mason/Archivist | Archivist | Memorial Arcade | +2 max HP | Remove 5 stones in predetermined sector-2 room | Memorial, next 3 incoming blows prevented |
| Gardener/Bellkeeper | Gardener | Living Bells | +1 max HP | Remove 5 stones near the warden | Grove, heal 4 HP |
| Gardener/Bellkeeper | Bellkeeper | Resonant Orchard | +1 power, every fourth turn interrupts the warden when it would act | Remove an alternate 5 stones near the warden | Resonator, next 4 successful sword hits +1 damage |

Individual restorations are preserved: gardener adds +2 max HP, bellkeeper adds +1 sword power, and ferry/mason still unlock their original story gates. Shared memory events between other pairs remain intact.

### Physical constraints

- The initial world is made of 3 sectors × 4 rooms. Room IDs `0..3` are before the ferry gate, `4..7` after ferry and before the masonry gate, and `8..11` beyond the masonry gate.
- Ferryman-first and mason-first projects open the **alternate** connecting edge along an existing sector boundary, with the same original soul prerequisite on both routes. Both ends of every new door are created together.
- Other projects **remove** obstacles from one room. Removing obstacles preserves existing reachability by construction. The obstacles removed are listed in the branch and terrain events, and the animated dungeon immediately uses the changed geometry.
- A civic shrine tile is selected from already reachable floor in its designated sector during world generation. The site is chosen before the player releases any soul, and excludes enemies, the seal and the hero's spawn.
- `analyzeGame()` rechecks reciprocal doors, floor connectivity, soul reachability, and the consistency of the chosen civic projects against the rescue history.

### Founding accords and interleaved rescue orders

A civic pair *finishes* when both souls are released. Once two pairs have finished, their completion order establishes one permanent accord. This makes interleaving matter even when the same three members of the pairs return first.

| First completed project | Second completed project | Founding accord | Bonus |
| --- | --- | --- | --- |
| Waterside | Memory | Waterwheel Covenant | +1 maximum HP |
| Waterside | Orchard | River Canopy | +1 maximum HP |
| Memory | Waterside | Scriptorium Quay | +2 empowered sword strikes |
| Memory | Orchard | Foundry Choir | +2 empowered sword strikes |
| Orchard | Waterside | Rootwater Concord | 2 incoming strikes prevented |
| Orchard | Memory | Bellwrights Accord | 2 incoming strikes prevented |

The civic center becomes an active council site. The villagers responsible for the first completed project visit the center on their town patrols; those from the second still visit their shared civic project. Contextual conversations mention the accord.

Across the six souls, there are `6! = 720` formal orders. The original ferry/masonry sector dependencies permit **48** of those orders as valid rescue sequences. When we classify each valid order by its three first-rescued choices and the first two completed civic projects, we obtain **24 distinct civic histories**. These 24 histories are tested using real gameplay actions by `tools/history-matrix.mjs`.

### Town social behavior

`townNpcs(game)` returns deterministic resident coordinates. A solitary survivor patrols near their restored home. Once their civic partner returns, both travel between their homes and the newly constructed shared civic lot. The earliest complete project subsequently sends its two partners to the town council. `townDialogue()` uses the specific branch and partner identity in authored lines. `game.townTicks` advances through town movement, conversation and rest, independently of combat turns. The same input history reproduces NPC placement.

### Ending families

Three independent binary civic decisions produce `2^3 = 8` project-themed endings:

`AAA`, `AAB`, `ABA`, `ABB`, `BAA`, `BAB`, `BBA`, `BBB`

`A` means the first-named member of that pair returned first. `B` means the other member did. The ending key, civic founding accord, and four narrative chapters are calculated from actual civic history. A complete history key combines the three pair choices and the first two completed projects, for 24 gate-compatible outcomes. All use the same warden victory rule.

## Reproducible checks

At repository root, with Node.js 20+:

```sh
npm test
npm run soak -- 10000
npm run autoplay -- 50
npm run branch-matrix -- 5
npm run history-matrix -- 1
npm run smoke-view
```

`branch-matrix` runs eight distinct paired rescue-order priorities **against each same seed**. The `history-matrix` enumerates all 48 gate-legal permutations, reduces them to 24 unique civic histories, and plays a representative of each history. The reference agent moves, attacks, heals, releases souls, and navigates the real game. It may defeat non-target chamber monsters along its route, while avoiding release of non-target souls. It never modifies the state directly. Each completed run must have the requested branch decisions and matching ending code.

`civic.test.js` additionally does controlled direct rescue-state injection to isolate the exact consequences of each first-returned member, validates shrine depletion and combat charges, and checks map reciprocity over multiple seeds. `smoke-view` renders the town with a canvas stub, checks the journal and loads a genuine partially played run into the UI.

## The accord becomes a playable obligation (v0.3)

The six founding accords now create six different **council charter** quests. The charter location is chosen with the seed in the final sector, independently of rescue order. A character must first clear the charter chamber, retrieve the stone, return to the council, and ratify the charter. The completed charter then adds a reciprocal intra-sector door when a door is missing. When that sector already has all four internal edges, three obstacles are cleared instead. Both changes preserve the original ferry and masonry gates.

The first completed project determines the ratification reward: Waterside grants two max HP, Memory grants four focused sword strikes, and Orchard grants three wards. The second guild joins the council patrol after ratification; a completed charter is recorded in the ending and grants 150 points. Charter collection and ratification are optional, and game progress never requires the charter. These rules are audited in `docs/COUNCIL_CHARTERS.md` and exercised by the 24-history charter matrix.

## Design next

The current generator creates a civic building instantly when a pair resolves. A later version can stage this over several town visits, letting players choose between competing projects using resources or story decisions. A secondary rival restoration agent could choose which souls to free, creating contested causal histories. Either addition would need solvability certificates and one-seed counterfactual tests before inclusion.
