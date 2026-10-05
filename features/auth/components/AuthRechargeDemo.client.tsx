"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { LandingLocale } from "@/features/landing/i18n/landing-locale";
import styles from "./authRechargeDemo.module.css";

/**
 * Demo del panel de login/registro: un celular que reproduce, como una
 * grabación de pantalla, el flujo real de Ads Holistic — recargar la cartera
 * y asignar ese saldo a la cuenta de TikTok. En cada vuelta cambia de país y de
 * método de pago (solo métodos que la app acepta hoy). Montos ilustrativos.
 */

type Copy = {
  steps: [string, string, string, string];
  appTitle: string;
  walletEyebrow: string;
  walletHint: string;
  reload: string;
  assignCta: string;
  stepAmount: string;
  stepConfirm: string;
  stepPay: string;
  titleAmount: string;
  receiveLabel: string;
  feeHolistic: string;
  totalPay: string;
  gatewayLocal: string;
  reviewCta: string;
  titlePay: string;
  paymentCode: string;
  youPay: string;
  waiting: string;
  titleDone: string;
  inWallet: string;
  titleAssign: string;
  account: string;
  amountLabel: string;
  available: string;
  assigned: string;
  adsTitle: string;
  tiktokBalance: string;
  active: string;
  ready: string;
  cardLabel: string;
  processing: string;
  sendExactly: string;
  network: string;
  methodsLine: string;
  countriesLine: string;
};

const ES: Copy = {
  steps: ["Recarga tu cartera", "Paga como prefieras", "Se acredita al instante", "Asígnalo a TikTok"],
  appTitle: "Pagos y recargas",
  walletEyebrow: "Cartera Holistic",
  walletHint: "Listo para asignar a cuentas TikTok",
  reload: "Recargar saldo",
  assignCta: "Asignar a TikTok",
  stepAmount: "Monto",
  stepConfirm: "Confirmación",
  stepPay: "Pago",
  titleAmount: "¿Cuánto saldo quieres recargar?",
  receiveLabel: "Saldo que recibirás (USD)",
  feeHolistic: "Fee Holistic",
  totalPay: "Total a pagar",
  gatewayLocal: "Yape, Plin y bancos",
  reviewCta: "Revisar recarga",
  titlePay: "Completa el pago",
  paymentCode: "Código de pago",
  youPay: "Pagarás",
  waiting: "Esperando la confirmación del pago…",
  titleDone: "Pago acreditado",
  inWallet: "En tu cartera Holistic",
  titleAssign: "Asignar saldo",
  account: "Tienda Lima 300.0 USD",
  amountLabel: "Monto a asignar (USD)",
  available: "Disponible en cartera",
  assigned: "Se asignaron $100.00 a tu cuenta",
  adsTitle: "Cuentas ads",
  tiktokBalance: "Saldo TikTok",
  active: "Activa",
  ready: "Lista para anunciar",
  cardLabel: "Tarjeta",
  processing: "Procesando el pago…",
  sendExactly: "Envía exactamente",
  network: "Red",
  methodsLine: "Yape · Plin · USDT",
  countriesLine: "Clientes en Perú, Brasil, Colombia, Ecuador y más",
};

