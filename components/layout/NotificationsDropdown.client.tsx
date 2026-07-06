"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { routes } from "@/config/routes";
import { apiClient } from "@/lib/api/api-client.client";

interface NotificationItem {
  id: string;
  title: string;
  body: string | null;
  type: string;
  data: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

interface NotificationsResponse {
  ok: boolean;
  notifications: NotificationItem[];
}

function formatRelativeDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Ahora";

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60_000));
  if (diffMinutes < 1) return "Ahora";
  if (diffMinutes < 60) return `Hace ${diffMinutes} min`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `Hace ${diffHours} h`;

  return date.toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "short",
  });
}

function getNotificationUrl(item: NotificationItem): string | null {
  const url = item.data.url;
  if (typeof url !== "string" || !url.startsWith("/")) return null;
  return url;
}

export function NotificationsDropdown() {
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.readAt).length,
    [notifications],
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!dropdownRef.current) return;
      if (!dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function loadNotifications() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient<NotificationsResponse>(routes.api.notifications);
      setNotifications(data.notifications ?? []);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudieron cargar las notificaciones.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle() {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (nextOpen && notifications.length === 0) {
      await loadNotifications();
    }
  }

  async function markAsRead(item: NotificationItem) {
    if (item.readAt) return;
    const readAt = new Date().toISOString();
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === item.id ? { ...notification, readAt } : notification,
      ),
    );
    try {
      await apiClient(`/api/notifications/${item.id}/read`, { method: "PATCH" });
    } catch {
      setNotifications((current) =>
        current.map((notification) =>
          notification.id === item.id
            ? { ...notification, readAt: item.readAt }
            : notification,
        ),
      );
    }
  }

  async function handleNotificationClick(item: NotificationItem) {
    await markAsRead(item);
    const url = getNotificationUrl(item);
    if (url) {
      setOpen(false);
      router.push(url);
      router.refresh();
    }
  }

  return (
    <div ref={dropdownRef} className="relative hidden md:block">
      <button
        type="button"
        onClick={() => {
          void handleToggle();
        }}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-2xl text-[#64748b] transition-colors hover:bg-white hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4056ff]/40"
        aria-label="Notificaciones"
        aria-expanded={open}
      >
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#ef4444] px-1.5 text-[10px] font-black text-white ring-2 ring-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-3 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-3xl border border-[#e2e8f0] bg-white shadow-2xl shadow-slate-900/12">
          <div className="flex items-center justify-between border-b border-[#eef2f7] px-4 py-3">
            <div>
              <p className="text-sm font-black text-[#0f172a]">Notificaciones</p>
              <p className="text-xs text-[#64748b]">
                {unreadCount === 0
                  ? "Todo leído"
                  : `${unreadCount} sin leer`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                void loadNotifications();
              }}
              disabled={loading}
              className="rounded-xl px-2.5 py-1.5 text-xs font-bold text-[#4056ff] transition hover:bg-[#eef2ff] disabled:opacity-50"
            >
              Actualizar
            </button>
          </div>

          <div className="max-h-[420px] overflow-y-auto p-2">
            {loading && notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-[#64748b]">
                Cargando notificaciones…
              </div>
            ) : error ? (
              <div className="rounded-2xl bg-[#fef2f2] px-4 py-3 text-sm text-[#991b1b]">
                {error}
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-[#64748b]">
                No tienes notificaciones por ahora.
              </div>
            ) : (
              <div className="space-y-1.5">
                {notifications.map((item) => {
                  const isUnread = !item.readAt;
                  const url = getNotificationUrl(item);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        void handleNotificationClick(item);
                      }}
                      className="w-full rounded-2xl px-3 py-3 text-left transition hover:bg-[#f8fafc]"
                    >
                      <div className="flex gap-3">
                        <span
                          className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                            isUnread ? "bg-[#4056ff]" : "bg-[#cbd5e1]"
                          }`}
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-start justify-between gap-2">
                            <span className="line-clamp-2 text-sm font-black text-[#0f172a]">
                              {item.title}
                            </span>
                            <span className="shrink-0 text-[11px] font-semibold text-[#94a3b8]">
                              {formatRelativeDate(item.createdAt)}
                            </span>
                          </span>
                          {item.body && (
                            <span className="mt-1 line-clamp-2 text-xs leading-5 text-[#64748b]">
                              {item.body}
                            </span>
                          )}
                          {url && (
                            <span className="mt-1 inline-flex text-[11px] font-bold text-[#4056ff]">
                              Abrir detalle
                            </span>
                          )}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
