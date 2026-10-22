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

/**
 * Dibuja y graba el video del estudio en el navegador (canvas + MediaRecorder).
 * La música se arma con Web Audio, así el mp4 sale con sonido sin pistas externas.
 */

export type StudioMedia =
  | { kind: "image"; el: ImageBitmap | HTMLImageElement; width: number; height: number }
  | { kind: "video"; el: HTMLVideoElement; width: number; height: number };

type Theme = {
  accent: string;
  accentText: string;
  card: string;
  cardText: string;
  muted: string;
  /** Tinte del fondo (r,g,b). */
  tint: string;
  ctaFrom: string;
  ctaTo: string;
  ctaText: string;
};

const THEMES: Record<StudioTemplate, Theme> = {
  orange: { accent: "#ff781f", accentText: "#ffffff", card: "#ffffff", cardText: "#141210", muted: "#6b645c", tint: "28,16,8", ctaFrom: "#ff8a3d", ctaTo: "#d9480f", ctaText: "#ffffff" },
  dark: { accent: "#f5c451", accentText: "#141210", card: "#17171a", cardText: "#f7f4ef", muted: "#a39d95", tint: "6,6,8", ctaFrom: "#232327", ctaTo: "#09090b", ctaText: "#f5c451" },
  fresh: { accent: "#14b8a6", accentText: "#ffffff", card: "#ffffff", cardText: "#0f2a27", muted: "#4e6b67", tint: "4,32,30", ctaFrom: "#2dd4bf", ctaTo: "#0f766e", ctaText: "#ffffff" },
};

const W = STUDIO_WIDTH;
const H = STUDIO_HEIGHT;
/** Zona del producto y zona de textos (fuera de los botones de TikTok, abajo y a la derecha). */
const STAGE = { x: 70, y: 150, w: 580, h: 600 };
const TEXT_TOP = 800;
const TEXT_LEFT = 56;
const TEXT_WIDTH = W - TEXT_LEFT - 110;
const TRANSITION = 0.35;
/** Más de esto la foto se ve pixelada: mejor que quede más chica y nítida. */
const MAX_UPSCALE = 1.7;

const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const easeOut = (x: number) => 1 - Math.pow(1 - clamp(x), 3);
const easeInOut = (x: number) => {
  const p = clamp(x);
  return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
};
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

function isFullBleed(media: StudioMedia): boolean {
  // Clips verticales con buena resolución se ven mejor a pantalla completa.
  return media.kind === "video" && media.height > media.width && media.height >= 900;
}

