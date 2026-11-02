// Browser only: shrinks a picture before it is sent, so a 6 MB phone photo travels (and is stored) as a few hundred KB.

/** The picture as a JPEG whose longest side is at most `maxSide` pixels. Throws when the file is not a picture the browser can read. */
export async function shrinkImage(file: Blob, maxSide: number, quality: number): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', quality));
  if (!blob) throw new Error('Could not shrink the picture.');
  return blob;
}

/** The whole data URL (data:image/jpeg;base64,...). */
export const toDataUrl = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result));
  r.onerror = () => reject(new Error('Could not read the picture.'));
  r.readAsDataURL(blob);
});
