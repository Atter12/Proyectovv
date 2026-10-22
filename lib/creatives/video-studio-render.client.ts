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

type Theme = { accent: string; accentText: string; card: string; cardText: string; muted: string; overlay: string };

const THEMES: Record<StudioTemplate, Theme> = {
  orange: { accent: "#ff781f", accentText: "#ffffff", card: "#ffffff", cardText: "#141210", muted: "#6b645c", overlay: "20,12,6" },
  dark: { accent: "#f5c451", accentText: "#141210", card: "#141416", cardText: "#f7f4ef", muted: "#a39d95", overlay: "0,0,0" },
  fresh: { accent: "#19c2b3", accentText: "#ffffff", card: "#ffffff", cardText: "#0f2a27", muted: "#4e6b67", overlay: "4,30,28" },
};

const W = STUDIO_WIDTH;
const H = STUDIO_HEIGHT;

const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const easeOut = (x: number) => 1 - Math.pow(1 - clamp(x), 3);
const backOut = (x: number) => {
  const c = 1.7;
  const p = clamp(x) - 1;
  return 1 + (c + 1) * p * p * p + c * p * p;
};

function fontFamily(): string {
  if (typeof document === "undefined") return "sans-serif";
  const root = getComputedStyle(document.documentElement);
  const sora = root.getPropertyValue("--font-sora").trim();
  const jakarta = root.getPropertyValue("--font-jakarta").trim();
  return [sora, jakarta, "system-ui", "sans-serif"].filter(Boolean).join(", ");
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

/** Dibuja la foto o el clip cubriendo todo el lienzo, con un zoom lento. */
function drawCover(ctx: CanvasRenderingContext2D, media: StudioMedia | undefined, progress: number, drift: number) {
  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, W, H);
  if (!media || media.width <= 0 || media.height <= 0) return;
  const zoom = 1.04 + 0.1 * progress;
  const scale = Math.max(W / media.width, H / media.height) * zoom;
  const dw = media.width * scale;
  const dh = media.height * scale;
  const dx = (W - dw) / 2 + drift * 30 * (progress - 0.5);
  const dy = (H - dh) / 2;
  ctx.drawImage(media.el, dx, dy, dw, dh);
}

