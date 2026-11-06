/**
 * Saving a finished card image: the native share sheet where the browser can
 * share files, a download otherwise. Kept apart from share-card.ts so the
 * light story cards can use it without loading the chart renderers.
 */
export type CardOutcome = 'shared' | 'downloaded' | 'cancelled';

export interface PreparedChartCard {
  blob: Blob;
  filename: string;
}

/** Explicit download: no native share sheet and no async work before the click. */
export function downloadPreparedChartCard(prepared: PreparedChartCard): 'downloaded' {
  const url = URL.createObjectURL(prepared.blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = prepared.filename;
  try {
    document.body.appendChild(a);
    a.click();
  } finally {
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
  return 'downloaded';
}

export async function savePngBlob(blob: Blob, filename: string): Promise<CardOutcome> {
  const file = new File([blob], filename, { type: 'image/png' });

  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file] });
      return 'shared';
    }
  } catch (err) {
    if ((err as DOMException)?.name === 'AbortError') return 'cancelled';
    // Capability checks and rejected share sheets both retain the download path.
  }

  return downloadPreparedChartCard({ blob, filename: file.name });
}
