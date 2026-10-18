import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TOOL_ICONS, TOOL_ICON_FOR_PATH, TOOL_ICON_NAMES, toolIconForPath } from './tool-icons';

const SIGN_HUES = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];

function routeExists(path: string): boolean {
  const dir = resolve('src/pages', `.${path}`);
  return existsSync(resolve(dir, 'index.astro'));
}

describe('tool icon set', () => {
  it('has thirty distinct drawings, each on one of the twelve sign hues', () => {
    expect(TOOL_ICON_NAMES).toHaveLength(30);
    const bodies = new Set(TOOL_ICON_NAMES.map((name) => TOOL_ICONS[name].body));
    expect(bodies.size).toBe(30);
    for (const name of TOOL_ICON_NAMES) expect(SIGN_HUES).toContain(TOOL_ICONS[name].hue);
  });

  it('draws only stroked line art on the 24-unit grid, with no stray styling', () => {
    for (const name of TOOL_ICON_NAMES) {
      const { body } = TOOL_ICONS[name];
      expect(body).toMatch(/^<(path|circle|rect|ellipse)\b/);
      expect(body).not.toMatch(/<svg|<script|on\w+=|href=|stroke-width=|stroke-opacity=|#[0-9a-f]{3,6}\b/i);
      // Fills are either the line colour (dots) or the disc's own hue (an occluding shape).
      for (const fill of body.matchAll(/fill(?:=|:)"?([^";]+)/g)) {
        expect(['currentColor', 'var(--tool-icon-hue)']).toContain(fill[1]);
      }
      for (const number of body.matchAll(/-?\d*\.\d+|-?\d+/g)) {
        expect(Math.abs(Number(number[0]))).toBeLessThanOrEqual(24);
        expect(number[0].replace(/^-?\d*\.?/, '').length).toBeLessThanOrEqual(3);
      }
    }
  });

  it('follows the subject where there is a natural link', () => {
    expect(TOOL_ICONS['moon-sign'].hue).toBe('cancer');
    expect(TOOL_ICONS['moon-phase'].hue).toBe('cancer');
    expect(TOOL_ICONS['lunar-return'].hue).toBe('cancer');
    expect(TOOL_ICONS.today.hue).toBe('leo');
    expect(TOOL_ICONS['solar-return'].hue).toBe('leo');
    expect(TOOL_ICONS['saturn-return'].hue).toBe('capricorn');
    expect(TOOL_ICONS.compatibility.hue).toBe('libra');
  });

  it('maps every listed route to a page that exists, and every icon to one route', () => {
    for (const path of Object.keys(TOOL_ICON_FOR_PATH)) expect(routeExists(path), path).toBe(true);
    expect(new Set(Object.values(TOOL_ICON_FOR_PATH)).size).toBe(TOOL_ICON_NAMES.length);
    expect(toolIconForPath('/es/moon-sign/')).toBe('moon-sign');
    expect(toolIconForPath('/ru/compatibility/')).toBe('compatibility');
    expect(toolIconForPath('/estonia/')).toBeUndefined();
  });

  it('renders zero JavaScript and stays decorative unless named', () => {
    const component = readFileSync(resolve('src/components/ToolIcon.astro'), 'utf8');
    expect(component).not.toMatch(/<script|client:/);
    expect(component).toContain("aria-hidden={label ? undefined : 'true'}");
    expect(component).toContain("role={label ? 'img' : undefined}");
  });
});
