/**
 * What each kind of work the election search counts costs in CPU time, on
 * one machine, so that its allowance can weigh them:
 *
 *   npx vite-node --script tools/unit-cost.ts > unit-cost.txt
 *
 * A step of a crossing search is one evaluation the search counts; the
 * searches here are the ones the events endpoint and the election search
 * share. A full calculation is one call of positions() for every body, or
 * one natalChart() for a house, in each of the engine's house systems. Each
 * figure is the process's CPU time over many calls or steps, after a warm-up.
 */
import { moonPhase, natalChart, positions } from '@zodiacs/engine';
import { HOUSE_SYSTEM_NAMES } from '../../../../../src/lib/compute-api/constants';
import { SampleBudget, phaseCrossings, positionsMemo, signCrossings, stationCrossings } from '../../../../../src/lib/compute-api/endpoints';

const CALLS = 2_000;
const START = Date.UTC(2026, 2, 1);
const cpu = () => { const used = process.cpuUsage(); return (used.user + used.system) / 1000; };

function perCall(name: string, call: (i: number) => unknown) {
  for (let i = 0; i < 50; i += 1) call(i);
  const before = cpu();
  for (let i = 0; i < CALLS; i += 1) call(i);
  console.log(`${name.padEnd(44)} ${((cpu() - before) / CALLS).toFixed(4)} ms a call`);
}

function perStep(name: string, search: (budget: SampleBudget) => unknown) {
  search(new SampleBudget('events.samples'));
  const budget = new SampleBudget('events.samples');
  const before = cpu();
  search(budget);
  const ms = cpu() - before;
  console.log(`${name.padEnd(44)} ${(ms / budget.used).toFixed(4)} ms a step (${budget.used} steps)`);
}

const from = new Date(Date.UTC(2026, 0, 1));
const to = new Date(Date.UTC(2026, 3, 1));
console.log('crossing searches, 2026-01-01 to 2026-04-01');
perStep('new and full moons', (budget) => { phaseCrossings(0, from, to, budget); phaseCrossings(180, from, to, budget); });
perStep("the Moon's twelve sign boundaries", (budget) => { for (let i = 0; i < 12; i += 1) signCrossings('Moon', i * 30, from, to, budget); });
perStep("Mars's twelve sign boundaries", (budget) => { for (let i = 0; i < 12; i += 1) signCrossings('Mars', i * 30, from, to, budget); });
perStep("Mercury's stations", (budget) => stationCrossings('Mercury', from, to, budget, positionsMemo()));
console.log('full calculations, one a minute apart from 2026-03-01');
perCall('positions(), every body', (i) => positions(new Date(START + i * 61_000)));
for (const houseSystem of HOUSE_SYSTEM_NAMES) {
  perCall(`natalChart(), ${houseSystem}, 51.5° N`, (i) => natalChart({ utc: new Date(START + i * 61_000), latitude: 51.5, longitude: -0.1, houseSystem }));
}
perCall('natalChart(), placidus, 59.9° N', (i) => natalChart({ utc: new Date(START + i * 61_000), latitude: 59.9, longitude: 10.7, houseSystem: 'placidus' }));
console.log('for comparison');
perCall('moonPhase()', (i) => moonPhase(new Date(START + i * 61_000)));
