/** Only our small, re-encoded JPEGs can become profile images. No remote URLs or SVG. */
export const PHOTO_LIMIT = 100_000;

export function cleanProfilePhoto(value: unknown): string | null {
  return typeof value === 'string' && value.length <= PHOTO_LIMIT
    && /^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]+={0,2}$/u.test(value)
    ? value : null;
}

/** Cropping and re-encoding removes image metadata and keeps browser storage small. */
export async function prepareProfilePhoto(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5_000_000) {
    throw new Error('Choose a JPG, PNG, or WebP photo under 5 MB.');
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    if (!img.naturalWidth || !img.naturalHeight || img.naturalWidth * img.naturalHeight > 40_000_000) {
      throw new Error('Choose a smaller photo.');
    }
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('This browser cannot prepare a photo.');
    const edge = Math.min(img.naturalWidth, img.naturalHeight);
    ctx.drawImage(img, (img.naturalWidth - edge) / 2, (img.naturalHeight - edge) / 2, edge, edge, 0, 0, 256, 256);
    const photo = cleanProfilePhoto(canvas.toDataURL('image/jpeg', 0.82));
    if (!photo) throw new Error('Choose a smaller photo.');
    return photo;
  } catch (error) {
    throw error instanceof Error && !['EncodingError', 'InvalidStateError'].includes(error.name)
      ? error : new Error('This photo could not be opened. Try a JPG or PNG.');
  } finally {
    URL.revokeObjectURL(url);
  }
}
