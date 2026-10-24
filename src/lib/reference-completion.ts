import { trackAnalytics } from './analytics';

export function completeReferenceTask(now = Date.now()): boolean {
  try {
    const key = 'zodiacs:reference-task';
    const marker = JSON.parse(sessionStorage.getItem(key) || 'null');
    sessionStorage.removeItem(key);
    if (!['hub', 'sun-moon', 'moon-venus', 'moon-mars'].includes(marker?.page)
      || !Number.isFinite(marker?.expires) || marker.expires <= now
      || marker.expires > now + 30 * 60 * 1000) return false;
    trackAnalytics('reference_task_completed', {
      topic: 'synastry', page: marker.page, locale: 'en', task: 'comparison', destination: 'compatibility',
    });
    return true;
  } catch { return false; }
}