const EN: Copy = {
  steps: ["Top up your wallet", "Pay your way", "Credited instantly", "Assign it to TikTok"],
  appTitle: "Payments & top-ups",
  walletEyebrow: "Holistic wallet",
  walletHint: "Ready to assign to TikTok accounts",
  reload: "Top up balance",
  assignCta: "Assign to TikTok",
  stepAmount: "Amount",
  stepConfirm: "Review",
  stepPay: "Payment",
  titleAmount: "How much do you want to add?",
  receiveLabel: "Balance you'll receive (USD)",
  feeHolistic: "Holistic fee",
  totalPay: "Total to pay",
  gatewayLocal: "Yape, Plin & banks",
  reviewCta: "Review top-up",
  titlePay: "Complete the payment",
  paymentCode: "Payment code",
  youPay: "You pay",
  waiting: "Waiting for payment confirmation…",
  titleDone: "Payment credited",
  inWallet: "In your Holistic wallet",
  titleAssign: "Assign balance",
  account: "Lima Store 300.0 USD",
  amountLabel: "Amount to assign (USD)",
  available: "Available in wallet",
  assigned: "$100.00 assigned to your account",
  adsTitle: "Ad accounts",
  tiktokBalance: "TikTok balance",
  active: "Active",
  ready: "Ready to advertise",
  cardLabel: "Card",
  processing: "Processing payment…",
  sendExactly: "Send exactly",
  network: "Network",
  methodsLine: "Yape · Plin · USDT",
  countriesLine: "Clients in Peru, Brazil, Colombia, Ecuador and more",
};

const COPY: Record<LandingLocale, Copy> = {
  es: ES,
  en: EN,
  pt: {
    ...EN,
    steps: ["Recarregue sua carteira", "Pague como preferir", "Creditado na hora", "Envie para o TikTok"],
    cardLabel: "Cartão",
    processing: "Processando o pagamento…",
    sendExactly: "Envie exatamente",
    network: "Rede",
    methodsLine: "Yape · Plin · USDT",
    countriesLine: "Clientes no Peru, Brasil, Colômbia, Equador e mais",
    appTitle: "Pagamentos e recargas",
    walletEyebrow: "Carteira Holistic",
    reload: "Recarregar saldo",
    titleAmount: "Quanto você quer recarregar?",
    titleDone: "Pagamento creditado",
    titleAssign: "Alocar saldo",
    adsTitle: "Contas de anúncios",
  },
  zh: {
    ...EN,
    steps: ["为钱包充值", "选择支付方式", "即时到账", "分配到 TikTok"],
    appTitle: "支付与充值",
    walletEyebrow: "Holistic 钱包",
    reload: "充值",
    titleAmount: "你想充值多少？",
    titleDone: "已到账",
    titleAssign: "分配余额",
    adsTitle: "广告账户",
  },
};

// Un país y un método por vuelta. Solo métodos que la app acepta hoy:
// Yape/Plin (Perú, Cobrana) y USDT (global).
type Lang = "es" | "en" | "pt";
type L = Record<Lang, string>;
type Persona = {
  country: L;
  method: L;
  kind: "code" | "card" | "usdt";
  badge: { text: string; className: "yapeBadge" | "visaBadge" | "mcBadge" | "usdtBadge" };
  pay: string;
  cardNumber?: string;
  notifTitle: L;
  notifDetail: string;
  store: string;
};

const same = (s: string): L => ({ es: s, en: s, pt: s });

const PERSONAS: Persona[] = [
  {
    country: same("Perú"),
    method: { es: "Yape, Plin y bancos", en: "Yape, Plin & banks", pt: "Yape, Plin e bancos" },
    kind: "code",
    badge: { text: "yape", className: "yapeBadge" },
    pay: "S/ 370.70",
    notifTitle: { es: "¡Yapeaste!", en: "Paid with Yape", pt: "Pago com Yape" },
    notifDetail: "S/ 370.70 · Pago de servicios",
    store: "Tienda Lima 300.0 USD",
  },
  {
    country: { es: "Brasil", en: "Brazil", pt: "Brasil" },
    method: { es: "Tarjeta Visa", en: "Visa card", pt: "Cartão Visa" },
    kind: "card",
    badge: { text: "VISA", className: "visaBadge" },
    pay: "$110.00 USD",
    cardNumber: "•••• 4242",
    notifTitle: { es: "Compra aprobada", en: "Purchase approved", pt: "Compra aprovada" },
    notifDetail: "US$ 110.00 · Ads Holistic",
    store: "Loja São Paulo 301.0 USD",
  },
  {
    country: same("Colombia"),
    method: same("USDT · Binance"),
    kind: "usdt",
    badge: { text: "USDT", className: "usdtBadge" },
    pay: "110.00 USDT",
    notifTitle: { es: "Retiro completado", en: "Withdrawal complete", pt: "Saque concluído" },
    notifDetail: "110.00 USDT · TRC20",
    store: "Tienda Bogotá 302.0 USD",
  },
  {
    country: { es: "Ecuador", en: "Ecuador", pt: "Equador" },
    method: { es: "Tarjeta Mastercard", en: "Mastercard", pt: "Cartão Mastercard" },
    kind: "card",
    badge: { text: "MC", className: "mcBadge" },
    pay: "$110.00 USD",
    cardNumber: "•••• 5100",
    notifTitle: { es: "Compra aprobada", en: "Purchase approved", pt: "Compra aprovada" },
    notifDetail: "US$ 110.00 · Ads Holistic",
    store: "Tienda Quito 303.0 USD",
  },
].filter((persona) => persona.kind !== "card") as Persona[];

