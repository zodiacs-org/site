# Weekly monitor fixtures

## IERS Bulletin A replay

`finals2000A-20261112.txt` came from
<https://maia.usno.navy.mil/ser7/finals2000A.all>, retrieved
`2026-11-18T10:59:02Z`. SHA-256 of the downloaded file:
`51cb9676d9c4775c4d344b328bc3eb1ac3940b089ce4b659ccac883637d09dd6`.

For the replay, the fixture keeps the last 30 rows with the UT1 flag `I`
and all 372 rows with the flag `P`. Each row retains its original bytes,
including trailing spaces and line endings. The final observed day is
2026-11-12. Run the monitor for 2026-11-13. SHA-256 of the fixture:
`4958c5538c8c91ba027e838db0bf4ac883c71a2a6e81f87faa7e4171ade1e41f`.

## IANA release replay

<https://data.iana.org/time-zones/tzdb/version> reported `2026f`.
`tzdb-NEWS-2026f.txt` contains the beginning of
<https://data.iana.org/time-zones/tzdb/NEWS> through the `2025c` release,
both retrieved `2026-11-18T10:58:59Z`. SHA-256 of the fixture:
`beb62f67000db12cea54df0df4eed20e01bbd560c22d635b5b1dad9529a4eb3e`.
