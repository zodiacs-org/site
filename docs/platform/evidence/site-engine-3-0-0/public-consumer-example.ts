import { natalChart, searchLongitudeCrossings, defaultEphemeris, ENGINE_VERSION } from '@zodiacs/engine';
import { useDe440 } from '@zodiacs/engine/de440/pack';
import { createNatalEnvelope } from '@zodiacs/engine/receipt';
import { resolveLocalToUtc, prepareLocalTime } from '@zodiacs/engine/geo';

// From 3.0.0 the root computes on astronomy-engine until the shipped DE440 pack is installed.
useDe440();
if (defaultEphemeris().name !== 'de440' || !defaultEphemeris().de440.opened) throw new Error('DE440 default');
await prepareLocalTime('2001-03-09', 'Europe/Lisbon');
const utc = resolveLocalToUtc('2001-03-09', '06:45', 'Europe/Lisbon');
const chart = natalChart({ utc: utc.utc, latitude: 38.7223, longitude: -9.1393, houseSystem: 'placidus' });
const envelope = createNatalEnvelope(chart);
const crossing = searchLongitudeCrossings('Neptune', 0, new Date('2026-01-01T00:00:00Z'), new Date('2026-02-28T00:00:00Z'));
if (envelope.receipt.engine.version !== ENGINE_VERSION) throw new Error('receipt version');
if (!chart.angles || chart.bodies.length < 10) throw new Error('chart');
console.log(JSON.stringify({ version: ENGINE_VERSION, ephemeris: chart.ephemeris?.name, sun: chart.bodies[0].sign, crossings: 'crossings' in crossing ? crossing.crossings.length : 0 }));
