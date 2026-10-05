import { describe, expect, it } from 'vitest';
import { A2HS_HINT_KEY, a2hsPlatform, claimA2hsHint } from './a2hs';

const IOS_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 Version/18.5 Mobile/15E148 Safari/604.1';
const IPADOS_SAFARI = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.5 Mobile/15E148 Safari/604.1';
const MACOS_SAFARI = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.5 Safari/605.1.15';
const ANDROID_CHROME = 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/136.0.0.0 Mobile Safari/537.36';

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    values,
  };
}

describe('home-screen hint', () => {
  it('recognizes only the two supported mobile browser instructions', () => {
    expect(a2hsPlatform(IOS_SAFARI)).toBe('ios');
    expect(a2hsPlatform(IPADOS_SAFARI)).toBe('ios');
    expect(a2hsPlatform(ANDROID_CHROME)).toBe('android');
    expect(a2hsPlatform(IOS_SAFARI.replace('Version/18.5', 'CriOS/136.0.0.0'))).toBeNull();
    expect(a2hsPlatform(IPADOS_SAFARI.replace('Version/18.5', 'CriOS/136.0.0.0'))).toBeNull();
    expect(a2hsPlatform(MACOS_SAFARI)).toBeNull();
    expect(a2hsPlatform('Mozilla/5.0 (Macintosh) Chrome/136.0.0.0 Safari/537.36')).toBeNull();
  });

  it('claims the hint once and returns localized copy', () => {
    const storage = memoryStorage();
    expect(claimA2hsHint('es', IOS_SAFARI, storage)).toEqual({
      platform: 'ios',
      message: 'Para tener tus cartas guardadas a mano, toca Compartir → Agregar a inicio. Los avisos del cielo en iPhone y iPad solo funcionan desde el sitio instalado.',
      dismissLabel: 'Descartar indicación de pantalla de inicio',
    });
    expect(storage.values.get(A2HS_HINT_KEY)).toBe('1');
    expect(claimA2hsHint('en', IOS_SAFARI, storage)).toBeNull();
  });

  it('omits the hint when persistence is unavailable', () => {
    const storage = {
      getItem: () => null,
      setItem: () => { throw new Error('blocked'); },
    };
    expect(claimA2hsHint('en', ANDROID_CHROME, storage)).toBeNull();
  });
});
