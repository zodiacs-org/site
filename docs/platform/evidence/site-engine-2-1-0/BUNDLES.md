# Engine chunk size

The chart engine's gzip closure measures 34,476 bytes with engine 2.1.0, in a
local build of this branch and in the Developer guides job on GitHub. Engine
1.1.0 measured 34,060 bytes ([1.1.0 runs](../site-engine-1-1-0/RUNS.md)), so the
closure grew by 416 bytes. The growth is engine 2.1.0's continuous UTC time rule
and its Delta T model, which the chart code imports with its time basis.

The `engine-chunk` entry in `budgets.json` adds exactly those 416 bytes to the
previous cap, from 33.3998046875 KB to 33.8060546875 KB, which keeps about 141
bytes of headroom, as the 1.1.0 move did. The route budgets and the overall
chunk cap keep their existing values. The engine is loaded only when a chart is
asked for, so no page's first load grows.

| Chunk | Gzip bytes |
| --- | ---: |
| full.CKtRaZWC.js | 312 |
| rolldown-runtime.DK3Fl9T5.js | 154 |
| chunk-BPZVUBFC.D8t3W2q1.js | 23,874 |
| chunk-OWF2QKB4.D1_g2VyX.js | 740 |
| chunk-SCRO6HWB.D4itwa64.js | 1,789 |
| chunk-RMBWKZI2.DZR4n1wo.js | 538 |
| chunk-M65JXRFN.DG-S0j2L.js | 6,765 |
| chart-adapter.D7gaZnvr.js | 304 |
| Total | 34,476 |