/** Fondo: la misma foto agrandada y desenfocada, con el tinte del estilo. */
function drawBackdrop(ctx: CanvasRenderingContext2D, media: StudioMedia | undefined, theme: Theme, t: number) {
  ctx.fillStyle = `rgb(${theme.tint})`;
  ctx.fillRect(0, 0, W, H);
  if (media && media.width > 0) {
    const scale = Math.max(W / media.width, H / media.height) * (1.25 + 0.03 * Math.sin(t * 0.4));
    const dw = media.width * scale;
    const dh = media.height * scale;
    ctx.save();
    ctx.filter = "blur(36px) saturate(1.2)";
    ctx.globalAlpha *= 0.85;
    ctx.drawImage(media.el, (W - dw) / 2, (H - dh) / 2, dw, dh);
    ctx.restore();
  }
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, `rgba(${theme.tint},0.25)`);
  g.addColorStop(0.55, `rgba(${theme.tint},0.45)`);
  g.addColorStop(1, `rgba(${theme.tint},0.9)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // Luz suave detrás del producto
  const glow = ctx.createRadialGradient(W / 2, STAGE.y + STAGE.h * 0.45, 20, W / 2, STAGE.y + STAGE.h * 0.45, 420);
  glow.addColorStop(0, "rgba(255,255,255,0.22)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
}

/**
 * Producto nítido dentro de su zona, con sombra y flotando.
 * `size` 1 = zona completa; menos para escenas donde el producto acompaña.
 */
function drawProduct(
  ctx: CanvasRenderingContext2D,
  media: StudioMedia | undefined,
  opts: { t: number; enter: number; size?: number; cx?: number; cy?: number; zoom?: number },
) {
  if (!media || media.width <= 0) return;
  const size = opts.size ?? 1;
  const boxW = STAGE.w * size;
  const boxH = STAGE.h * size;
  const fit = Math.min(boxW / media.width, boxH / media.height);
  const scale = Math.min(fit, MAX_UPSCALE) * (0.9 + 0.1 * backOut(opts.enter)) * (opts.zoom ?? 1);
  const dw = media.width * scale;
  const dh = media.height * scale;
  const cx = opts.cx ?? W / 2;
  const cy = (opts.cy ?? STAGE.y + STAGE.h / 2) + Math.sin(opts.t * 1.6) * 6 + (1 - easeOut(opts.enter)) * 50;
  ctx.save();
  ctx.globalAlpha *= clamp(opts.enter * 2);
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = 50;
  ctx.shadowOffsetY = 24;
  ctx.beginPath();
  ctx.roundRect(cx - dw / 2, cy - dh / 2, dw, dh, 28);
  ctx.fillStyle = "#000";
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.clip();
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(media.el, cx - dw / 2, cy - dh / 2, dw, dh);
  ctx.restore();
}

function drawFullBleed(ctx: CanvasRenderingContext2D, media: StudioMedia, progress: number, theme: Theme) {
  const scale = Math.max(W / media.width, H / media.height) * (1.02 + 0.06 * progress);
  const dw = media.width * scale;
  const dh = media.height * scale;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(media.el, (W - dw) / 2, (H - dh) / 2, dw, dh);
  const g = ctx.createLinearGradient(0, H * 0.5, 0, H);
  g.addColorStop(0, `rgba(${theme.tint},0)`);
  g.addColorStop(1, `rgba(${theme.tint},0.92)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

/** Sticker inclinado de la promo. */
function sticker(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, theme: Theme, font: string, k: number) {
  if (!text.trim() || k <= 0) return;
  ctx.save();
  ctx.font = `700 30px ${font}`;
  const label = text.trim().toUpperCase();
  const w = ctx.measureText(label).width + 48;
  ctx.translate(x + w / 2, y + 32);
  ctx.rotate(-0.07);
  ctx.scale(0.4 + 0.6 * backOut(k), 0.4 + 0.6 * backOut(k));
  ctx.globalAlpha *= clamp(k * 3);
  ctx.shadowColor = "rgba(0,0,0,0.3)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 6;
  ctx.fillStyle = theme.accent;
  roundRect(ctx, -w / 2, -32, w, 64, 18);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.fillStyle = theme.accentText;
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.fillText(label, 0, 2);
  ctx.restore();
}

/** Texto que entra palabra por palabra. Con varias líneas, la última va en el color del estilo. */
function kinetic(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  opts: { x: number; y: number; lineHeight: number; t: number; align: "left" | "center"; color: string; accent: string },
) {
  ctx.save();
  ctx.textAlign = "left";
  let wordIndex = 0;
  lines.forEach((line, li) => {
    const lineWidth = ctx.measureText(line).width;
    let cursor = opts.align === "center" ? opts.x - lineWidth / 2 : opts.x;
    for (const word of line.split(" ")) {
      const k = easeOut((opts.t - wordIndex * 0.09) / 0.35);
      ctx.save();
      ctx.globalAlpha *= k;
      ctx.fillStyle = li === lines.length - 1 && lines.length > 1 ? opts.accent : opts.color;
      ctx.fillText(word, cursor, opts.y + li * opts.lineHeight + (1 - k) * 26);
      ctx.restore();
      cursor += ctx.measureText(`${word} `).width;
      wordIndex++;
    }
  });
  ctx.restore();
}

function checkChip(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, theme: Theme, font: string, k: number) {
  if (k <= 0) return;
  ctx.save();
  ctx.globalAlpha *= clamp(k * 2.5);
  ctx.translate(x + (1 - easeOut(k)) * -40, y);
  ctx.font = `700 32px ${font}`;
  const label = wrap(ctx, text, TEXT_WIDTH - 110, 1)[0] ?? "";
  const w = ctx.measureText(label).width + 104;
  ctx.fillStyle = theme.card;
  ctx.shadowColor = "rgba(0,0,0,0.18)";
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 6;
  roundRect(ctx, 0, 0, w, 76, 22);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.fillStyle = theme.accent;
  ctx.beginPath();
  ctx.arc(40, 38, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = theme.accentText;
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(31, 39);
  ctx.lineTo(38, 46);
  ctx.lineTo(50, 31);
  ctx.stroke();
  ctx.fillStyle = theme.cardText;
  ctx.textBaseline = "middle";
  ctx.fillText(label, 76, 40);
  ctx.restore();
}

type DrawContext = {
  ctx: CanvasRenderingContext2D;
  input: StudioInput;
  media: StudioMedia[];
  scenes: StudioScene[];
  theme: Theme;
  font: { display: string; body: string };
  benefits: string[];
};

function drawScene(c: DrawContext, scene: StudioScene, t: number) {
  const { ctx, input, media, theme, font } = c;
  const local = t - scene.start;
  const progress = clamp(local / (scene.end - scene.start));
  ctx.save();
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  if (scene.kind === "cta") {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, theme.ctaFrom);
    g.addColorStop(1, theme.ctaTo);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    drawProduct(ctx, media[0], { t, enter: local / 0.5, size: 0.55, cy: 380 });
    ctx.font = `700 74px ${font.display}`;
    const lines = wrap(ctx, input.cta, W - 140, 2);
    kinetic(ctx, lines, { x: W / 2, y: 760, lineHeight: 86, t: local - 0.15, align: "center", color: theme.ctaText, accent: theme.ctaText });
    // Botón con flecha que late
    const k = backOut((local - 0.5) / 0.4);
    if (local > 0.5) {
      const pulse = 1 + 0.04 * Math.sin(t * 8);
      ctx.save();
      ctx.translate(W / 2, 760 + lines.length * 86 + 30);
      ctx.scale(k * pulse, k * pulse);
      ctx.fillStyle = theme.ctaText;
      roundRect(ctx, -110, -40, 220, 80, 40);
      ctx.fill();
      ctx.strokeStyle = theme.ctaTo;
      ctx.lineWidth = 9;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(-22, -10);
      ctx.lineTo(0, 12);
      ctx.lineTo(22, -10);
      ctx.stroke();
      ctx.restore();
    }
    if (input.storeName.trim()) {
      ctx.globalAlpha *= easeOut((local - 0.6) / 0.4);
      ctx.textAlign = "center";
      ctx.font = `600 28px ${font.body}`;
      ctx.fillStyle = theme.ctaText;
      ctx.fillText(input.storeName.trim(), W / 2, H - 190);
    }
    ctx.restore();
    return;
  }

  const m = media[scene.mediaIndex] ?? media[0];
  const full = scene.kind === "media" && m ? isFullBleed(m) : false;
  if (full && m) drawFullBleed(ctx, m, progress, theme);
  else drawBackdrop(ctx, m, theme, t);

  if (scene.kind === "hook") {
    drawProduct(ctx, m, { t, enter: local / 0.6, zoom: 1 + 0.05 * progress });
    if (input.storeName.trim()) {
      ctx.save();
      ctx.globalAlpha *= easeOut(local / 0.5);
      ctx.font = `700 24px ${font.body}`;
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.textAlign = "center";
      ctx.fillText(input.storeName.trim().toUpperCase(), W / 2, 110);
      ctx.restore();
    }
    ctx.font = `700 70px ${font.display}`;
    const lines = wrap(ctx, input.hook.trim() || input.productName, W - 120, 3);
    kinetic(ctx, lines, { x: W / 2, y: TEXT_TOP + 90, lineHeight: 82, t: local - 0.2, align: "center", color: "#ffffff", accent: theme.accent });
    ctx.restore();
    return;
  }

  if (scene.kind === "media") {
    if (!full) drawProduct(ctx, m, { t, enter: local / 0.5, zoom: 1 + 0.06 * progress });
    sticker(ctx, input.promo, STAGE.x - 10, STAGE.y + 10, theme, font.body, (local - 0.2) / 0.4);

    ctx.font = `700 54px ${font.display}`;
    ctx.fillStyle = "#ffffff";
    const name = wrap(ctx, input.productName, TEXT_WIDTH, 2);
    name.forEach((line, i) => ctx.fillText(line, TEXT_LEFT, TEXT_TOP + 50 + i * 62));

    // Los beneficios se van sumando: cada tramo agrega el suyo.
    const slot = c.scenes.filter((s) => s.kind === "media").indexOf(scene);
    const shown = Math.min(c.benefits.length, slot + 1);
    const baseY = TEXT_TOP + 50 + name.length * 62 - 10;
    const maxRows = name.length > 1 ? 2 : 3;
    const first = Math.max(0, shown - maxRows);
    for (let i = first; i < shown; i++) {
      const isNew = i === shown - 1 && slot < c.benefits.length;
      checkChip(ctx, c.benefits[i], TEXT_LEFT, baseY + (i - first) * 90, theme, font.body, isNew ? (local - 0.15) / 0.45 : 1);
    }
    ctx.restore();
    return;
  }

  // Precio: producto arriba y la tarjeta de precio en la zona de textos.
  drawProduct(ctx, m, { t, enter: local / 0.5, size: 0.8, cy: STAGE.y + STAGE.h * 0.42 });
  const enter = easeOut(local / 0.4);
  const top = TEXT_TOP - 70 + (1 - enter) * 60;
  ctx.save();
  ctx.globalAlpha *= enter;
  ctx.fillStyle = theme.card;
  ctx.shadowColor = "rgba(0,0,0,0.3)";
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 16;
  roundRect(ctx, TEXT_LEFT, top, W - TEXT_LEFT * 2, 330, 36);
  ctx.fill();
  ctx.restore();
  ctx.textAlign = "center";
  const old = formatStudioPrice(input.oldPrice, input.currency);
  const price = formatStudioPrice(input.price, input.currency);
  ctx.globalAlpha *= enter;
  if (old) {
    ctx.font = `600 34px ${font.body}`;
    ctx.fillStyle = theme.muted;
    const label = `${input.labels?.before ?? "Antes"} ${old}`;
    ctx.fillText(label, W / 2, top + 70);
    const w = ctx.measureText(label).width;
    const strike = easeOut((local - 0.35) / 0.3);
    ctx.strokeStyle = "#e5484d";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(W / 2 - w / 2 - 6, top + 58);
    ctx.lineTo(W / 2 - w / 2 - 6 + (w + 12) * strike, top + 58);
    ctx.stroke();
  }
  ctx.font = `700 26px ${font.body}`;
  ctx.fillStyle = theme.accent;
  ctx.fillText((old ? input.labels?.today ?? "Hoy" : input.labels?.price ?? "Precio").toUpperCase(), W / 2, top + (old ? 120 : 80));
  const pop = backOut((local - 0.45) / 0.45);
  ctx.save();
  ctx.translate(W / 2, top + (old ? 235 : 210));
  ctx.scale(0.5 + 0.5 * pop, 0.5 + 0.5 * pop);
  ctx.globalAlpha *= clamp((local - 0.45) / 0.15);
  ctx.fillStyle = theme.cardText;
  ctx.font = `700 120px ${font.display}`;
  ctx.fillText(price, 0, 40);
  ctx.restore();
  sticker(ctx, input.promo, STAGE.x - 10, STAGE.y + 10, theme, font.body, (local - 0.7) / 0.4);
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
    theme: THEMES[input.template],
    font: fonts(),
    benefits: cleanBenefits(input.benefits),
  };
  const scene = sceneAt(scenes, t);
  const index = scenes.indexOf(scene);
  const local = t - scene.start;
  // Transición: la escena se oscurece, sale, y la nueva aparece con un leve zoom.
  // Nunca se ven las dos a la vez, así los textos no se enciman.
  if (index > 0 && local < TRANSITION) {
    const k = local / TRANSITION;
    const tint = `rgb(${c.theme.tint})`;
    if (k < 0.5) {
      const prev = scenes[index - 1];
      drawScene(c, prev, prev.end - 0.001);
      ctx.save();
      ctx.globalAlpha = easeInOut(k * 2);
      ctx.fillStyle = tint;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    } else {
      const zoom = 1.06 - 0.06 * easeOut((k - 0.5) * 2);
      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.scale(zoom, zoom);
      ctx.translate(-W / 2, -H / 2);
      drawScene(c, scene, t);
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = 1 - easeInOut((k - 0.5) * 2);
      ctx.fillStyle = tint;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
    return;
  }
  drawScene(c, scene, t);
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
  scheduleMusic(ac, dest, audioStart);
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
  return { media: { kind: "image", el, width: el.naturalWidth, height: el.naturalHeight }, url };
}
