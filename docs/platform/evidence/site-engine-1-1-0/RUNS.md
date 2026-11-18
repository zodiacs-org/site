# Engine migration verification

The engine archive comes from npm. The package receipt and integrity check are recorded in this directory. [Archive identity](ARTIFACT-IDENTITY.md)

The connector regression runs the real tool dispatcher with the site's horoscope data loaders. The baseline used the same test file against the fetched main commit. The baseline assertions and the branch and browser answers are recorded here. [Test output](vitest-summary.json) [Connector times](connector-times.json) [Browser times](browser-neptune.json)

The site bundle inventories list the raw byte count and gzip byte count of every built JavaScript, CSS and WebAssembly asset and of the standalone browser integration panels. Run the measurement script from the directory containing `dist` and `integrations`. The repo's bundle report also measures the transitive initial JavaScript for its budgeted routes and checks the chart engine chunk's full dependency closure. [Before](bundles-before.tsv) [After](bundles-after.tsv) [Measurement script](measure-bundles.mjs)

The site uses the committed NASA comparison to test the Neptune timing. A request to refresh the official lookup returned HTTP 403. No replacement dataset was used. [Request and refusal](horizons-refresh.txt).
