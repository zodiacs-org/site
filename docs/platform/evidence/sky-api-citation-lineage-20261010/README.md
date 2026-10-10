# Static sky API citation lineage review

A6 requires cite fields containing url, receipt, engine and version on every API/MCP response. The existing static sky API envelope carries source/docs/license information but no cite field; its builders do not name a numerical producer or receipt.

This read-only review binds six source files to exact main `51b2c0d3bafe8b23d0a7f54433cd0c89c9435818`. The source loader reads committed daily, sky, eclipse and monthly transit data. The API composer republishes those records; packaging them does not establish which engine produced their numbers.

The sky data's recorded generatedAt is 2026-09-30T07:54:56.476Z. Comparing the direct parent of revision `8730b6479287df5038e2680dbca30898ab5cf4ba` with the current source shows that only the retrogrades field changed. All forty-seven windows remain present, while the moon array and generatedAt are unchanged. That revision describes a review-only rc16 source draft. The preceding rc15 regeneration is documented by commit `48607990d3b7752e0037b74f39d4f330be3ef68f`; a historical commit statement is not a new producer-execution receipt.

This proves a field-level revision boundary, not an astronomical accuracy failure. It also means that assigning the currently installed engine version to every value in the historical dataset would overstate its provenance.

The concrete next implementation needs producer/version/clock/packed-artifact receipts on each actually regenerated component, source digest verification when the API loads them, and cite propagation for each response's complete dependency set. Controls should reject missing/stale producer records, changed source bytes and incorrect mixed-source attribution. Existing numerical tolerances and required CI/review/post-merge/production gates stay in force.

No engine is executed, no data is regenerated and no publication or accepted weight is claimed by this review. A6 remains partial.
