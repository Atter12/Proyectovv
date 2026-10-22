"use client";

import {
  buildStudioTimeline,
  cleanBenefits,
  formatStudioPrice,
  sceneAt,
  STUDIO_DURATION,
  STUDIO_HEIGHT,
  STUDIO_WIDTH,
  type StudioInput,
  type StudioScene,
  type StudioTemplate,
} from "@/lib/creatives/video-studio";
import {
  borderBackground,
  cutoutMask,
  isUsableCutout,
  maskBounds,
  productColors,
  themeFromColors,
  type ProductTheme,
} from "@/lib/creatives/product-cutout";

/**
 * Dibuja y graba el video del estudio en el navegador (canvas + MediaRecorder).
 * Estilo de anuncio de producto: el producto recortado sobre un fondo con sus
 * colores, acercamientos a la etiqueta y al detalle, brillo que pasa por el
 * producto, reflejo en el piso y cortes con destello al ritmo de la música
 * (Web Audio, así el mp4 sale con sonido sin pistas externas).
 */

/** Producto listo para dibujar: recortado si la foto tenía fondo liso. */
export type PreparedProduct = {
  canvas: HTMLCanvasElement;
  cut: boolean;
  reflection: HTMLCanvasElement | null;
  theme: ProductTheme;
};

export type StudioMedia =
  | { kind: "image"; el: ImageBitmap | HTMLImageElement; width: number; height: number; prepared?: PreparedProduct }
  | { kind: "video"; el: HTMLVideoElement; width: number; height: number; prepared?: undefined };

type Theme = ProductTheme & { ink: string };

const FIXED_THEMES: Record<Exclude<StudioTemplate, "auto">, Theme> = {
  orange: { bgTop: "hsl(22 70% 22%)", bgBottom: "hsl(22 60% 4%)", glow: "255,170,110", accent: "#ff9a52", accentSoft: "#e8763a", ink: "#140904" },
  dark: { bgTop: "hsl(240 4% 17%)", bgBottom: "hsl(240 6% 3%)", glow: "245,215,140", accent: "#f5c451", accentSoft: "#c99a2e", ink: "#0b0b0d" },
  fresh: { bgTop: "hsl(172 60% 18%)", bgBottom: "hsl(172 50% 4%)", glow: "120,240,220", accent: "#4fe3cf", accentSoft: "#21b3a2", ink: "#03130f" },
};
const FALLBACK_AUTO: Theme = { bgTop: "hsl(212 55% 20%)", bgBottom: "hsl(212 45% 4%)", glow: "156,195,230", accent: "hsl(210 60% 76%)", accentSoft: "hsl(210 35% 60%)", ink: "#05070a" };

const W = STUDIO_WIDTH;
const H = STUDIO_HEIGHT;
const TEXT_LEFT = 54;
/** Margen derecho: ahí van los botones de TikTok. */
const SAFE_RIGHT = 110;
const CUT_FLASH = 0.25;
/** Más de esto la foto se ve pixelada. */
const MAX_UPSCALE = 3;

const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const easeOut = (x: number) => 1 - Math.pow(1 - clamp(x), 3);
const backOut = (x: number) => {
  const c = 1.7;
  const p = clamp(x) - 1;
  return 1 + (c + 1) * p * p * p + c * p * p;
};

function fonts(): { display: string; body: string } {
  if (typeof document === "undefined") return { display: "sans-serif", body: "sans-serif" };
  const root = getComputedStyle(document.documentElement);
  const sora = root.getPropertyValue("--font-sora").trim();
  const jakarta = root.getPropertyValue("--font-jakarta").trim();
  return {
    display: [sora, jakarta, "system-ui", "sans-serif"].filter(Boolean).join(", "),
    body: [jakarta, sora, "system-ui", "sans-serif"].filter(Boolean).join(", "),
  };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Parte el texto en líneas que entran en `maxWidth` (máximo `maxLines`, con "…"). */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth || !line) {
      line = next;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = `${kept[maxLines - 1].replace(/\s+\S*$/, "")}…`;
    return kept;
  }
  return lines;
}

