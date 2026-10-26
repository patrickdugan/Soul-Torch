# Council charter pilgrimage: v0.3

## Design contract

The first two **completed** civic pairs establish an accord, and its precise order names a different charter. This adds a playable obligation to rescue chronology: a village council exists, yet its founding agreement remains lost in the crypt until the player retrieves and ratifies it.

The quest is **optional**. It must never block the existing ferryman or mason gates, respawn a defeated monster, move a soul, or overwrite a previously selected civic branch.

| Completed project order | Named charter | Immediate founding gift | Ratification reward |
| --- | --- | --- | --- |
| Waterside → Memory | The Tidewheel Charter | +1 max HP | +2 max HP |
| Waterside → Orchard | The Canopy Charter | +1 max HP | +2 max HP |
| Memory → Waterside | The Scriptorium Writ | +2 focus | +4 focus |
| Memory → Orchard | The Iron Canticle | +2 focus | +4 focus |
| Orchard → Waterside | The Rootwater Covenant | +2 wards | +3 wards |
| Orchard → Memory | The Bellwright Testament | +2 wards | +3 wards |

The charter site is generated once, after the existing v0.2 world and civic site coordinates, and before any rescue is chosen. It is located in sector 2, outside the warden room, on a reachable tile that contains no initial enemy or civic shrine. Two histories sharing the same seed see the same physical charter site with different inscriptions.

## State transitions

```text
no accord
   | complete first two civic pairs in a legal rescue order
   v
SEEKING: charter stone visible in specified crypt chamber
   | clear all monsters in charter room; interact within one tile
   v
CARRIED: physical stone vanishes; retrieve event committed
   | return to village council (T, E within one tile)
   v
RATIFIED: permanent blessing, one infrastructure modification,
          secondary guild moves its patrol to council,
          150-point ending bonus
```

The engine records `charter` events for seeking/carried and one `ratification` event. `game.charter.stage` is `seeking`, `carried` or `ratified`. Further interactions cannot repeat a one-time gift. The chronicle, sidebar, map, dungeon stone, town council and ending all display the corresponding state.

The site is collectible only if every enemy in that chamber is gone. The player may retrieve the document while an unrelated soul remains sealed. The site has a different location from each shrine and the warden.

## Monotone infrastructure

After ratification, select the relevant four-room sector from the first completed pair:

- **Waterside first:** quarry, room IDs 4–7.
- **Memory or Orchard first:** crypt, room IDs 8–11.

Within a sector, inspect its four geometrically neighboring internal edges in a deterministic seed-and-accord rotation. If an edge does not exist, create *both directions* with `origin:'charter'` and without a new soul prerequisite. The seed already guarantees that the sector itself is reachable by the original gates. If every edge exists, remove three obstacles from a deterministically chosen room. Removing an obstacle cannot disconnect reachable floor.

`analyzeWorld` verifies each room's reachable floor, reciprocal doors, six souls, gates, and charter-site geometry. `analyzeGame` additionally validates charter existence, ratification evidence, and infrastructure consistency with the recorded chronicle.

## Replay and backwards compatibility

A complete game can be recreated from `seed` and the ordered commands accepted by `dispatch`. Version 3 saves use the `soul-torch-v3` localStorage key. The loader also tries `soul-torch-v2` and replays compatible v2 command histories into the v3 engine. This preserves commands and gameplay outcomes while adding optional charter state.

## Executable acceptance

```sh
npm test
npm run soak -- 10000
npm run autoplay -- 100
npm run branch-matrix -- 2
npm run history-matrix -- 1
npm run charter-matrix -- 2
npm run smoke-view
```

`tests/charter.test.js` verifies all six accord charters, blocked pickup, exact one-time ratification, unique rewards, both possible infrastructure outcomes, town patrol changes, deterministic actual-play saves, v2 replay compatibility, and one thousand independent charter anchors. `tools/charter-matrix.mjs` reconstructs all 24 distinct gate-compatible civic histories, plays through their quests with ordinary movement/combat/interactions, checks their endings, and ensures all 24 charters are ratified.

## Future extension

Rescue chronology currently fixes the founding accord, while the charter adds a second optional, player-earned stage. The next iteration can permit the council to decide how to spend limited rebuilding materials, so funding one project changes the villagers' jobs and deprives another project of supplies. Such choices must be replayable and tested against the original 48 legal rescue permutations.