function badge(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, theme: Theme, font: string, alpha: number) {
  if (!text.trim() || alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `800 30px ${font}`;
  const label = text.trim().toUpperCase();
  const w = ctx.measureText(label).width + 44;
  ctx.fillStyle = theme.accent;
  roundRect(ctx, x, y, w, 60, 16);
  ctx.fill();
  ctx.fillStyle = theme.accentText;
  ctx.textBaseline = "middle";
  ctx.fillText(label, x + 22, y + 31);
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
  const theme = THEMES[input.template];
  const font = fontFamily();
  const scene = sceneAt(scenes, t);
  const local = t - scene.start;
  const span = scene.end - scene.start;
  const progress = clamp(local / span);
  ctx.save();
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  if (scene.kind === "cta") {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, theme.accent);
    g.addColorStop(1, input.template === "dark" ? "#b8860b" : "#141210");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const k = backOut(local / 0.5);
    ctx.textAlign = "center";
    ctx.fillStyle = input.template === "dark" ? "#141210" : "#ffffff";
    ctx.font = `800 96px ${font}`;
    const lines = wrap(ctx, input.cta, W - 120, 3);
    ctx.save();
    ctx.translate(W / 2, H / 2 - 40);
    ctx.scale(0.6 + 0.4 * k, 0.6 + 0.4 * k);
    lines.forEach((line, i) => ctx.fillText(line, 0, (i - (lines.length - 1) / 2) * 108));
    ctx.restore();
    // Flecha que late
    const pulse = 1 + 0.08 * Math.sin(t * 9);
    ctx.save();
    ctx.translate(W / 2, H / 2 + 60 + (lines.length * 108) / 2);
    ctx.scale(pulse, pulse);
    ctx.globalAlpha = easeOut((local - 0.3) / 0.4);
    ctx.font = `800 80px ${font}`;
    ctx.fillText("↓", 0, 40);
    ctx.restore();
    if (input.storeName.trim()) {
      ctx.globalAlpha = easeOut((local - 0.4) / 0.4);
      ctx.font = `700 34px ${font}`;
      ctx.fillText(input.storeName.trim(), W / 2, H - 140);
    }
    ctx.restore();
    return;
  }

  drawCover(ctx, media[scene.mediaIndex] ?? media[0], progress, scene.kind === "media" ? (scene.start % 2 ? 1 : -1) : 0);

  if (scene.kind === "hook") {
    ctx.fillStyle = `rgba(${theme.overlay},0.55)`;
    ctx.fillRect(0, 0, W, H);
    const e = easeOut(local / 0.6);
    ctx.globalAlpha = e;
    ctx.textAlign = "center";
    if (input.storeName.trim()) {
      ctx.font = `700 30px ${font}`;
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.fillText(input.storeName.trim().toUpperCase(), W / 2, 200);
    }
    ctx.font = `800 84px ${font}`;
    const lines = wrap(ctx, input.hook.trim() || input.productName, W - 110, 4);
    const top = H / 2 - ((lines.length - 1) * 98) / 2 + (1 - e) * 40;
    lines.forEach((line, i) => {
      ctx.fillStyle = i === lines.length - 1 ? theme.accent : "#ffffff";
      ctx.fillText(line, W / 2, top + i * 98);
    });
    ctx.restore();
    return;
  }

  if (scene.kind === "media") {
    const g = ctx.createLinearGradient(0, H * 0.45, 0, H);
    g.addColorStop(0, `rgba(${theme.overlay},0)`);
    g.addColorStop(1, `rgba(${theme.overlay},0.85)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    badge(ctx, input.promo, 48, 120, theme, font, easeOut(local / 0.4));

    ctx.font = `800 64px ${font}`;
    ctx.fillStyle = "#ffffff";
    const name = wrap(ctx, input.productName, W - 96, 2);
    const baseY = H - 330 - (name.length - 1) * 74;
    name.forEach((line, i) => ctx.fillText(line, 48, baseY + i * 74));

    if (scene.benefit) {
      const k = backOut((local - 0.15) / 0.45);
      ctx.save();
      ctx.globalAlpha = clamp((local - 0.15) / 0.2);
      ctx.translate(48, H - 230);
      ctx.scale(0.8 + 0.2 * k, 0.8 + 0.2 * k);
      ctx.font = `700 38px ${font}`;
      const text = wrap(ctx, scene.benefit, W - 200, 1)[0] ?? "";
      const w = ctx.measureText(text).width + 120;
      ctx.fillStyle = theme.card;
      roundRect(ctx, 0, 0, w, 96, 26);
      ctx.fill();
      ctx.fillStyle = theme.accent;
      ctx.beginPath();
      ctx.arc(48, 48, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = theme.accentText;
      ctx.lineWidth = 6;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(37, 49);
      ctx.lineTo(46, 58);
      ctx.lineTo(60, 40);
      ctx.stroke();
      ctx.fillStyle = theme.cardText;
      ctx.textBaseline = "middle";
      ctx.fillText(text, 88, 50);
      ctx.restore();
    }
    ctx.restore();
    return;
  }

  // Precio
  ctx.fillStyle = `rgba(${theme.overlay},0.72)`;
  ctx.fillRect(0, 0, W, H);
  const cardW = W - 120;
  const cardH = 520;
  const cx = 60;
  const cy = (H - cardH) / 2;
  const enter = easeOut(local / 0.45);
  ctx.globalAlpha = enter;
  ctx.fillStyle = theme.card;
  roundRect(ctx, cx, cy + (1 - enter) * 60, cardW, cardH, 44);
  ctx.fill();
  ctx.textAlign = "center";
  const old = formatStudioPrice(input.oldPrice, input.currency);
  const price = formatStudioPrice(input.price, input.currency);
  if (old) {
    ctx.font = `600 40px ${font}`;
    ctx.fillStyle = theme.muted;
    const label = `${input.labels?.before ?? "Antes"} ${old}`;
    ctx.fillText(label, W / 2, cy + 110);
    const w = ctx.measureText(label).width;
    ctx.strokeStyle = "#e5484d";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(W / 2 - w / 2 - 6, cy + 96);
    ctx.lineTo(W / 2 + w / 2 + 6, cy + 96);
    ctx.stroke();
  }
  ctx.font = `800 34px ${font}`;
  ctx.fillStyle = theme.accent;
  ctx.fillText((old ? input.labels?.today ?? "Hoy" : input.labels?.price ?? "Precio").toUpperCase(), W / 2, cy + (old ? 180 : 140));
  const pop = backOut((local - 0.25) / 0.5);
  ctx.save();
  ctx.translate(W / 2, cy + 320);
  ctx.scale(0.5 + 0.5 * pop, 0.5 + 0.5 * pop);
  ctx.globalAlpha = enter * clamp((local - 0.25) / 0.15);
  ctx.fillStyle = theme.cardText;
  ctx.font = `800 140px ${font}`;
  ctx.fillText(price, 0, 48);
  ctx.restore();
  ctx.textAlign = "left";
  if (input.promo.trim()) {
    ctx.font = `800 30px ${font}`;
    const w = ctx.measureText(input.promo.trim().toUpperCase()).width + 44;
    badge(ctx, input.promo, (W - w) / 2, cy + cardH - 110, theme, font, enter * clamp((local - 0.6) / 0.3));
  }
  ctx.restore();
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
