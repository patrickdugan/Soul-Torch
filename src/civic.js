/** Soul Torch civic projects. Data is shared by the simulation and the renderer. */
export const TOWN_HOMES = Object.freeze([[3, 3], [10, 3], [17, 3], [3, 9], [10, 9], [17, 9]]);

export const CIVIC_PROJECTS = Object.freeze([
  {
    key: 'waterside', a: 'ferryman', b: 'herbalist', sector: 1, lot: [6, 6],
    variants: {
      ferryman: { name: 'Canal Commons', kind: 'canal',
        effect: 'A second ferry crossing opens. Village rests cost six turns.',
        dialogue: 'The channel opened first. Now a boat brings medicine to every door.' },
      herbalist: { name: 'Reed Sanctuary', kind: 'spring',
        effect: 'Reeds clear a dungeon path. Maximum health rises by one.',
        dialogue: 'The reed beds took root before the boats came. The water heals.' },
    },
  },
  {
    key: 'memory', a: 'mason', b: 'archivist', sector: 2, lot: [14, 6],
    variants: {
      mason: { name: 'Stone Foundry', kind: 'forge',
        effect: 'A second crypt approach opens. Reclaimed iron strengthens the torchblade.',
        dialogue: 'We built a forge before carving the first name into the walls.' },
      archivist: { name: 'Memorial Arcade', kind: 'archive',
        effect: 'The memorial clears a crypt passage. Maximum health rises by two.',
        dialogue: 'We carved the names before rebuilding the walls. The dead are remembered.' },
    },
  },
  {
    key: 'orchard', a: 'gardener', b: 'bellkeeper', sector: 2, lot: [10, 11],
    variants: {
      gardener: { name: 'Living Bells', kind: 'grove',
        effect: 'Roots clear the warden chamber. The blooming tower grants one maximum HP.',
        dialogue: 'The tree carried the first bell. Its roots made a new way forward.' },
      bellkeeper: { name: 'Resonant Orchard', kind: 'resonator',
        effect: 'Resonance clears a different warden path and strengthens the torchblade.',
        dialogue: 'The first bell taught the orchard a rhythm even shadows must obey.' },
    },
  },
]);

export const CIVIC_LOTS = Object.freeze(Object.fromEntries(CIVIC_PROJECTS.map(p => [p.key, p.lot])));
export const civicProject = key => CIVIC_PROJECTS.find(p => p.key === key);

/** The first two *completed* projects form a founding accord. Their completion
 * order can differ even when the same member of each pair was rescued first. */
export const CIVIC_ACCORDS = Object.freeze({
  'waterside>memory': { name: 'Waterwheel Covenant',
    dialogue: 'The first quays carried stone to the workshops. A city gathered by the river.' },
  'waterside>orchard': { name: 'River Canopy',
    dialogue: 'The first ferry fed the bell gardens. People followed the river home.' },
  'memory>waterside': { name: 'Scriptorium Quay',
    dialogue: 'The first builders preserved the river routes as stories before boats returned.' },
  'memory>orchard': { name: 'Foundry Choir',
    dialogue: 'The workshops forged the first bellframes. The village learned their rhythm.' },
  'orchard>waterside': { name: 'Rootwater Concord',
    dialogue: 'The first bells reached the river and guided the ferry through the mist.' },
  'orchard>memory': { name: 'Bellwrights Accord',
    dialogue: 'The living orchard made room for the builders beneath its branches.' },
});
