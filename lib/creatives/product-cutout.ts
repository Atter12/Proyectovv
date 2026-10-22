/**
 * Recorte del producto y sus colores, sobre píxeles RGBA (sin dependencias,
 * para tests). Pensado para fotos de catálogo: producto sobre fondo liso.
 * Con fondo cargado (una mesa, una persona) no se recorta y el video usa la
 * foto entera.
 */

export type RgbaImage = { data: Uint8ClampedArray; width: number; height: number };
export type Rgb = [number, number, number];

/** Distancia máxima al color del borde para contar como fondo. */
const BG_TOLERANCE = 34;
/** Parte del borde que tiene que ser del mismo color para decir "fondo liso". */
const UNIFORM_SHARE = 0.9;

function dist(a: Rgb, b: Rgb): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function px(img: RgbaImage, i: number): Rgb {
  return [img.data[i * 4], img.data[i * 4 + 1], img.data[i * 4 + 2]];
}

function borderIndexes(width: number, height: number): number[] {
  const out: number[] = [];
  for (let x = 0; x < width; x++) out.push(x, (height - 1) * width + x);
  for (let y = 1; y < height - 1; y++) out.push(y * width, y * width + width - 1);
  return out;
}

/** Color del borde y si es parejo (fondo liso de catálogo). */
export function borderBackground(img: RgbaImage): { color: Rgb; uniform: boolean } {
  const idx = borderIndexes(img.width, img.height);
  const sum = [0, 0, 0];
  for (const i of idx) {
    const p = px(img, i);
    sum[0] += p[0];
    sum[1] += p[1];
    sum[2] += p[2];
  }
  const color: Rgb = [sum[0] / idx.length, sum[1] / idx.length, sum[2] / idx.length];
  const near = idx.filter((i) => dist(px(img, i), color) <= BG_TOLERANCE).length;
  return { color, uniform: near / idx.length >= UNIFORM_SHARE };
}

/**
 * Máscara del producto (0 = fondo, 255 = producto). Se rellena el fondo desde
 * los bordes, así los blancos dentro del producto (una etiqueta) se quedan.
 * El borde se suaviza para que no se vea serrucho.
 */
export function cutoutMask(img: RgbaImage, bg: Rgb): Uint8ClampedArray {
  const { width: w, height: h } = img;
  const isBg = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  let head = 0;
  let tail = 0;
  for (const i of borderIndexes(w, h)) {
    if (!isBg[i] && dist(px(img, i), bg) <= BG_TOLERANCE) {
      isBg[i] = 1;
      queue[tail++] = i;
    }
  }
  while (head < tail) {
    const i = queue[head++];
    const x = i % w;
    const y = (i - x) / w;
    const next = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1];
    for (const n of next) {
      if (n >= 0 && !isBg[n] && dist(px(img, n), bg) <= BG_TOLERANCE) {
        isBg[n] = 1;
        queue[tail++] = n;
      }
    }
  }
  // Achica un píxel (quita el halo del fondo) y suaviza con un promedio 3×3.
  const solid = new Uint8ClampedArray(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (isBg[i]) continue;
      const edge =
        (x > 0 && isBg[i - 1]) || (x < w - 1 && isBg[i + 1]) || (y > 0 && isBg[i - w]) || (y < h - 1 && isBg[i + w]);
      solid[i] = edge ? 0 : 255;
    }
  }
  const mask = new Uint8ClampedArray(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let total = 0;
      let count = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          total += solid[ny * w + nx];
          count++;
        }
      }
      mask[y * w + x] = Math.round(total / count);
    }
  }
  return mask;
}

/** Rectángulo que ocupa el producto en la máscara, o null si no hay producto. */
export function maskBounds(
  mask: Uint8ClampedArray,
  width: number,
  height: number,
): { x: number; y: number; width: number; height: number } | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (mask[y * width + x] < 128) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/** Si el recorte dejó algo razonable: ni casi todo (no había fondo) ni casi nada. */
export function isUsableCutout(mask: Uint8ClampedArray): boolean {
  let kept = 0;
  for (const v of mask) if (v >= 128) kept++;
  const share = kept / mask.length;
  return share >= 0.04 && share <= 0.92;
}

