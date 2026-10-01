import { bodyLongitude, computeChart } from '../../lib/engine/full';
import { createTransitWindowScanner } from '../../lib/engine/transit-window-core';
import { houseOf } from '../../lib/engine/houses';
import { ENGINE_VERSION, type ChartInput } from '../../lib/engine/types';
import { PERSONAL_BODIES, reliableTime, type PersonalResult } from './personal';
import type { WindowTransitBody } from '../../lib/engine/transit-window-core';
import type { SkyEvent } from './types';
import { computeOutlookDay } from './outlook';

export interface PersonalRequest { sourceId: string; sourceUpdatedAt?: string; input: Omit<ChartInput, 'utc'> & { utc: string }; from: string; to: string; reference: string; bodies: WindowTransitBody[]; orb: number; outlookMonth?: string }
const scope = globalThis as unknown as { onmessage: (event: MessageEvent<PersonalRequest>) => void; postMessage: (value: { progress: string } | { result: PersonalResult } | { error: string }) => void };
const angle = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);
const offsets = { conjunction: 0, sextile: 60, square: 90, trine: 120, opposition: 180 };
const hash = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), b => b.toString(16).padStart(2, '0')).join('');

scope.onmessage = ({ data }) => { void (async () => {
  try {
    const chart = computeChart({ ...data.input, utc: new Date(data.input.utc) });
    const timeReliable = reliableTime(data.input.timeKnown, chart.flags);
    const natal = { bodies: chart.bodies.filter(b => PERSONAL_BODIES.includes(b.body as WindowTransitBody) && (timeReliable || b.body !== 'Moon')), angles: timeReliable ? chart.angles : null };
    const cusps = timeReliable ? chart.houses?.cusps : null;
    const house = (longitude: number) => cusps ? houseOf(longitude, cusps) : null;
    const scanner = createTransitWindowScanner({ bodyLongitude }, { bodies: PERSONAL_BODIES, stepMs: body => body === 'Moon' ? 3600000 : ['Sun', 'Mercury', 'Venus', 'Mars'].includes(body) ? 21600000 : 43200000 });
    const events: SkyEvent[] = [];
    const reference = new Date(data.reference);
    for (const body of data.bodies) {
      scope.postMessage({ progress: body });
      const windows = scanner.scanTransitWindows(natal, new Date(data.from), new Date(data.to), { timeKnown: timeReliable, transitBodies: [body], orbDegrees: data.orb });
      for (const window of windows) {
        const natalLongitude = window.natalPoint === 'ASC' ? natal.angles!.asc : window.natalPoint === 'MC' ? natal.angles!.mc : natal.bodies.find(b => b.body === window.natalPoint)!.lon;
        const transitLongitude = bodyLongitude(body, reference);
        const deviation = (at: Date) => Math.abs(angle(bodyLongitude(body, at), natalLongitude) - offsets[window.aspect]);
        const separation = deviation(reference), before = deviation(new Date(reference.getTime() - 600000)), after = deviation(new Date(reference.getTime() + 600000));
        const phase = window.exactTopologyStatus === 'uncertain' || window.membershipStatus === 'uncertain' ? 'stationary / uncertain' : separation < 0.00001 ? 'exact' : Math.abs(after - before) < 0.000001 ? 'stationary / uncertain' : after < before ? 'applying' : 'separating';
        const identifier = `personal:${(await hash(`${data.sourceId}:${window.id}:${data.orb}`)).slice(0, 32)}`;
        const passes = window.exactTopologyStatus === 'resolved' && window.exactPassesUtc.length ? window.exactPassesUtc : [window.peak.atUtc ?? window.startUtc];
        const linkedIds = passes.map((_, i) => `${identifier}:${i}`);
        for (const [i, at] of passes.entries()) events.push({ id: linkedIds[i], family: 'aspect', subtype: 'personal-transit', title: `${body} ${window.aspect} natal ${window.natalPoint}`, at, end: window.endUtc > at ? window.endUtc : null, bodies: [body, window.natalPoint], aspectType: window.aspect, linkedIds: linkedIds.filter(id => id !== linkedIds[i]), interpretation: `${window.aspect === 'square' || window.aspect === 'opposition' ? 'Traditionally a prompt to examine friction and competing demands.' : window.aspect === 'trine' || window.aspect === 'sextile' ? 'Traditionally a prompt to notice ease and available support.' : 'Traditionally a prompt to focus attention on the natal theme.'} Use it to review preparation, discipline and risk tolerance. It gives no asset price direction.`, provenance: { catalog: 'Private browser calculation', sha256: '', engineVersion: ENGINE_VERSION, convention: 'Tropical geocentric ecliptic longitude of date; fixed natal targets; all five major aspects. Numerical roots are model instants, not accuracy guarantees.' }, personal: { sourceId: data.sourceId, sourceUpdatedAt: data.sourceUpdatedAt, window, transitLongitude, natalLongitude, separation, phase, natalHouse: house(natalLongitude), transitHouse: house(transitLongitude), orb: data.orb } });
      }
      await new Promise<void>(resolve => setTimeout(resolve, 0));
    }
    const houses = [2, 5, 8].map(number => ({ house: number, natal: natal.bodies.filter(b => house(b.lon) === number).map(b => b.body), transit: PERSONAL_BODIES.filter(body => house(bodyLongitude(body, reference)) === number) }));
    const outlook = data.outlookMonth ? Array.from({ length: new Date(Number(data.outlookMonth.slice(0, 4)), Number(data.outlookMonth.slice(5)), 0).getDate() }, (_, i) => computeOutlookDay(natal, cusps ?? null, `${data.outlookMonth}-${String(i + 1).padStart(2, '0')}`, data.bodies, data.orb, bodyLongitude)) : undefined;
    scope.postMessage({ result: { sourceId: data.sourceId, houseSystem: cusps ? chart.houses!.system : null, flags: chart.flags, timeReliable, events: events.sort((a, b) => a.at.localeCompare(b.at)), houses, ...(outlook ? { outlook } : {}) } });
  } catch (error) { scope.postMessage({ error: error instanceof Error ? error.message : 'Personal timing could not be calculated.' }); }
})(); };
