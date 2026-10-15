"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { LandingLocale } from "@/features/landing/i18n/landing-locale";
import styles from "./authLivePreview.module.css";

/**
 * Panel del login/registro: una vista animada de Ads Holistic en vivo
 * (gasto de TikTok subiendo, cartera, avisos de recarga) en vez de una foto.
 * Todo es ilustrativo; con «reducir movimiento» queda quieto.
 */

type Copy = {
  live: string;
  account: string;
  spendToday: string;
  budget: string;
  wallet: string;
  walletHint: string;
  results: string;
  toasts: Array<{ title: string; detail: string; tone: "ok" | "info" | "spend" }>;
};

const COPY: Record<LandingLocale, Copy> = {
  es: {
    live: "En vivo",
    account: "Cuenta TikTok · 300.0 USD",
    spendToday: "Gasto de hoy",
    budget: "del presupuesto",
    wallet: "Saldo en cartera",
    walletHint: "Listo para asignar",
    results: "Conversiones",
    toasts: [
      { title: "Recarga confirmada", detail: "+ S/ 350.00 · Yape", tone: "ok" },
      { title: "Saldo asignado", detail: "$ 90.00 → cuenta 300.0", tone: "info" },
      { title: "Campaña activa", detail: "CPA $ 2.10 · 38 ventas", tone: "spend" },
    ],
  },
  en: {
    live: "Live",
    account: "TikTok account · 300.0 USD",
    spendToday: "Spend today",
    budget: "of budget",
    wallet: "Wallet balance",
    walletHint: "Ready to assign",
    results: "Conversions",
    toasts: [
      { title: "Top-up confirmed", detail: "+ $ 100.00 · Card", tone: "ok" },
      { title: "Balance assigned", detail: "$ 90.00 → account 300.0", tone: "info" },
      { title: "Campaign live", detail: "CPA $ 2.10 · 38 sales", tone: "spend" },
    ],
  },
  pt: {
    live: "Ao vivo",
    account: "Conta TikTok · 300.0 USD",
    spendToday: "Gasto de hoje",
    budget: "do orçamento",
    wallet: "Saldo na carteira",
    walletHint: "Pronto para alocar",
    results: "Conversões",
    toasts: [
      { title: "Recarga confirmada", detail: "+ $ 100.00 · Cartão", tone: "ok" },
      { title: "Saldo alocado", detail: "$ 90.00 → conta 300.0", tone: "info" },
      { title: "Campanha ativa", detail: "CPA $ 2.10 · 38 vendas", tone: "spend" },
    ],
  },
  zh: {
    live: "实时",
    account: "TikTok 账户 · 300.0 USD",
    spendToday: "今日消耗",
    budget: "预算已用",
    wallet: "钱包余额",
    walletHint: "可分配",
    results: "转化",
    toasts: [
      { title: "充值成功", detail: "+ $ 100.00", tone: "ok" },
      { title: "余额已分配", detail: "$ 90.00 → 账户 300.0", tone: "info" },
      { title: "广告投放中", detail: "CPA $ 2.10 · 38 单", tone: "spend" },
    ],
  },
};

// Curva del día: 12 puntos que la línea dibuja de izquierda a derecha.
const SPARK = [6, 9, 8, 13, 12, 18, 17, 24, 22, 29, 33, 38];

function sparkPath(width: number, height: number): string {
  const max = Math.max(...SPARK);
  const step = width / (SPARK.length - 1);
  return SPARK.map((v, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)} ${(height - (v / max) * height).toFixed(1)}`).join(" ");
}

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void): () => void {
  const query = window.matchMedia(REDUCED_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_QUERY).matches,
    () => false,
  );
}

/** Gasto que sube a saltos chicos (como en Cuentas ads) y avisos que rotan. */
function useLiveDemo(toastCount: number) {
  const reduced = useReducedMotion();
  const [spend, setSpend] = useState(128.4);
  const [toast, setToast] = useState(0);

  useEffect(() => {
    if (reduced) return;
    const spendTimer = window.setInterval(() => {
      setSpend((s) => (s > 186 ? 128.4 : Math.round((s + 0.37 + Math.random() * 0.9) * 100) / 100));
    }, 900);
    const toastTimer = window.setInterval(() => setToast((i) => (i + 1) % toastCount), 3200);
    return () => {
      window.clearInterval(spendTimer);
      window.clearInterval(toastTimer);
    };
  }, [reduced, toastCount]);

  return { spend, toast };
}

/** Versión chica para celular, arriba del formulario (en escritorio se oculta). */
export function AuthLiveCompact({ locale = "es" }: { locale?: LandingLocale }) {
  const t = COPY[locale] ?? COPY.es;
  const { spend, toast } = useLiveDemo(t.toasts.length);
  const current = t.toasts[toast]!;
  return (
    <div className={styles.compact} aria-hidden="true">
      <span className={styles.tiktokDot} />
      <div className={styles.compactMain}>
        <div className={styles.compactTop}>
          <span className={styles.compactNumber}>$ {spend.toFixed(2)}</span>
          <span className={styles.livePill}>
            <span className={styles.liveDot} />
            {t.live}
          </span>
        </div>
        <p key={toast} className={styles.compactToast}>
          <strong>{current.title}</strong> · {current.detail}
        </p>
      </div>
      <svg className={styles.compactSpark} viewBox="0 0 240 56" preserveAspectRatio="none">
        <path d={sparkPath(240, 52)} className={styles.sparkLine} pathLength={1} />
      </svg>
    </div>
  );
}