/** Número pseudoaleatorio fijo por índice (las chispas no saltan entre cuadros). */
function seeded(i: number): number {
  const x = Math.sin(i * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/* ------------------------- preparar el producto ------------------------- */

/** Lado largo máximo para recortar (rápido y suficiente para 720×1280). */
const PREP_MAX = 1100;

/**
 * Recorta el fondo si es liso (fotos de catálogo) y saca los colores del
 * producto. Si el fondo es cargado, deja la foto entera.
 */
export function prepareProduct(el: CanvasImageSource, width: number, height: number): PreparedProduct {
  const scale = Math.min(1, PREP_MAX / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  const src = document.createElement("canvas");
  src.width = w;
  src.height = h;
  const sctx = src.getContext("2d", { willReadFrequently: true })!;
  sctx.drawImage(el, 0, 0, w, h);
  const pixels = sctx.getImageData(0, 0, w, h);
  const img = { data: pixels.data, width: w, height: h };

  const bg = borderBackground(img);
  const mask = bg.uniform ? cutoutMask(img, bg.color) : null;
  if (!mask || !isUsableCutout(mask)) {
    return { canvas: src, cut: false, reflection: null, theme: themeFromColors(productColors(img)) };
  }
  for (let i = 0; i < mask.length; i++) pixels.data[i * 4 + 3] = mask[i];
  sctx.putImageData(pixels, 0, 0);
  const box = maskBounds(mask, w, h) ?? { x: 0, y: 0, width: w, height: h };
  const canvas = document.createElement("canvas");
  canvas.width = box.width;
  canvas.height = box.height;
  canvas.getContext("2d")!.drawImage(src, box.x, box.y, box.width, box.height, 0, 0, box.width, box.height);

  // Reflejo: el producto de cabeza que se desvanece.
  const reflection = document.createElement("canvas");
  reflection.width = box.width;
  reflection.height = box.height;
  const rctx = reflection.getContext("2d")!;
  rctx.translate(0, box.height);
  rctx.scale(1, -1);
  rctx.drawImage(canvas, 0, 0);
  rctx.setTransform(1, 0, 0, 1, 0, 0);
  rctx.globalCompositeOperation = "destination-in";
  const fade = rctx.createLinearGradient(0, 0, 0, box.height);
  fade.addColorStop(0, "rgba(0,0,0,0.9)");
  fade.addColorStop(0.45, "rgba(0,0,0,0)");
  rctx.fillStyle = fade;
  rctx.fillRect(0, 0, box.width, box.height);

  return { canvas, cut: true, reflection, theme: themeFromColors(productColors(img, mask)) };
}

/* ------------------------------- dibujo ------------------------------- */

type DrawContext = {
  ctx: CanvasRenderingContext2D;
  input: StudioInput;
  media: StudioMedia[];
  scenes: StudioScene[];
  theme: Theme;
  font: { display: string; body: string };
  benefits: string[];
};

function themeFor(input: StudioInput, media: StudioMedia[]): Theme {
  if (input.template !== "auto") return FIXED_THEMES[input.template];
  const prepared = media.find((m) => m.prepared)?.prepared;
  return prepared ? { ...prepared.theme, ink: "#05070a" } : FALLBACK_AUTO;
}

function drawBackground(c: DrawContext, opts: { brighter?: boolean } = {}) {
  const { ctx, theme } = c;
  const g = ctx.createRadialGradient(W / 2, H * 0.36, 40, W / 2, H * 0.4, H * 0.75);
  g.addColorStop(0, theme.bgTop);
  g.addColorStop(opts.brighter ? 0.6 : 0.45, theme.bgBottom);
  g.addColorStop(1, "#020203");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // Haz de luz desde arriba
  const beam = ctx.createRadialGradient(W / 2, 120, 10, W / 2, 260, 520);
  beam.addColorStop(0, `rgba(${theme.glow},${opts.brighter ? 0.42 : 0.3})`);
  beam.addColorStop(1, `rgba(${theme.glow},0)`);
  ctx.fillStyle = beam;
  ctx.fillRect(0, 0, W, H);
}

function vignette(ctx: CanvasRenderingContext2D) {
  const v = ctx.createRadialGradient(W / 2, H * 0.45, H * 0.35, W / 2, H * 0.45, H * 0.85);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
}

function floorGlow(ctx: CanvasRenderingContext2D, theme: Theme, cx: number, y: number, w: number, alpha: number) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(cx, y);
  ctx.scale(1, 0.16);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, w / 2);
  g.addColorStop(0, `rgba(${theme.glow},0.5)`);
  g.addColorStop(1, `rgba(${theme.glow},0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, w / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

let shineCanvas: HTMLCanvasElement | null = null;

/** Brillo diagonal que recorre el producto (solo sobre el producto, no sobre el fondo). */
function drawShine(ctx: CanvasRenderingContext2D, source: CanvasImageSource, x: number, y: number, w: number, h: number, p: number) {
  if (p <= 0 || p >= 1 || w < 2 || h < 2) return;
  if (typeof document === "undefined") return;
  shineCanvas ??= document.createElement("canvas");
  const sw = Math.min(900, Math.ceil(w));
  const sh = Math.min(1600, Math.ceil(h));
  shineCanvas.width = sw;
  shineCanvas.height = sh;
  const s = shineCanvas.getContext("2d")!;
  s.clearRect(0, 0, sw, sh);
  s.drawImage(source, 0, 0, sw, sh);
  s.globalCompositeOperation = "source-in";
  const band = s.createLinearGradient(0, 0, sw, sh * 0.35);
  const center = -0.3 + p * 1.6;
  band.addColorStop(clamp(center - 0.12), "rgba(255,255,255,0)");
  band.addColorStop(clamp(center), "rgba(255,255,255,0.55)");
  band.addColorStop(clamp(center + 0.12), "rgba(255,255,255,0)");
  s.fillStyle = band;
  s.fillRect(0, 0, sw, sh);
  s.globalCompositeOperation = "source-over";
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.drawImage(shineCanvas, x, y, w, h);
  ctx.restore();
}

type ProductPose = {
  cx: number;
  cy: number;
  /** Alto en pantalla. */
  h: number;
  rot?: number;
  alpha?: number;
  shine?: number;
  reflection?: boolean;
};

/** Producto con sombra; recortado flota libre, si no va como tarjeta con esquinas redondeadas. */
function drawProduct(c: DrawContext, m: StudioMedia | undefined, pose: ProductPose) {
  if (!m) return;
  const { ctx } = c;
  const prepared = m.prepared;
  const source: CanvasImageSource = prepared?.canvas ?? m.el;
  const sw = prepared?.canvas.width ?? m.width;
  const shh = prepared?.canvas.height ?? m.height;
  if (sw <= 0 || shh <= 0) return;
  // Nunca más grande que MAX_UPSCALE veces la foto original.
  const h = Math.min(pose.h, shh * MAX_UPSCALE);
  const w = (h * sw) / shh;
  const x = pose.cx - w / 2;
  const y = pose.cy - h / 2;
  const cut = prepared?.cut ?? false;
  ctx.save();
  ctx.globalAlpha *= pose.alpha ?? 1;
  if (pose.rot) {
    ctx.translate(pose.cx, pose.cy);
    ctx.rotate((pose.rot * Math.PI) / 180);
    ctx.translate(-pose.cx, -pose.cy);
  }
  if (cut && pose.reflection && prepared?.reflection) {
    ctx.save();
    ctx.globalAlpha *= 0.22;
    ctx.drawImage(prepared.reflection, x, y + h - 2, w, h);
    ctx.restore();
  }
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 26;
  ctx.imageSmoothingQuality = "high";
  if (cut) {
    ctx.drawImage(source, x, y, w, h);
    ctx.shadowColor = "transparent";
    drawShine(ctx, source, x, y, w, h, pose.shine ?? 0);
  } else {
    roundRect(ctx, x, y, w, h, 26);
    ctx.fillStyle = "#000";
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.clip();
    ctx.drawImage(source, x, y, w, h);
  }
  ctx.restore();
}

/** Acercamiento: el punto (fx, fy) del producto queda en (sx, sy) de la pantalla. */
function punchPose(m: StudioMedia, fx: number, fy: number, sx: number, sy: number, h: number): ProductPose {
  const sw = m.prepared?.canvas.width ?? m.width;
  const shh = m.prepared?.canvas.height ?? m.height;
  const realH = Math.min(h, shh * MAX_UPSCALE);
  const w = (realH * sw) / shh;
  return { cx: sx + (0.5 - fx) * w, cy: sy + (0.5 - fy) * realH, h: realH };
}

function drawFullBleed(c: DrawContext, m: StudioMedia, progress: number) {
  const { ctx, theme } = c;
  const scale = Math.max(W / m.width, H / m.height) * (1.02 + 0.06 * progress);
  const dw = m.width * scale;
  const dh = m.height * scale;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(m.el, (W - dw) / 2, (H - dh) / 2, dw, dh);
  const g = ctx.createLinearGradient(0, H * 0.45, 0, H);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, theme.bgBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

/** Relleno en degradado para palabras clave y el precio. */
function accentFill(ctx: CanvasRenderingContext2D, theme: Theme, x: number, w: number) {
  const g = ctx.createLinearGradient(x, 0, x + Math.max(w, 1), 0);
  g.addColorStop(0, theme.accent);
  g.addColorStop(1, "#ffffff");
  return g;
}

/** Texto que entra palabra por palabra. Con varias líneas, la última va en el color del producto. */
function kinetic(
  c: DrawContext,
  lines: string[],
  opts: { x: number; y: number; lineHeight: number; t: number; align: "left" | "center"; accentLast?: boolean },
) {
  const { ctx, theme } = c;
  ctx.save();
  ctx.textAlign = "left";
  let wordIndex = 0;
  lines.forEach((line, li) => {
    const lineWidth = ctx.measureText(line).width;
    const startX = opts.align === "center" ? opts.x - lineWidth / 2 : opts.x;
    let cursor = startX;
    const accent = (opts.accentLast ?? true) && li === lines.length - 1 && lines.length > 1;
    for (const word of line.split(" ")) {
      const k = easeOut((opts.t - wordIndex * 0.08) / 0.4);
      ctx.save();
      ctx.globalAlpha *= k;
      ctx.fillStyle = accent ? accentFill(ctx, theme, startX, lineWidth) : "#ffffff";
      ctx.fillText(word, cursor, opts.y + li * opts.lineHeight + (1 - k) * 28);
      ctx.restore();
      cursor += ctx.measureText(`${word} `).width;
      wordIndex++;
    }
  });
  ctx.restore();
}

function kicker(c: DrawContext, text: string, x: number, y: number, k: number, align: "left" | "center" = "left") {
  if (!text.trim() || k <= 0) return;
  const { ctx, font } = c;
  ctx.save();
  ctx.globalAlpha *= k;
  ctx.font = `700 19px ${font.body}`;
  ctx.letterSpacing = "6px";
  ctx.fillStyle = "rgba(255,255,255,0.78)";
  ctx.textAlign = align;
  ctx.fillText(text.trim().toUpperCase(), x, y + (1 - k) * 16);
  ctx.restore();
}

/** Sticker inclinado de la promo. */
function sticker(c: DrawContext, text: string, x: number, y: number, k: number) {
  if (!text.trim() || k <= 0) return;
  const { ctx, theme, font } = c;
  ctx.save();
  ctx.font = `700 26px ${font.body}`;
  const label = text.trim().toUpperCase();
  const w = ctx.measureText(label).width + 44;
  ctx.translate(x + w / 2, y + 28);
  ctx.rotate(-0.1);
  const s = 0.4 + 0.6 * backOut(k);
  ctx.scale(s, s);
  ctx.globalAlpha *= clamp(k * 3);
  ctx.shadowColor = "rgba(0,0,0,0.4)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 10;
  const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(1, theme.accent);
  ctx.fillStyle = g;
  roundRect(ctx, -w / 2, -28, w, 56, 14);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.fillStyle = theme.ink;
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.fillText(label, 0, 2);
  ctx.restore();
}

/** Beneficio en cápsula de vidrio con check. */
function chip(c: DrawContext, text: string, x: number, y: number, k: number) {
  if (k <= 0) return;
  const { ctx, theme, font } = c;
  ctx.save();
  ctx.globalAlpha *= clamp(k * 2);
  ctx.translate(x + (1 - easeOut(k)) * -54, y);
  ctx.font = `700 27px ${font.body}`;
  const label = wrap(ctx, text, W - x - SAFE_RIGHT - 90, 1)[0] ?? "";
  const w = ctx.measureText(label).width + 98;
  ctx.fillStyle = "rgba(255,255,255,0.1)";
  roundRect(ctx, 0, 0, w, 66, 20);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  const g = ctx.createLinearGradient(16, 14, 52, 50);
  g.addColorStop(0, theme.accent);
  g.addColorStop(1, theme.accentSoft);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(35, 33, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = theme.ink;
  ctx.lineWidth = 4.5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(27, 34);
  ctx.lineTo(33, 40);
  ctx.lineTo(44, 27);
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "middle";
  ctx.fillText(label, 66, 35);
  ctx.restore();
}

function sparkles(c: DrawContext, local: number) {
  const { ctx, theme } = c;
  ctx.save();
  for (let i = 0; i < 22; i++) {
    const ph = (local * 0.45 + seeded(i)) % 1;
    const x = 130 + seeded(i + 50) * 460 + Math.sin(ph * 6 + i) * 14;
    const y = 330 + seeded(i + 99) * 540 - ph * 280;
    const a = Math.sin(ph * Math.PI) * clamp(local / 0.3);
    ctx.globalAlpha = a;
    const g = ctx.createRadialGradient(x, y, 0, x, y, 9);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.4, `rgba(${theme.glow},0.8)`);
    g.addColorStop(1, `rgba(${theme.glow},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - 9, y - 9, 18, 18);
  }
  ctx.restore();
}

/** Tipo de toma de cada tramo de producto, rotando para que no se repita. */
type Shot = "label" | "side" | "detail";
const SHOTS: Shot[] = ["label", "side", "detail"];

/**
 * Foto de ambiente (sin fondo liso) con buena resolución: va a pantalla
 * completa y la "cámara" se mueve sobre ella. Una tarjetita chica se ve amateur.
 */
function isPhoto(m: StudioMedia | undefined): m is StudioMedia {
  return m?.kind === "image" && !m.prepared?.cut && Math.min(m.width, m.height) >= 480;
}

let blurCanvas: HTMLCanvasElement | null = null;
let fadeCanvas: HTMLCanvasElement | null = null;

/**
 * Foto completa a lo ancho (se ve todo el producto), sobre la misma foto muy
 * desenfocada que llena la pantalla; los bordes de arriba y abajo se funden.
 * `scale` mueve la cámara apenas (1 = foto entera); (fx, fy) es el punto al
 * que se acerca. El desenfoque se hace achicando la foto y estirándola:
 * funciona en todos los navegadores (Safari no tiene ctx.filter).
 */
function drawPhoto(c: DrawContext, m: StudioMedia, opts: { scale: number; fx?: number; fy?: number; dx?: number }) {
  const { ctx } = c;
  if (typeof document === "undefined") return;
  blurCanvas ??= document.createElement("canvas");
  const bw = 40;
  const bh = Math.max(1, Math.round((bw * m.height) / m.width));
  blurCanvas.width = bw;
  blurCanvas.height = bh;
  const b = blurCanvas.getContext("2d")!;
  b.drawImage(m.el, 0, 0, bw, bh);
  const cover = Math.max(W / m.width, H / m.height) * 1.1;
  ctx.save();
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(blurCanvas, (W - m.width * cover) / 2, (H - m.height * cover) / 2, m.width * cover, m.height * cover);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  // Foto nítida: ancho completo, centrada encima de la zona de textos.
  const fit = Math.min(W / m.width, (H * 0.72) / m.height);
  const s = fit * opts.scale;
  const dw = m.width * s;
  const dh = m.height * s;
  const cx = W / 2 + (opts.dx ?? 0) - ((opts.fx ?? 0.5) - 0.5) * (dw - m.width * fit);
  const cy = H * 0.4 - ((opts.fy ?? 0.5) - 0.5) * (dh - m.height * fit);
  fadeCanvas ??= document.createElement("canvas");
  fadeCanvas.width = Math.ceil(dw);
  fadeCanvas.height = Math.ceil(dh);
  const f = fadeCanvas.getContext("2d")!;
  f.imageSmoothingQuality = "high";
  f.drawImage(m.el, 0, 0, dw, dh);
  f.globalCompositeOperation = "destination-in";
  const edge = f.createLinearGradient(0, 0, 0, dh);
  edge.addColorStop(0, "rgba(0,0,0,0)");
  edge.addColorStop(0.1, "rgba(0,0,0,1)");
  edge.addColorStop(0.88, "rgba(0,0,0,1)");
  edge.addColorStop(1, "rgba(0,0,0,0)");
  f.fillStyle = edge;
  f.fillRect(0, 0, dw, dh);
  f.globalCompositeOperation = "source-over";
  ctx.drawImage(fadeCanvas, cx - dw / 2, cy - dh / 2, dw, dh);
}

/** Degradado oscuro del color del video donde va texto (arriba o abajo). */
function shade(c: DrawContext, edge: "top" | "bottom", size: number, strength = 0.92) {
  const { ctx, theme } = c;
  const y0 = edge === "top" ? 0 : H - size;
  const g = ctx.createLinearGradient(0, edge === "top" ? size : y0, 0, edge === "top" ? 0 : H);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(0.55, theme.bgBottom);
  g.addColorStop(1, theme.bgBottom);
  ctx.save();
  ctx.globalAlpha *= strength;
  ctx.fillStyle = g;
  ctx.fillRect(0, y0, W, size);
  ctx.restore();
}

function drawScene(c: DrawContext, scene: StudioScene, t: number) {
  const { ctx, input, media, theme, font } = c;
  const local = t - scene.start;
  const progress = clamp(local / (scene.end - scene.start));
  ctx.save();
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  if (scene.kind === "hook") {
    const m = media[0];
    if (isPhoto(m)) {
      // Se aleja despacio: arranca encima del producto.
      drawPhoto(c, m, { scale: 1.08 - 0.08 * easeOut(local / 2.4) });
      shade(c, "top", 220, 0.7);
      shade(c, "bottom", 560);
    } else {
      drawBackground(c);
      const k = easeOut(local / 1.1);
      floorGlow(ctx, theme, W / 2, 830, 520, k);
      drawProduct(c, m, { cx: W / 2, cy: 500 + (1 - k) * 170, h: 650 * (0.92 + 0.08 * k) + local * 8, alpha: clamp(local / 0.35), shine: (local - 0.9) / 1.2, reflection: true });
    }
    kicker(c, input.storeName, W / 2, 86, easeOut(local / 0.5), "center");
    ctx.font = `700 52px ${font.display}`;
    const lines = wrap(ctx, input.hook.trim() || input.productName, W - 110, 3);
    kinetic(c, lines, { x: W / 2, y: 930, lineHeight: 62, t: local - 0.3, align: "center" });
    vignette(ctx);
    ctx.restore();
    return;
  }

  if (scene.kind === "media") {
    const m = media[scene.mediaIndex] ?? media[0];
    const slot = c.scenes.filter((s) => s.kind === "media").indexOf(scene);
    const shot = SHOTS[slot % SHOTS.length];

    if (m?.kind === "video" && m.height > m.width && m.height >= 900) {
      // Clip vertical bueno: a pantalla completa con los beneficios encima.
      drawFullBleed(c, m, progress);
      ctx.font = `700 46px ${font.display}`;
      const name = wrap(ctx, input.productName, W - TEXT_LEFT - SAFE_RIGHT, 2);
      kinetic(c, name, { x: TEXT_LEFT, y: 760, lineHeight: 54, t: local - 0.1, align: "left", accentLast: false });
      if (scene.benefit) chip(c, scene.benefit, TEXT_LEFT, 790 + (name.length - 1) * 54, (local - 0.3) / 0.45);
      ctx.restore();
      return;
    }

    if (shot === "label") {
      // Acercamiento a la etiqueta; el texto arriba sobre una franja oscura.
      if (isPhoto(m)) {
        drawPhoto(c, m, { scale: 1 + 0.06 * progress, fy: 0.45 });
        shade(c, "bottom", 600, 1);
      } else {
        drawBackground(c);
        if (m) drawProduct(c, m, { ...punchPose(m, 0.5, 0.42, W / 2, 660, 1270 + local * 100), shine: local / 1.6 });
      }
      const band = ctx.createLinearGradient(0, 0, 0, 350);
      band.addColorStop(0.35, theme.bgBottom);
      band.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = band;
      ctx.fillRect(0, 0, W, 350);
      kicker(c, input.storeName, TEXT_LEFT, 110, easeOut((local - 0.1) / 0.4));
      ctx.font = `700 50px ${font.display}`;
      const name = wrap(ctx, input.productName, W - TEXT_LEFT - SAFE_RIGHT, 2);
      kinetic(c, name, { x: TEXT_LEFT, y: 172, lineHeight: 58, t: local - 0.25, align: "left" });
      vignette(ctx);
      ctx.restore();
      return;
    }

    if (shot === "side") {
      // Producto a la derecha con giro suave; beneficios abajo a la izquierda.
      if (isPhoto(m)) {
        // Paneo de lado a lado; los beneficios sobre la franja de abajo.
        drawPhoto(c, m, { scale: 1.04, dx: -20 + 40 * easeOut(progress) });
        shade(c, "top", 260, 0.6);
        shade(c, "bottom", 520);
        sticker(c, input.promo, TEXT_LEFT - 6, 130, (local - 0.4) / 0.45);
        const items = c.benefits.length > 0 ? c.benefits : [input.productName];
        items.forEach((b, i) => chip(c, b, TEXT_LEFT - 8, 880 + i * 80, (local - 0.4 - i * 0.55) / 0.45));
        vignette(ctx);
        ctx.restore();
        return;
      }
      drawBackground(c);
      for (const [i, size, alpha] of [[0, 470, 0.5], [1, 340, 0.4]] as const) {
        const ox = i === 0 ? 350 + Math.sin(t * 0.6) * 80 : -50 + Math.cos(t * 0.7) * 70;
        const oy = i === 0 ? 200 + Math.cos(t * 0.5) * 70 : 600 + Math.sin(t * 0.6) * 80;
        const orb = ctx.createRadialGradient(ox + size / 2, oy + size / 2, 0, ox + size / 2, oy + size / 2, size / 2);
        orb.addColorStop(0, `rgba(${theme.glow},${alpha * 0.55})`);
        orb.addColorStop(1, `rgba(${theme.glow},0)`);
        ctx.fillStyle = orb;
        ctx.fillRect(ox, oy, size, size);
      }
      const k = easeOut(local / 0.8);
      floorGlow(ctx, theme, 500, 820, 360, 1);
      if (m) drawProduct(c, m, { cx: 500 + (1 - k) * 130, cy: 510 + Math.sin(t * 1.5) * 7, h: 620, rot: -6 + 6 * k, shine: (local - 1.1) / 1.2, reflection: true });
      sticker(c, input.promo, TEXT_LEFT - 6, 130, (local - 0.4) / 0.45);
      const list = c.benefits.length > 0 ? c.benefits : [input.productName];
      list.forEach((b, i) => chip(c, b, TEXT_LEFT - 8, 880 + i * 80, (local - 0.4 - i * 0.55) / 0.45));
      vignette(ctx);
      ctx.restore();
      return;
    }

    // Detalle: acercamiento a la base del producto con chispas.
    if (isPhoto(m)) {
      drawPhoto(c, m, { scale: 1.12 + 0.06 * progress, fy: 0.6 });
    } else {
      drawBackground(c);
      if (m) drawProduct(c, m, { ...punchPose(m, 0.5, 0.85, W / 2, 500, 1430 - local * 100), shine: local / 1.4 });
    }
    sparkles(c, local);
    const band = ctx.createLinearGradient(0, 760, 0, H);
    band.addColorStop(0, "rgba(0,0,0,0)");
    band.addColorStop(0.4, theme.bgBottom);
    ctx.fillStyle = band;
    ctx.fillRect(0, 760, W, H - 760);
    ctx.font = `700 50px ${font.display}`;
    const line = wrap(ctx, scene.benefit ?? input.productName, W - 120, 2);
    kinetic(c, line, { x: W / 2, y: 940, lineHeight: 60, t: local - 0.2, align: "center" });
    vignette(ctx);
    ctx.restore();
    return;
  }

  if (scene.kind === "price") {
    const m = media[scene.mediaIndex] ?? media[0];
    if (isPhoto(m)) {
      drawPhoto(c, m, { scale: 0.92 + 0.03 * progress });
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.fillRect(0, 0, W, H);
      shade(c, "bottom", 680);
    } else {
      drawBackground(c);
      const k = easeOut(local / 0.6);
      floorGlow(ctx, theme, W / 2, 610, 420, k);
      drawProduct(c, m, { cx: W / 2, cy: 370 + (1 - k) * 60 + Math.sin(t * 1.5) * 6, h: 500, shine: (local - 1.3) / 1.0 });
    }
    const enter = easeOut((local - 0.3) / 0.45);
    const top = 700 + (1 - enter) * 50;
    ctx.save();
    ctx.globalAlpha *= enter;
    // Vidrio oscuro: se lee igual sobre una foto clara o un fondo de color.
    roundRect(ctx, TEXT_LEFT, top, W - TEXT_LEFT * 2, 300, 34);
    ctx.fillStyle = "rgba(0,0,0,0.38)";
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.24)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.textAlign = "center";
    const old = formatStudioPrice(input.oldPrice, input.currency);
    const price = formatStudioPrice(input.price, input.currency);
    if (old) {
      ctx.font = `600 32px ${font.body}`;
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      const label = `${input.labels?.before ?? "Antes"} ${old}`;
      ctx.fillText(label, W / 2, top + 66);
      const w = ctx.measureText(label).width;
      ctx.strokeStyle = "#ff5a5f";
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(W / 2 - w / 2 - 6, top + 55);
      ctx.lineTo(W / 2 - w / 2 - 6 + (w + 12) * easeOut((local - 0.75) / 0.35), top + 55);
      ctx.stroke();
    }
    ctx.restore();
    kicker(c, old ? input.labels?.today ?? "Hoy" : input.labels?.price ?? "Precio", W / 2, top + (old ? 108 : 78), enter, "center");
    const pop = backOut((local - 0.8) / 0.5);
    if (local > 0.8) {
      ctx.save();
      ctx.translate(W / 2, top + (old ? 222 : 200));
      ctx.scale(0.4 + 0.6 * pop, 0.4 + 0.6 * pop);
      ctx.globalAlpha *= clamp((local - 0.8) / 0.15);
      ctx.font = `700 132px ${font.display}`;
      ctx.textAlign = "center";
      const pw = ctx.measureText(price).width;
      ctx.fillStyle = accentFill(ctx, theme, -pw / 2, pw);
      ctx.fillText(price, 0, 44);
      ctx.restore();
    }
    sticker(c, input.promo, TEXT_LEFT, 110, (local - 1.3) / 0.45);
    vignette(ctx);
    ctx.restore();
    return;
  }

  // Cierre
  const k = easeOut(local / 0.7);
  if (isPhoto(media[0])) {
    drawPhoto(c, media[0], { scale: 1 + 0.04 * progress });
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = theme.bgBottom;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    shade(c, "bottom", 760);
  } else {
    drawBackground(c, { brighter: true });
    drawProduct(c, media[0], { cx: W / 2, cy: 400 + Math.sin(t * 1.4) * 6, h: 470 * (0.85 + 0.15 * k), alpha: k, shine: (local - 0.6) / 1.0 });
  }
  ctx.font = `700 70px ${font.display}`;
  const lines = wrap(ctx, input.cta, W - 120, 2);
  kinetic(c, lines, { x: W / 2, y: 760, lineHeight: 80, t: local - 0.2, align: "center" });
  if (local > 0.85) {
    const bk = backOut((local - 0.85) / 0.5);
    const label = input.labels?.button ?? "Escríbenos";
    ctx.save();
    ctx.font = `700 30px ${font.body}`;
    const bw = ctx.measureText(`${label}  ›`).width + 80;
    const by = 760 + lines.length * 80 + 10;
    ctx.translate(W / 2, by);
    ctx.scale(bk, bk);
    ctx.shadowColor = `rgba(${theme.glow},0.8)`;
    ctx.shadowBlur = 34 + 18 * Math.sin(t * 7);
    ctx.fillStyle = "#ffffff";
    roundRect(ctx, -bw / 2, -36, bw, 72, 36);
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.fillStyle = theme.ink;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${label}  ›`, 0, 2);
    ctx.restore();
  }
  kicker(c, input.storeName, W / 2, 1040, easeOut((local - 1.0) / 0.4), "center");
  vignette(ctx);
  ctx.restore();
}

export function drawStudioFrame(
  ctx: CanvasRenderingContext2D,
  t: number,
  input: StudioInput,
  media: StudioMedia[],
  scenes: StudioScene[] = buildStudioTimeline({
    mediaCount: media.length,
    benefits: input.benefits,
    hasPrice: Boolean(formatStudioPrice(input.price, input.currency)),
  }),
) {
  const c: DrawContext = {
    ctx,
    input,
    media,
    scenes,
    theme: themeFor(input, media),
    font: fonts(),
    benefits: cleanBenefits(input.benefits),
  };
  const scene = sceneAt(scenes, t);
  const local = t - scene.start;
  // Cada corte entra con un leve zoom y un destello corto.
  const zoom = 1.08 - 0.08 * easeOut(local / 0.5);
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(zoom, zoom);
  ctx.translate(-W / 2, -H / 2);
  drawScene(c, scene, t);
  ctx.restore();
  if (scene.start > 0 && local < CUT_FLASH) {
    ctx.save();
    ctx.globalAlpha = 0.5 * (1 - local / CUT_FLASH);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}

/** Fotos con menos de esto en su lado corto se ven borrosas en el video. */
export const STUDIO_MIN_SHORT_SIDE = 600;

export function isLowResolution(media: StudioMedia): boolean {
  return Math.min(media.width, media.height) < STUDIO_MIN_SHORT_SIDE;
}

/* ------------------------------ música ------------------------------ */

/** Pista de 15 s (bombo, hi-hat, bajo y acordes) programada sobre el reloj de audio. */
function scheduleMusic(ac: AudioContext, out: AudioNode, startAt: number) {
  const bpm = 112;
  const beat = 60 / bpm;
  const master = ac.createGain();
  master.gain.setValueAtTime(0.0001, startAt);
  master.gain.exponentialRampToValueAtTime(0.9, startAt + 0.4);
  master.gain.setValueAtTime(0.9, startAt + STUDIO_DURATION - 1.2);
  master.gain.exponentialRampToValueAtTime(0.0001, startAt + STUDIO_DURATION);
  master.connect(out);

  const noise = ac.createBuffer(1, ac.sampleRate * 0.1, ac.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

  const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
  const prog = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
  const roots = [45, 41, 48, 43];

  const total = Math.floor(STUDIO_DURATION / beat);
  for (let i = 0; i < total; i++) {
    const at = startAt + i * beat;
    const bar = Math.floor(i / 4) % 4;

    const kick = ac.createOscillator();
    const kg = ac.createGain();
    kick.frequency.setValueAtTime(150, at);
    kick.frequency.exponentialRampToValueAtTime(45, at + 0.12);
    kg.gain.setValueAtTime(0.7, at);
    kg.gain.exponentialRampToValueAtTime(0.001, at + 0.35);
    kick.connect(kg).connect(master);
    kick.start(at);
    kick.stop(at + 0.36);

    const hat = ac.createBufferSource();
    hat.buffer = noise;
    const hp = ac.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 7000;
    const hg = ac.createGain();
    hg.gain.setValueAtTime(0.12, at + beat / 2);
    hg.gain.exponentialRampToValueAtTime(0.001, at + beat / 2 + 0.06);
    hat.connect(hp).connect(hg).connect(master);
    hat.start(at + beat / 2);

    const bass = ac.createOscillator();
    const bg = ac.createGain();
    bass.frequency.value = hz(roots[bar]);
    bg.gain.setValueAtTime(0.22, at);
    bg.gain.exponentialRampToValueAtTime(0.001, at + beat * 0.9);
    bass.connect(bg).connect(master);
    bass.start(at);
    bass.stop(at + beat);

    if (i % 4 === 0) {
      for (const m of prog[bar]) {
        const pad = ac.createOscillator();
        const pg = ac.createGain();
        pad.type = "triangle";
        pad.frequency.value = hz(m);
        pg.gain.setValueAtTime(0.0001, at);
        pg.gain.linearRampToValueAtTime(0.045, at + 0.3);
        pg.gain.linearRampToValueAtTime(0.0001, at + beat * 4);
        pad.connect(pg).connect(master);
        pad.start(at);
        pad.stop(at + beat * 4 + 0.05);
      }
    }
  }
}

/* ----------------------------- grabación ----------------------------- */

const MP4_TYPES = [
  "video/mp4;codecs=avc1.42E01F,mp4a.40.2",
  "video/mp4;codecs=avc1,mp4a.40.2",
  "video/mp4",
];

/**
 * Aprieta la frase: quita el silencio del inicio y del final, y acorta las
 * pausas largas de en medio a 0,12 s (la voz viene con aire y no entra en 15 s).
 */
function trimSilence(ac: AudioContext, buffer: AudioBuffer): AudioBuffer {
  const rate = buffer.sampleRate;
  const win = Math.round(rate * 0.01);
  const data = buffer.getChannelData(0);
  const windows = Math.floor(data.length / win);
  const loud: boolean[] = [];
  for (let w = 0; w < windows; w++) {
    let sum = 0;
    for (let i = w * win; i < (w + 1) * win; i++) sum += data[i] * data[i];
    loud.push(Math.sqrt(sum / win) > 0.012);
  }
  const first = loud.indexOf(true);
  const last = loud.lastIndexOf(true);
  if (first < 0) return buffer;
  const keep: number[] = [];
  let silentRun = 0;
  for (let w = Math.max(0, first - 3); w <= Math.min(windows - 1, last + 4); w++) {
    silentRun = loud[w] ? 0 : silentRun + 1;
    if (silentRun <= 12) keep.push(w);
  }
  const out = ac.createBuffer(buffer.numberOfChannels, keep.length * win, rate);
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const src = buffer.getChannelData(ch);
    const dst = out.getChannelData(ch);
    keep.forEach((w, k) => dst.set(src.subarray(w * win, (w + 1) * win), k * win));
  }
  return out;
}

/**
 * Voz en off: cada frase en su momento, sin pisarse con la anterior. Si la
 * última no entra en los 15 s se acelera un poco (hasta 15%). Mientras habla,
 * la música baja.
 */
function scheduleVoice(
  ac: AudioContext,
  out: AudioNode,
  duck: GainNode,
  lines: { at: number; buffer: AudioBuffer }[],
  startAt: number,
) {
  const voiceGain = ac.createGain();
  voiceGain.gain.value = 1.15;
  voiceGain.connect(out);
  duck.gain.setValueAtTime(1, startAt);
  let free = 0;
  for (const line of lines) {
    const begin = Math.max(line.at, free + 0.08);
    const room = STUDIO_DURATION - 0.2 - begin;
    if (room <= 0.3) break;
    const rate = Math.min(1.15, Math.max(1, line.buffer.duration / room));
    const length = line.buffer.duration / rate;
    const src = ac.createBufferSource();
    src.buffer = line.buffer;
    src.playbackRate.value = rate;
    src.connect(voiceGain);
    src.start(startAt + begin);
    duck.gain.setTargetAtTime(0.3, startAt + begin - 0.1, 0.06);
    duck.gain.setTargetAtTime(1, startAt + begin + length, 0.15);
    free = begin + length;
  }
}

/** Tipo mp4 que este navegador sabe grabar, o null (TikTok no acepta webm). */
export function supportedStudioMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  return MP4_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) ?? null;
}

/**
 * Graba los 15 s en tiempo real sobre `canvas`. La pestaña tiene que quedar
 * visible: el navegador frena el dibujo en pestañas ocultas.
 */
export async function recordStudioVideo(input: {
  canvas: HTMLCanvasElement;
  studio: StudioInput;
  media: StudioMedia[];
  /** Voz en off ya generada (mp3), cada frase con el segundo en que entra. */
  voice?: { at: number; audio: ArrayBuffer }[];
  onProgress?: (fraction: number) => void;
}): Promise<Blob> {
  const mimeType = supportedStudioMimeType();
  if (!mimeType) throw new Error("unsupported");
  const ctx = input.canvas.getContext("2d");
  if (!ctx) throw new Error("unsupported");

  const scenes = buildStudioTimeline({
    mediaCount: input.media.length,
    benefits: cleanBenefits(input.studio.benefits),
    hasPrice: Boolean(formatStudioPrice(input.studio.price, input.studio.currency)),
  });

  const ac = new AudioContext();
  await ac.resume();
  const dest = ac.createMediaStreamDestination();
  const videoStream = input.canvas.captureStream(30);
  const stream = new MediaStream([...videoStream.getVideoTracks(), ...dest.stream.getAudioTracks()]);
  const recorder = new MediaRecorder(stream, {
    mimeType,
    // ~3.5 MB por video: entra en el límite de subida.
    videoBitsPerSecond: 1_700_000,
    audioBitsPerSecond: 96_000,
  });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };
  const stopped = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
  });

  const voiceBuffers = await Promise.all(
    (input.voice ?? []).map(async (line) => ({
      at: line.at,
      buffer: trimSilence(ac, await ac.decodeAudioData(line.audio.slice(0))),
    })),
  );

  // Los clips arrancan desde el inicio cuando empieza su escena.
  const videos = input.media.filter((m): m is Extract<StudioMedia, { kind: "video" }> => m.kind === "video");
  for (const v of videos) {
    v.el.pause();
    v.el.currentTime = 0;
  }
  let lastSceneIndex = -1;

  drawStudioFrame(ctx, 0, input.studio, input.media, scenes);
  recorder.start(500);
  const audioStart = ac.currentTime + 0.05;
  // La música pasa por un "duck" que la baja mientras habla la voz.
  const duck = ac.createGain();
  duck.connect(dest);
  scheduleMusic(ac, duck, audioStart);
  scheduleVoice(ac, dest, duck, voiceBuffers, audioStart);
  const t0 = performance.now() + 50;

  await new Promise<void>((resolve) => {
    const tick = () => {
      const t = Math.max(0, (performance.now() - t0) / 1000);
      const index = scenes.findIndex((s) => t >= s.start && t < s.end);
      if (index !== lastSceneIndex) {
        lastSceneIndex = index;
        const scene = scenes[index];
        for (const v of videos) v.el.pause();
        if (scene && scene.kind !== "cta") {
          const m = input.media[scene.mediaIndex];
          if (m?.kind === "video") {
            m.el.currentTime = 0;
            void m.el.play().catch(() => undefined);
          }
        }
      }
      drawStudioFrame(ctx, Math.min(t, STUDIO_DURATION - 0.001), input.studio, input.media, scenes);
      input.onProgress?.(clamp(t / STUDIO_DURATION));
      if (t >= STUDIO_DURATION) resolve();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  recorder.stop();
  await stopped;
  for (const v of videos) v.el.pause();
  stream.getTracks().forEach((track) => track.stop());
  await ac.close();
  return new Blob(chunks, { type: "video/mp4" });
}

/** Carga una foto o un clip elegido por el usuario. */
export async function loadStudioMedia(file: File): Promise<{ media: StudioMedia; url: string }> {
  const url = URL.createObjectURL(file);
  if (file.type.startsWith("video/")) {
    const el = document.createElement("video");
    el.src = url;
    el.muted = true;
    el.playsInline = true;
    el.loop = true;
    el.preload = "auto";
    await new Promise<void>((resolve, reject) => {
      el.onloadeddata = () => resolve();
      el.onerror = () => reject(new Error("media"));
    });
    return { media: { kind: "video", el, width: el.videoWidth, height: el.videoHeight }, url };
  }
  const el = new Image();
  el.src = url;
  await el.decode();
  const prepared = prepareProduct(el, el.naturalWidth, el.naturalHeight);
  return { media: { kind: "image", el, width: el.naturalWidth, height: el.naturalHeight, prepared }, url };
}