// Por idioma, con qué país arranca (portugués → Brasil, inglés → tarjeta).
const FIRST_PERSONA: Record<LandingLocale, number> = { es: 0, en: 1, pt: 1, zh: 1 };

// Escenas y cuánto dura cada una (ms). El paso resaltado a la izquierda
// avanza con ellas: 0-1 → paso 1, 2 → paso 2, 3 → paso 3, 4-5 → paso 4.
const SCENES = [2600, 3600, 3400, 2600, 3600, 3200] as const;
const STEP_OF_SCENE = [0, 0, 1, 2, 3, 3] as const;

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";
function subscribeReduced(onChange: () => void): () => void {
  const query = window.matchMedia(REDUCED_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReduced, () => window.matchMedia(REDUCED_QUERY).matches, () => false);
}

export function AuthRechargeDemo({ locale = "es", caption }: { locale?: LandingLocale; caption: { title: string; sub?: string } }) {
  const t = COPY[locale] ?? ES;
  const lang: Lang = locale === "pt" ? "pt" : locale === "es" ? "es" : "en";
  const reduced = useReducedMotion();
  // `tick` cuenta escenas desde el inicio: escena = tick % 6, vuelta = tick / 6.
  const [tick, setTick] = useState(0);
  const scene = tick % SCENES.length;

  useEffect(() => {
    if (reduced) return;
    const timer = window.setTimeout(() => setTick((n) => n + 1), SCENES[scene]);
    return () => window.clearTimeout(timer);
  }, [tick, scene, reduced]);

  // Con «reducir movimiento» se queda en la pantalla final (saldo en TikTok).
  const shown = reduced ? 5 : scene;
  const step = STEP_OF_SCENE[shown];
  const persona = PERSONAS[(FIRST_PERSONA[locale] + Math.floor(tick / SCENES.length)) % PERSONAS.length]!;

  return (
    <div className={styles.stage} aria-hidden="true">
      <div className={styles.glow} />

      <ol className={styles.steps}>
        {t.steps.map((label, i) => (
          <li key={label} className={i === step ? styles.stepActive : i < step ? styles.stepDone : styles.step}>
            <span className={styles.stepNum}>{i < step ? "✓" : i + 1}</span>
            <span>{label}</span>
          </li>
        ))}
        <li className={styles.reach}>
          <span className={styles.reachMethods}>{t.methodsLine}</span>
          <span>{t.countriesLine}</span>
        </li>
      </ol>

      <div key={`badge-${persona.store}`} className={styles.countryBadge}>
        <span className={`${styles.miniBadge} ${styles[persona.badge.className]}`}>{persona.badge.text}</span>
        <span>
          <strong>{persona.country[lang]}</strong> · {persona.method[lang]}
        </span>
      </div>

      <div className={styles.phone}>
        <div className={styles.island} />
        <div className={styles.statusBar}>
          <span>9:41</span>
          <span className={styles.statusIcons}>
            <i /><i /><i />
          </span>
        </div>
        <div className={styles.screen}>
          <div key={shown} className={styles.scene}>
            {shown === 0 ? <ScenePagos t={t} balance="$0.00" tapOn="reload" /> : null}
            {shown === 1 ? <SceneAmount t={t} p={persona} lang={lang} /> : null}
            {shown === 2 ? <ScenePay t={t} p={persona} lang={lang} /> : null}
            {shown === 3 ? <SceneDone t={t} /> : null}
            {shown === 4 ? <SceneAssign t={t} p={persona} /> : null}
            {shown === 5 ? <SceneAds t={t} p={persona} /> : null}
          </div>
        </div>
        <div className={styles.homeBar} />
      </div>

      <div className={styles.captionBox}>
        <p className={styles.captionTitle}>{caption.title}</p>
        {caption.sub ? <p className={styles.captionSub}>{caption.sub}</p> : null}
      </div>
    </div>
  );
}

