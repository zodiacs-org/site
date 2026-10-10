// Gate A grid copied byte-for-byte from engine's houses-extra evidence.
// Only the engine's own synthetic values are written to the runner's scratch file.
import { coAscendants } from '@zodiacs/engine/houses';
import { globalGrid, inputOf, ladder } from './grids.mjs';
for (const c of [...ladder(), ...globalGrid()]) {
  const p = coAscendants(inputOf(c));
  console.log(JSON.stringify({ set:c.set, ramc:c.ramc, lat:c.lat, eps:c.eps,
    points:[p.equatorialAscendant,p.kochCoAscendant,p.munkaseyCoAscendant,p.polarAscendant] }));
}
