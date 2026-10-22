import "server-only";
import { serverEnv } from "@/lib/env/env.server";
import type { StudioVoice } from "@/lib/creatives/video-studio";

const TTS_MODEL = "gpt-4o-mini-tts";
const TTS_TIMEOUT_MS = 30_000;
export const VOICEOVER_MAX_CHARS = 220;

const VOICES: Record<Exclude<StudioVoice, "none">, string> = {
  female: "coral",
  male: "ash",
};

/** Cómo tiene que sonar: un creador de TikTok recomendando, no un locutor de radio. */
const INSTRUCTIONS = [
  "Habla en español latinoamericano con acento peruano suave y natural.",
  "Suenas como un creador de contenido de TikTok recomendando un producto que le encanta:",
  "cercano, con energía y sonrisa en la voz, sin sonar a locutor ni a publicidad de radio.",
  "Ritmo rápido de video de TikTok: todo seguido, sin pausas entre palabras ni al final.",
  "Los precios dilos claro y con un poco más de énfasis.",
].join(" ");

/** Voz en off (mp3) de una frase. Lanza si no hay clave de OpenAI o si falla. */
export async function synthesizeVoiceover(input: { text: string; voice: Exclude<StudioVoice, "none"> }): Promise<ArrayBuffer> {
  const apiKey = serverEnv.openAiApiKey?.trim();
  if (!apiKey) throw new Error("Falta OPENAI_API_KEY.");
  const text = input.text.trim().slice(0, VOICEOVER_MAX_CHARS);
  if (!text) throw new Error("Texto vacío.");

  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: TTS_MODEL,
      voice: VOICES[input.voice],
      input: text,
      instructions: INSTRUCTIONS,
      response_format: "mp3",
    }),
    signal: AbortSignal.timeout(TTS_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`OpenAI TTS ${response.status}: ${detail.slice(0, 200)}`);
  }
  return response.arrayBuffer();
}
