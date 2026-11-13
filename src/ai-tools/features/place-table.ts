/**
 * The GeoNames cities15000 index, loaded by the hosted function and the
 * developer server, not by the shared tool module. Keeping the import here
 * leaves the city names out of api/_ai/runtime.mjs, which the consumer
 * boundary reads as copy.
 */
import index from '../../../public/data/cities/index.json' with { type: 'json' };
import shard0 from '../../../public/data/cities/0.json' with { type: 'json' };
import shardA from '../../../public/data/cities/a.json' with { type: 'json' };
import shardB from '../../../public/data/cities/b.json' with { type: 'json' };
import shardC from '../../../public/data/cities/c.json' with { type: 'json' };
import shardD from '../../../public/data/cities/d.json' with { type: 'json' };
import shardE from '../../../public/data/cities/e.json' with { type: 'json' };
import shardF from '../../../public/data/cities/f.json' with { type: 'json' };
import shardG from '../../../public/data/cities/g.json' with { type: 'json' };
import shardH from '../../../public/data/cities/h.json' with { type: 'json' };
import shardI from '../../../public/data/cities/i.json' with { type: 'json' };
import shardJ from '../../../public/data/cities/j.json' with { type: 'json' };
import shardK from '../../../public/data/cities/k.json' with { type: 'json' };
import shardL from '../../../public/data/cities/l.json' with { type: 'json' };
import shardM from '../../../public/data/cities/m.json' with { type: 'json' };
import shardN from '../../../public/data/cities/n.json' with { type: 'json' };
import shardO from '../../../public/data/cities/o.json' with { type: 'json' };
import shardP from '../../../public/data/cities/p.json' with { type: 'json' };
import shardQ from '../../../public/data/cities/q.json' with { type: 'json' };
import shardR from '../../../public/data/cities/r.json' with { type: 'json' };
import shardS from '../../../public/data/cities/s.json' with { type: 'json' };
import shardT from '../../../public/data/cities/t.json' with { type: 'json' };
import shardU from '../../../public/data/cities/u.json' with { type: 'json' };
import shardV from '../../../public/data/cities/v.json' with { type: 'json' };
import shardW from '../../../public/data/cities/w.json' with { type: 'json' };
import shardX from '../../../public/data/cities/x.json' with { type: 'json' };
import shardY from '../../../public/data/cities/y.json' with { type: 'json' };
import shardZ from '../../../public/data/cities/z.json' with { type: 'json' };
import type { Row } from '../../lib/geo/rank';
import type { PlaceTable } from './birthplace';

const rows = (shard: unknown) => shard as readonly Row[];

export function loadPlaceTable(): PlaceTable {
  return {
    index: index as unknown as PlaceTable['index'],
    shards: {
      '0': rows(shard0), a: rows(shardA), b: rows(shardB), c: rows(shardC), d: rows(shardD),
      e: rows(shardE), f: rows(shardF), g: rows(shardG), h: rows(shardH), i: rows(shardI),
      j: rows(shardJ), k: rows(shardK), l: rows(shardL), m: rows(shardM), n: rows(shardN),
      o: rows(shardO), p: rows(shardP), q: rows(shardQ), r: rows(shardR), s: rows(shardS),
      t: rows(shardT), u: rows(shardU), v: rows(shardV), w: rows(shardW), x: rows(shardX),
      y: rows(shardY), z: rows(shardZ),
    },
  };
}
