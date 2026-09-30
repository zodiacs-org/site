import { describe, expect, it } from 'vitest';
import { bodyLongitude } from './full';
import auraIngresses from '../../data/aura-moon-ingresses.json';
import { SIGN_SLUGS } from '../signs';
import {
  ASPECT_OFFSETS,
  moonAspects,
  moonIngresses,
  PTOLEMAIC_ASPECTS,
  VOID_BODIES_MODERN,
  VOID_BODIES_TRADITIONAL,
  voidOfCourseWindows,
  voidStatus,
} from './void-of-course';

const DAY = 86_400_000;
const from = new Date('2026-09-01T00:00:00Z');
const to = new Date('2026-11-30T00:00:00Z');

function delta(a: number, b: number): number {
  const d = (((b - a) % 360) + 360) % 360;
  return d > 180 ? d - 360 : d;
}

describe('void-of-course Moon', () => {
  const ingresses = moonIngresses(from, to);
  const aspects = moonAspects(from, to);
  const windows = voidOfCourseWindows(from, to);

  it('finds every Moon ingress the committed ingress table lists, to the second', () => {
    const expected = (auraIngresses.ingresses as { sign: string; at: string }[])
      .filter((entry) => new Date(entry.at) > from && new Date(entry.at) <= to);
    expect(expected.length).toBeGreaterThan(30);
    expect(ingresses).toHaveLength(expected.length);
    ingresses.forEach((ingress, index) => {
      expect(SIGN_SLUGS[ingress.signIndex]).toBe(expected[index].sign);
      expect(Math.abs(ingress.at.getTime() - new Date(expected[index].at).getTime())).toBeLessThan(1000);
    });
  });

  it('perfects every reported aspect to within a fraction of an arcsecond', () => {
    expect(aspects.length).toBeGreaterThan(200);
    for (const aspect of aspects) {
      const angle = PTOLEMAIC_ASPECTS.find((a) => a.type === aspect.aspect)!.angle;
      const raw = delta(bodyLongitude(aspect.body, aspect.at), bodyLongitude('Moon', aspect.at));
      expect(Math.abs(Math.abs(raw) - angle)).toBeLessThan(1e-4);
      expect(Math.abs(delta(aspect.moonLon, bodyLongitude('Moon', aspect.at)))).toBeLessThan(1e-9);
    }
    for (let i = 1; i < aspects.length; i += 1) {
      expect(aspects[i].at.getTime()).toBeGreaterThanOrEqual(aspects[i - 1].at.getTime());
    }
  });

  it('misses no aspect: a fine brute-force sweep finds a reported perfection in every zero-crossing interval', () => {
    const sweepFrom = new Date('2026-09-10T00:00:00Z');
    const sweepTo = new Date('2026-09-30T00:00:00Z');
    const step = DAY / 48;
    const found = moonAspects(sweepFrom, sweepTo);
    for (const body of VOID_BODIES_MODERN) {
      for (const { type, offset: angle } of ASPECT_OFFSETS) {
        let prevT = sweepFrom.getTime();
        let prev = delta(bodyLongitude(body, sweepFrom) + angle, bodyLongitude('Moon', sweepFrom));
        while (prevT < sweepTo.getTime()) {
          const t = prevT + step;
          const date = new Date(t);
          const cur = delta(bodyLongitude(body, date) + angle, bodyLongitude('Moon', date));
          if (Math.sign(cur) !== Math.sign(prev) && Math.abs(cur) < 90 && Math.abs(prev) < 90 && cur !== 0 && prev !== 0) {
            const hit = found.find((a) => a.body === body && a.aspect === type
              && a.at.getTime() > prevT && a.at.getTime() <= t);
            expect(hit, `${body} ${type} between ${new Date(prevT).toISOString()} and ${date.toISOString()}`).toBeTruthy();
          }
          prevT = t;
          prev = cur;
        }
      }
    }
    // About 86,000 longitudes: 3.4 s alone on engine rc.15, where each call
    // takes about a fifth longer than on rc.14, and past the default 5 s when
    // the suite runs in parallel.
  }, 30_000);

  it('builds one window per ingress, ending exactly at the ingress and starting at the last aspect', () => {
    const ending = ingresses.filter((i) => i.at > from);
    expect(windows).toHaveLength(ending.length);
    windows.forEach((window, index) => {
      expect(window.to.getTime()).toBe(ending[index].at.getTime());
      expect(window.nextSignIndex).toBe(ending[index].signIndex);
      expect(window.signIndex).toBe((ending[index].signIndex + 11) % 12);
      expect(window.from.getTime()).toBeLessThan(window.to.getTime());
      if (window.lastAspect) {
        expect(window.from.getTime()).toBe(window.lastAspect.at.getTime());
        const later = aspects.filter((a) => a.at > window.lastAspect!.at && a.at < window.to);
        expect(later).toHaveLength(0);
      }
      expect(window.to.getTime() - window.from.getTime()).toBeLessThan(2.8 * DAY);
    });
    const durations = windows.map((w) => w.to.getTime() - w.from.getTime()).sort((a, b) => a - b);
    expect(durations[Math.floor(durations.length / 2)]).toBeLessThan(DAY);
  });

  it('reports the traditional Sun-to-Saturn variant with voids that start no earlier than the modern ones', () => {
    const traditional = voidOfCourseWindows(from, new Date('2026-09-30T00:00:00Z'), { bodies: VOID_BODIES_TRADITIONAL });
    const modern = windows.filter((w) => w.to <= new Date('2026-09-30T00:00:00Z'));
    expect(traditional).toHaveLength(modern.length);
    traditional.forEach((window, index) => {
      expect(window.to.getTime()).toBe(modern[index].to.getTime());
      expect(window.from.getTime()).toBeLessThanOrEqual(modern[index].from.getTime());
    });
  });

  it('answers the status question consistently with the window list', () => {
    const inside = windows[3];
    const midpoint = new Date((inside.from.getTime() + inside.to.getTime()) / 2);
    const status = voidStatus(midpoint);
    expect(status.isVoid).toBe(true);
    // Bisection endpoints differ by a millisecond between scans that start at different instants.
    expect(Math.abs(status.current!.from.getTime() - inside.from.getTime())).toBeLessThan(1000);
    expect(Math.abs(status.current!.to.getTime() - inside.to.getTime())).toBeLessThan(1000);
    expect(Math.abs(status.next!.from.getTime() - windows[4].from.getTime())).toBeLessThan(1000);

    const justAfter = new Date(inside.to.getTime() + 60_000);
    const after = voidStatus(justAfter);
    expect(after.isVoid).toBe(false);
    expect(after.current).toBeNull();
    expect(Math.abs(after.next!.to.getTime() - windows[4].to.getTime())).toBeLessThan(1000);
  });

  it('computes a quarter of windows in a few seconds', () => {
    const started = Date.now();
    voidOfCourseWindows(new Date('2027-01-01T00:00:00Z'), new Date('2027-04-01T00:00:00Z'));
    expect(Date.now() - started).toBeLessThan(15_000);
  });
});
