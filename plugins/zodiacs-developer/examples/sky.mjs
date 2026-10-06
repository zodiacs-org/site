import { ENGINE_VERSION, moonPhase, positions } from '@zodiacs/engine';
const instant = new Date('2026-10-01T06:00:00Z'); // Synthetic fixed example.
console.log(JSON.stringify({ engine: ENGINE_VERSION, instant: instant.toISOString(), moonPhase: moonPhase(instant), bodies: positions(instant) }, null, 2));
