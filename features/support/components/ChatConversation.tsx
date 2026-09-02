"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import type { ChatMessage } from "../types/support.types";
import { formatSupportChatTimestamp } from "@/lib/support/chat-time";
import { buildChatTimeline } from "@/features/support/lib/chat-message-timeline";
import { cn } from "@/lib/cn";
import { HecomClienteAvatar } from "@/features/clientes/components/HecomClienteAvatar.client";

interface PendingFile {
  id: string;
  file: File;
  previewUrl: string | null;
}

interface ChatConversationProps {
  messages: ChatMessage[];
  inputValue: string;
  sending?: boolean;
  loading?: boolean;
  error?: string | null;
  showBack?: boolean;
  className?: string;
  title?: string;
  subtitle?: string;
  /** URL de foto (Hecom) para el header. */
  avatarUrl?: string | null;
  headerActions?: ReactNode;
  /** Borra todo el hilo (pide confirmación en el botón). */
  onClearChat?: () => void;
  clearingChat?: boolean;
  onInputChange: (value: string) => void;
  onSend: (files: File[]) => void;
  onBack: () => void;
  composerDisabled?: boolean;
  composerDisabledReason?: string;
  /** Texto cuando no hay mensajes (además del estado de carga). */
  emptyHint?: string;
}

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif,application/pdf";

function isAllowedFile(file: File) {
  return (
    !file.type ||
    ACCEPT.split(",").includes(file.type) ||
    file.type.startsWith("image/") ||
    file.type === "application/pdf"
  );
}

