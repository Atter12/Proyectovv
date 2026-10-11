"use client";

import { useEffect, useRef } from "react";

/**
 * Reproductor oficial de TikTok (https://developers.tiktok.com/doc/embed-player).
 * No se descarga ni se guarda el video: se inserta tal cual, con la marca de
 * TikTok visible. Escucha los mensajes del reproductor para:
 * - pausar los demás cuando uno empieza a sonar (uno a la vez);
 * - avisar cuando el video no carga (borrado, privado o sin inserción), para
 *   reemplazarlo sin mostrar error.
 */

const TIKTOK_ORIGIN = "https://www.tiktok.com";
/** Errores del reproductor que significan "este video ya no está". */
const DEAD_ERRORS = new Set([1001, 3001]);

const players = new Set<HTMLIFrameElement>();

function post(frame: HTMLIFrameElement, type: string) {
  frame.contentWindow?.postMessage({ "x-tiktok-player": true, type, value: null }, TIKTOK_ORIGIN);
}

export function tiktokPlayerUrl(videoId: string): string {
  const params = new URLSearchParams({
    controls: "1",
    progress_bar: "1",
    play_button: "1",
    volume_control: "1",
    fullscreen_button: "1",
    timestamp: "0",
    music_info: "0",
    description: "0",
    rel: "0",
    native_context_menu: "0",
    closed_caption: "1",
    autoplay: "1",
  });
  return `${TIKTOK_ORIGIN}/player/v1/${encodeURIComponent(videoId)}?${params.toString()}`;
}

export function TikTokEmbed({
  videoId,
  title,
  onDead,
}: {
  videoId: string;
  title: string;
  onDead: () => void;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const onDeadRef = useRef(onDead);
  useEffect(() => {
    onDeadRef.current = onDead;
  }, [onDead]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    players.add(frame);

    function onMessage(event: MessageEvent) {
      if (event.origin !== TIKTOK_ORIGIN || event.source !== frame?.contentWindow) return;
      const data = event.data as { "x-tiktok-player"?: boolean; type?: string; value?: unknown } | null;
      if (!data || !data["x-tiktok-player"]) return;

      if (data.type === "onStateChange" && data.value === 1) {
        for (const other of players) if (other !== frame) post(other, "pause");
      }
      if (data.type === "onPlayerError" && DEAD_ERRORS.has(Number(data.value))) {
        onDeadRef.current();
      }
    }

    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      players.delete(frame);
    };
  }, [videoId]);

  return (
    <iframe
      ref={frameRef}
      src={tiktokPlayerUrl(videoId)}
      title={title}
      className="absolute inset-0 h-full w-full border-0"
      allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
      allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin"
    />
  );
}