function AppHeader({ title }: { title: string }) {
  return (
    <div className={styles.appHeader}>
      <span className={styles.appLogo}>h</span>
      <span className={styles.appTitle}>{title}</span>
    </div>
  );
}

/** Dedo virtual: va dentro del botón que «toca», así siempre cae encima. */
function Tap({ delay }: { delay: "early" | "late" }) {
  return <span className={`${styles.tap} ${delay === "early" ? styles.tapEarly : styles.tapLate}`} />;
}

function ScenePagos({ t, balance, tapOn }: { t: Copy; balance: string; tapOn: "reload" }) {
  return (
    <>
      <AppHeader title={t.appTitle} />
      <div className={styles.walletCard}>
        <p className={styles.eyebrow}>{t.walletEyebrow}</p>
        <p className={styles.walletAmount}>{balance}</p>
        <p className={styles.muted}>{t.walletHint}</p>
        <div className={styles.walletButtons}>
          <span className={`${styles.btnPrimary} ${tapOn === "reload" ? styles.pressEarly : ""}`}>
            {t.reload}
            <Tap delay="early" />
          </span>
          <span className={styles.btnGhost}>{t.assignCta}</span>
        </div>
      </div>
      <div className={styles.skeleton} />
      <div className={`${styles.skeleton} ${styles.skeletonShort}`} />
    </>
  );
}

function Stepper({ t, active }: { t: Copy; active: number }) {
  return (
    <div className={styles.stepper}>
      {[t.stepAmount, t.stepConfirm, t.stepPay].map((label, i) => (
        <div key={label} className={styles.stepperItem}>
          <span className={i <= active ? styles.stepperBarOn : styles.stepperBar} />
          <span className={i === active ? styles.stepperLabelOn : styles.stepperLabel}>{label}</span>
        </div>
      ))}
    </div>
  );
}

function MethodBadge({ p }: { p: Persona }) {
  return <span className={`${styles.miniBadge} ${styles[p.badge.className]}`}>{p.badge.text}</span>;
}

function SceneAmount({ t, p, lang }: { t: Copy; p: Persona; lang: Lang }) {
  return (
    <div className={styles.sheet}>
      <Stepper t={t} active={0} />
      <p className={styles.sheetTitle}>{t.titleAmount}</p>
      <p className={styles.fieldLabel}>{t.receiveLabel}</p>
      <div className={styles.field}>
        <span className={styles.currency}>$</span>
        <span className={styles.typing}>100.00</span>
        <span className={styles.caret} />
      </div>
      <div className={styles.summary}>
        <div><span>{t.feeHolistic}</span><span>$10.00</span></div>
        <div className={styles.summaryTotal}><span>{t.totalPay}</span><span>$110.00</span></div>
      </div>
      <div className={styles.gateway}>
        <MethodBadge p={p} />
        <span>{p.method[lang]}</span>
        <span className={styles.radioOn} />
      </div>
      <span className={`${styles.btnPrimary} ${styles.btnBlock} ${styles.pressLate}`}>
        {t.reviewCta}
        <Tap delay="late" />
      </span>
    </div>
  );
}

