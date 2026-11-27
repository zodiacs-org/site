# Engine chunk size

The chart engine's gzip closure measures 34,659 bytes with engine 3.0.0, in a
local build of this branch. Engine 2.1.0 measured 34,476 bytes, in the same
local build of main and in the Developer guides job on GitHub
([2.1.0 bundles](../site-engine-2-1-0/BUNDLES.md)), so the closure grew by 183
bytes. 3.0.0 computes on astronomy-engine by default, so the browser no
longer needs 2.1.0's bundle-time rewrite; its ephemeris chunk now also asks
whether `useDe440()` registered the pack and carries the message it gives when
none is, and one module of the closure is split into two chunks. No browser
chunk carries the DE440 pack (`scripts/report-bundles.mjs` checks every
browser file for it).

The `engine-chunk` entry in `budgets.json` adds exactly those 183 bytes to the
previous cap, from 33.8060546875 KB to 33.984765625 KB, which keeps about 141
bytes of headroom, as the 1.1.0 and 2.1.0 moves did. The route budgets and
the overall chunk cap keep their existing values. The engine is loaded only
when a chart is asked for, so no page's first load grows.

| Chunk | Gzip bytes |
| --- | ---: |
| full.BJAr_Zq7.js | 311 |
| rolldown-runtime.DK3Fl9T5.js | 154 |
| chunk-U2TDDX6E.QczzGGIa.js | 24,000 |
| chunk-SCRO6HWB.D4itwa64.js | 1,789 |
| chunk-RMBWKZI2.DZR4n1wo.js | 538 |
| chunk-LTALVVC6.B75_fo4D.js | 6,764 |
| chunk-AF7WLUSL.wzL8IP4e.js | 688 |
| chunk-YJIWPXJX.Cv5mWo-8.js | 111 |
| chart-adapter.D7gaZnvr.js | 304 |
| Total | 34,659 |

For an application rather than this site's engine chunk, the engine page's
measurement (`src/data/engine-bundle.json`, `scripts/measure-engine-bundle.mjs`)
gives `import { natalChart } from '@zodiacs/engine'` 35.8 KB gzipped on 3.0.0,
where 2.1.0, which carried the pack, gave 2,346.1 KB.
