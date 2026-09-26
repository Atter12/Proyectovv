/** MP4 de un tutorial. El archivo no pasa por el formulario: se sube directo al storage. */
export const EDUCATION_VIDEO_MAX_BYTES = 150 * 1024 * 1024;

export function isEducationMp4(head: Uint8Array, size: number): boolean {
  if (!Number.isFinite(size) || size < 12 || size > EDUCATION_VIDEO_MAX_BYTES) return false;
  if (head.length < 8) return false;
  return (
    head[4] === 0x66 &&
    head[5] === 0x74 &&
    head[6] === 0x79 &&
    head[7] === 0x70
  );
}