export function ChatConversation({
  messages,
  inputValue,
  sending = false,
  loading = false,
  error = null,
  showBack = true,
  className,
  title = "Escríbenos",
  subtitle = "Tu conversación queda guardada como ticket de soporte.",
  avatarUrl = null,
  headerActions,
  onClearChat,
  clearingChat = false,
  onInputChange,
  onSend,
  onBack,
  composerDisabled = false,
  composerDisabledReason,
  emptyHint = "Escribí tu consulta, pegá una captura (Ctrl+V) o adjuntá un archivo.",
}: ChatConversationProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const pendingFiles = useMemo(() => pending.map((item) => item.file), [pending]);
  const lastMessageId = messages[messages.length - 1]?.id;
  const timeline = useMemo(() => buildChatTimeline(messages), [messages]);

  useEffect(() => {
    return () => {
      pending.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cleanup on unmount only
  }, []);

  // Live chat: bajar al último mensaje cuando llega uno nuevo (sin F5).
  useEffect(() => {
    if (loading) return;
    const end = messagesEndRef.current;
    const scroller = messagesScrollRef.current;
    if (!end || !scroller) return;
    end.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [lastMessageId, messages.length, loading]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [inputValue]);

  function addFiles(list: FileList | File[]) {
    const next = Array.from(list).filter(isAllowedFile).slice(0, 5);
    if (next.length === 0) return;
    setPending((prev) => {
      const room = Math.max(0, 5 - prev.length);
      const toAdd = next.slice(0, room).map((file) => ({
        id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
        file,
        previewUrl: file.type.startsWith("image/")
          ? URL.createObjectURL(file)
          : null,
      }));
      return [...prev, ...toAdd];
    });
  }

  function removePending(id: string) {
    setPending((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((item) => item.id !== id);
    });
  }

  function clearPending() {
    setPending((prev) => {
      prev.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
      return [];
    });
  }

  function handleSend() {
    if (sending || composerDisabled) return;
    if (!inputValue.trim() && pendingFiles.length === 0) return;
    onSend(pendingFiles);
    clearPending();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (const item of Array.from(items)) {
      if (item.kind === "file") {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }
    if (files.length > 0) {
      e.preventDefault();
      addFiles(files);
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) addFiles(e.target.files);
    e.target.value = "";
  }

  return (
    <div
      className={cn(
        "flex min-h-[520px] flex-col bg-white text-[var(--auth-text)]",
        className,
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      <div className="flex min-h-[68px] items-center gap-3 border-b border-white/10 bg-[linear-gradient(135deg,#21150f_0%,#382117_70%,#612b18_140%)] px-3.5 py-3 shadow-sm sm:px-5">
        {showBack ? (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/80 hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Volver"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
        ) : null}
        <HecomClienteAvatar
          name={title}
          avatarUrl={avatarUrl}
          size="sm"
          className="h-11 w-11 text-[12px] shadow-md ring-2 ring-white/20"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold tracking-[-0.01em] text-white">{title}</p>
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] text-white/70"><span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />{subtitle}</p>
        </div>
        {onClearChat || headerActions ? (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
            {onClearChat ? (
              <button
                type="button"
                disabled={clearingChat || sending || loading}
                onClick={() => {
                  if (
                    !window.confirm(
                      "¿Borrar todo el chat? Se eliminan los mensajes de esta conversación.",
                    )
                  ) {
                    return;
                  }
                  onClearChat();
                }}
                className="rounded-md border border-white/20 bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/90 hover:bg-white/15 disabled:opacity-50"
              >
                {clearingChat ? "Borrando…" : "Borrar chat"}
              </button>
            ) : null}
            {headerActions}
          </div>
        ) : null}
      </div>

      <div
        ref={messagesScrollRef}
        className="relative flex-1 space-y-3 overflow-y-auto bg-[#f3eee8] p-3 sm:p-5"
      >
        {dragOver ? (
          <div className="pointer-events-none absolute inset-3 z-10 flex items-center justify-center rounded-2xl border-2 border-dashed border-[var(--brand-primary)] bg-white/90 text-sm font-semibold text-[var(--brand-primary-deep)]">
            Soltá la imagen o PDF acá
          </div>
        ) : null}

        {loading ? (
          <p className="rounded-2xl bg-white px-4 py-3 text-sm text-[#6b645c] shadow-sm ring-1 ring-[var(--border-subtle)]">
            Cargando historial…
          </p>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl bg-white px-6 py-10 text-center shadow-sm ring-1 ring-[var(--border-subtle)]">
            <span
              aria-hidden
              className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f7f2ed] text-xl"
            >
              💬
            </span>
            <p className="mt-3 text-sm font-semibold text-[#3f3a34]">
              Todavía no hay mensajes
            </p>
            <p className="mt-1 max-w-xs text-[13px] leading-relaxed text-[#6b645c]">
              {emptyHint}
            </p>
          </div>
        ) : (
          timeline.map((item) => {
            if (item.kind === "day") {
              return (
                <div key={item.key} className="flex justify-center py-1">
                  <span className="rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold text-[#6b645c] shadow-sm ring-1 ring-black/5">
                    {item.label}
                  </span>
                </div>
              );
            }
            return (
              <ChatMessageBubble key={item.message.id} message={item.message} />
            );
          })
        )}
        <div ref={messagesEndRef} className="h-px w-full shrink-0" aria-hidden />
        {error ? (
          <p className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </p>
        ) : null}
      </div>

      <div className="border-t border-[var(--auth-divider)] bg-white p-3 shadow-[0_-8px_24px_rgb(15_23_42_/_0.04)] sm:px-5 sm:py-4">
        {composerDisabled ? (
          <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] font-medium text-amber-900">
            {composerDisabledReason ?? "No podés escribir en este chat ahora."}
          </p>
        ) : null}
        {pending.length > 0 ? (
          <div className="mb-3 flex flex-wrap gap-2">
            {pending.map((item) => (
              <div
                key={item.id}
                className="relative overflow-hidden rounded-xl border border-[var(--auth-input-border)] bg-[var(--surface-soft)]"
              >
                {item.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.previewUrl}
                    alt={item.file.name}
                    className="h-16 w-16 object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-28 items-center px-2 text-[11px] font-medium text-[var(--auth-text-muted)]">
                    {item.file.name}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => removePending(item.id)}
                  className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-[10px] text-white"
                  aria-label="Quitar archivo"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <div className="rounded-[22px] border border-[var(--auth-input-border)] bg-[#f8f5f1] p-2 shadow-sm transition focus-within:border-[var(--auth-accent)]/70 focus-within:bg-white focus-within:ring-4 focus-within:ring-[var(--auth-accent)]/10">
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            rows={2}
            disabled={composerDisabled}
            placeholder="Escribí tu mensaje… Podés pegar capturas con Ctrl+V"
            aria-label="Escribir mensaje"
            className="max-h-40 min-h-[48px] w-full resize-none bg-transparent px-3 py-2 text-[14px] leading-5 text-[var(--auth-text)] placeholder:text-[var(--auth-text-soft)] focus:outline-none disabled:opacity-60"
          />
          <div className="flex items-center justify-between gap-2 px-1 pb-1">
            <div className="flex items-center gap-1">
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPT}
                multiple
                className="hidden"
                onChange={handleFileChange}
              />
              <button
                type="button"
                disabled={sending || composerDisabled}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--auth-text-muted)] transition-colors hover:bg-white hover:text-[var(--auth-text)]"
                aria-label="Adjuntar archivo"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                </svg>
                <span className="sr-only">Adjuntar</span>
              </button>
              <span className="hidden text-[11px] text-[var(--auth-text-soft)] sm:inline">
                Enter envía · Shift+Enter nueva línea
              </span>
            </div>
            <button
              type="button"
              onClick={handleSend}
              disabled={
                composerDisabled ||
                sending ||
                (!inputValue.trim() && pendingFiles.length === 0)
              }
              className="inline-flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-full bg-[var(--brand-primary)] px-4 text-[13px] font-bold text-white shadow-md shadow-orange-500/20 hover:bg-[var(--brand-primary-deep)] disabled:opacity-50"
            >
              {sending ? "Enviando…" : "Enviar"}
              {!sending ? (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
              ) : null}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChatMessageBubble({ message }: { message: ChatMessage }) {
  return (
    <div
      className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[min(88%,32rem)] px-3.5 py-2.5 text-sm shadow-sm ${
          message.role === "user"
            ? "rounded-[18px_18px_5px_18px] bg-[linear-gradient(135deg,var(--brand-primary),#e85a1a)] text-white"
            : "rounded-[18px_18px_18px_5px] bg-white text-[#3f3a34] ring-1 ring-black/5"
        }`}
      >
        {message.text ? <p className="whitespace-pre-wrap">{message.text}</p> : null}
        {message.attachments && message.attachments.length > 0 ? (
          <div className="mt-2 space-y-2">
            {message.attachments.map((attachment) => {
              const isImage = attachment.mimeType.startsWith("image/");
              if (isImage && attachment.url) {
                return (
                  <a
                    key={`${message.id}-${attachment.path}`}
                    href={attachment.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block overflow-hidden rounded-xl"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={attachment.url}
                      alt={attachment.name}
                      className="max-h-56 w-full object-cover"
                    />
                  </a>
                );
              }
              return (
                <a
                  key={`${message.id}-${attachment.path}`}
                  href={attachment.url ?? undefined}
                  target="_blank"
                  rel="noreferrer"
                  className={`inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                    message.role === "user"
                      ? "bg-white/15 text-white"
                      : "bg-[var(--surface-soft)] text-[var(--auth-text)]"
                  }`}
                >
                  📎 {attachment.name}
                </a>
              );
            })}
          </div>
        ) : null}
        {message.senderName ? (
          <p
            className={`mt-1.5 text-[10px] font-semibold ${
              message.role === "user"
                ? "text-white/85"
                : "text-[var(--auth-accent)]"
            }`}
          >
            {message.senderName}
          </p>
        ) : null}
        <p
          className={`mt-1 text-[10px] ${
            message.role === "user" ? "text-white/70" : "text-[#9a9187]"
          }`}
        >
          {message.createdAt
            ? formatSupportChatTimestamp(message.createdAt)
            : message.timestamp}
        </p>
      </div>
    </div>
  );
}