function luminance([r, g, b]: Rgb): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function rgbToHsl([r, g, b]: Rgb): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return [h * 60, s, l];
}

export function hsl(h: number, s: number, l: number): string {
  return `hsl(${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%)`;
}

/**
 * Colores del producto: hasta 5 grupos (k-means sobre una muestra de píxeles
 * del producto), del más común al menos común.
 */
export function productColors(img: RgbaImage, mask?: Uint8ClampedArray): { color: Rgb; share: number }[] {
  const samples: Rgb[] = [];
  const total = img.width * img.height;
  const step = Math.max(1, Math.floor(total / 4000));
  for (let i = 0; i < total; i += step) {
    if (mask && mask[i] < 128) continue;
    if (!mask && img.data[i * 4 + 3] < 128) continue;
    samples.push(px(img, i));
  }
  if (samples.length === 0) return [];
  const sorted = [...samples].sort((a, b) => luminance(a) - luminance(b));
  const k = Math.min(5, samples.length);
  // Arranque fijo por luminosidad: el resultado no cambia entre corridas.
  let centers: Rgb[] = Array.from({ length: k }, (_, j) => sorted[Math.floor(((j + 0.5) / k) * sorted.length)]);
  let labels = new Array<number>(samples.length).fill(0);
  for (let iter = 0; iter < 10; iter++) {
    labels = samples.map((s) => {
      let best = 0;
      for (let j = 1; j < k; j++) if (dist(s, centers[j]) < dist(s, centers[best])) best = j;
      return best;
    });
    centers = centers.map((c, j) => {
      const group = samples.filter((_, i) => labels[i] === j);
      if (group.length === 0) return c;
      return [0, 1, 2].map((ch) => group.reduce((sum, g) => sum + g[ch], 0) / group.length) as Rgb;
    });
  }
  return centers
    .map((color, j) => ({ color, share: labels.filter((l) => l === j).length / samples.length }))
    .filter((c) => c.share > 0)
    .sort((a, b) => b.share - a.share);
}

export type ProductTheme = {
  bgTop: string;
  bgBottom: string;
  /** Luz detrás del producto (r,g,b). */
  glow: string;
  accent: string;
  accentSoft: string;
};

/**
 * Paleta del video a partir de los colores del producto. El fondo siempre es
 * oscuro (texto blanco legible) y lleva el tono más vivo del producto.
 */
export function themeFromColors(colors: { color: Rgb; share: number }[]): ProductTheme {
  // El tono que manda: el más saturado entre los que pesan algo.
  const candidates = colors.filter((c) => c.share >= 0.06).map((c) => ({ ...c, hsl: rgbToHsl(c.color) }));
  const vivid = candidates
    .filter((c) => c.hsl[2] > 0.08 && c.hsl[2] < 0.92)
    .sort((a, b) => b.hsl[1] - a.hsl[1])[0];
  const hue = vivid?.hsl[0] ?? 220;
  const sat = vivid ? vivid.hsl[1] : 0;
  // Producto sin color (negro, blanco, gris): fondo grafito con acento plateado.
  if (sat < 0.12) {
    return {
      bgTop: hsl(hue, 0.08, 0.17),
      bgBottom: hsl(hue, 0.08, 0.03),
      glow: "220,226,235",
      accent: hsl(hue, 0.12, 0.84),
      accentSoft: hsl(hue, 0.1, 0.66),
    };
  }
  const s = Math.min(0.85, Math.max(0.45, sat));
  const [r, g, b] = hslToRgb(hue, s, 0.72);
  return {
    bgTop: hsl(hue, s * 0.7, 0.2),
    bgBottom: hsl(hue, s * 0.5, 0.04),
    glow: `${r},${g},${b}`,
    accent: hsl(hue, s, 0.72),
    accentSoft: hsl(hue, s * 0.6, 0.58),
  };
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const [r1, g1, b1] =
    hp < 1 ? [c, x, 0] : hp < 2 ? [x, c, 0] : hp < 3 ? [0, c, x] : hp < 4 ? [0, x, c] : hp < 5 ? [x, 0, c] : [c, 0, x];
  const m = l - c / 2;
  return [Math.round((r1 + m) * 255), Math.round((g1 + m) * 255), Math.round((b1 + m) * 255)];
}