function ScenePay({ t, p, lang }: { t: Copy; p: Persona; lang: Lang }) {
  return (
    <div className={styles.sheet}>
      <Stepper t={t} active={2} />
      <p className={styles.sheetTitle}>{t.titlePay}</p>
      <div className={styles.payBox}>
        {p.kind === "code" ? (
          <>
            <p className={styles.eyebrow}>{t.paymentCode}</p>
            <p className={styles.payCode}>4821 0937</p>
          </>
        ) : null}
        {p.kind === "card" ? (
          <>
            <p className={styles.eyebrow}>{t.cardLabel}</p>
            <p className={styles.payCard}>
              <MethodBadge p={p} />
              <span>{p.cardNumber}</span>
            </p>
          </>
        ) : null}
        {p.kind === "usdt" ? (
          <>
            <p className={styles.eyebrow}>{t.sendExactly}</p>
            <p className={styles.payCode}>110.00 USDT</p>
            <p className={styles.payAddress}>TQ4x…9fA2 · {t.network} TRC20</p>
          </>
        ) : null}
        <div className={styles.payRow}>
          <span>{t.youPay}</span>
          <strong>{p.pay}</strong>
        </div>
      </div>
      <div className={styles.waiting}>
        <span className={styles.spinner} />
        <span>{p.kind === "card" ? t.processing : t.waiting}</span>
      </div>
      <div className={styles.yapeNotif}>
        <MethodBadge p={p} />
        <span>
          <strong>{p.notifTitle[lang]}</strong>
          <span>{p.notifDetail}</span>
        </span>
      </div>
    </div>
  );
}

function SceneDone({ t }: { t: Copy }) {
  return (
    <div className={styles.doneWrap}>
      <span className={styles.doneCheck}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </span>
      <p className={styles.doneTitle}>{t.titleDone}</p>
      <p className={styles.doneAmount}>+ $100.00</p>
      <p className={styles.muted}>{t.inWallet}</p>
      <span className={styles.confetti} />
    </div>
  );
}

function SceneAssign({ t, p }: { t: Copy; p: Persona }) {
  return (
    <div className={styles.sheet}>
      <p className={styles.sheetTitle}>{t.titleAssign}</p>
      <div className={styles.accountRow}>
        <span className={styles.tiktokDot} />
        <span className={styles.accountName}>{p.store}</span>
        <span className={styles.radioOn} />
      </div>
      <p className={styles.fieldLabel}>{t.amountLabel}</p>
      <div className={styles.field}>
        <span className={styles.currency}>$</span>
        <span>100.00</span>
      </div>
      <p className={styles.helper}>{t.available}: <strong>$100.00</strong></p>
      <span className={`${styles.btnPrimary} ${styles.btnBlock} ${styles.pressEarly}`}>
        {t.titleAssign}
        <Tap delay="early" />
      </span>
      <div className={styles.toastOk}>✓ {t.assigned}</div>
    </div>
  );
}

function SceneAds({ t, p }: { t: Copy; p: Persona }) {
  return (
    <>
      <AppHeader title={t.adsTitle} />
      <div className={styles.adCard}>
        <div className={styles.adHead}>
          <span className={styles.tiktokDot} />
          <span className={styles.accountName}>{p.store}</span>
          <span className={styles.activePill}>{t.active}</span>
        </div>
        <p className={styles.eyebrow}>{t.tiktokBalance}</p>
        <p className={styles.walletAmount}>
          <span className={styles.countUp}>$100.00</span>
        </p>
        <div className={styles.adBar}><span /></div>
        <p className={styles.readyText}>● {t.ready}</p>
      </div>
      <div className={styles.skeleton} />
      <div className={`${styles.skeleton} ${styles.skeletonShort}`} />
    </>
  );
}
