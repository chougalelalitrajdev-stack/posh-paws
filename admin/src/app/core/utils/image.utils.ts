/** Accepted image types for uploads. */
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** Max file size before resizing (10 MB). */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/** Shrinks an image so its longest side is at most `maxSide` px and returns it as a JPEG. */
export async function resizeImage(file: File, maxSide: number, quality = 0.85): Promise<Blob> {
  if (!IMAGE_TYPES.includes(file.type)) throw new Error('Use a JPG, PNG or WebP image.');
  if (file.size > MAX_IMAGE_BYTES) throw new Error('That image is over 10 MB. Pick a smaller one.');
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Could not process that image.'))), 'image/jpeg', quality));
}
