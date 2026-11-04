/**
 * The GeoNames city shards the calculators and the assistant tools share.
 * scripts/build-cities.mjs writes them. Kept outside src/mcp so a tool can
 * resolve a place without importing the MCP adapter, and outside src/lib so
 * the Phase 1 screenshot receipt does not treat the city table as a page template.
 */
import type { Row } from '../../lib/geo/rank';
import shardDigits from '../../../public/data/cities/0.json';
import shardA from '../../../public/data/cities/a.json';
import shardB from '../../../public/data/cities/b.json';
import shardC from '../../../public/data/cities/c.json';
import shardD from '../../../public/data/cities/d.json';
import shardE from '../../../public/data/cities/e.json';
import shardF from '../../../public/data/cities/f.json';
import shardG from '../../../public/data/cities/g.json';
import shardH from '../../../public/data/cities/h.json';
import shardI from '../../../public/data/cities/i.json';
import shardJ from '../../../public/data/cities/j.json';
import shardK from '../../../public/data/cities/k.json';
import shardL from '../../../public/data/cities/l.json';
import shardM from '../../../public/data/cities/m.json';
import shardN from '../../../public/data/cities/n.json';
import shardO from '../../../public/data/cities/o.json';
import shardP from '../../../public/data/cities/p.json';
import shardQ from '../../../public/data/cities/q.json';
import shardR from '../../../public/data/cities/r.json';
import shardS from '../../../public/data/cities/s.json';
import shardT from '../../../public/data/cities/t.json';
import shardU from '../../../public/data/cities/u.json';
import shardV from '../../../public/data/cities/v.json';
import shardW from '../../../public/data/cities/w.json';
import shardX from '../../../public/data/cities/x.json';
import shardY from '../../../public/data/cities/y.json';
import shardZ from '../../../public/data/cities/z.json';

const rows = (shard: unknown) => shard as readonly Row[];

/** Each shard of the index, by the first letter of the names in it; `0` holds the rest. */
export const PLACE_SHARDS: Readonly<Record<string, readonly Row[]>> = Object.freeze({
  '0': rows(shardDigits),
  a: rows(shardA),
  b: rows(shardB),
  c: rows(shardC),
  d: rows(shardD),
  e: rows(shardE),
  f: rows(shardF),
  g: rows(shardG),
  h: rows(shardH),
  i: rows(shardI),
  j: rows(shardJ),
  k: rows(shardK),
  l: rows(shardL),
  m: rows(shardM),
  n: rows(shardN),
  o: rows(shardO),
  p: rows(shardP),
  q: rows(shardQ),
  r: rows(shardR),
  s: rows(shardS),
  t: rows(shardT),
  u: rows(shardU),
  v: rows(shardV),
  w: rows(shardW),
  x: rows(shardX),
  y: rows(shardY),
  z: rows(shardZ),
});
