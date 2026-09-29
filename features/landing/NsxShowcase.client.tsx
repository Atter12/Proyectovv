"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import type { LandingCopy, ShowcaseTabId } from "./i18n/landing-copy";

const AUTOPLAY_MS = 7000;

type Mock = LandingCopy["showcase"]["mock"];

function Check() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="m3.5 8.5 3 3 6-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AccountsMock({ m }: { m: Mock["accounts"] }) {
  const rows = [
    { name: `${m.account} 01`, status: m.active, ok: true, spend: "$ 412.30" },
    { name: `${m.account} 02`, status: m.active, ok: true, spend: "$ 268.90" },
    { name: `${m.account} 03`, status: m.review, ok: false, spend: "$ 0.00" },
  ];
  return (
    <div className="nsx-mock-card">
      <div className="nsx-mock-head">
        <strong>{m.header}</strong>
        <span className="nsx-mock-btn">{m.create}</span>
      </div>
      <ul className="nsx-mock-list">
        {rows.map((r, i) => (
          <li key={r.name} style={{ animationDelay: `${i * 90}ms` }}>
            <span className="nsx-mock-avatar">{r.name.slice(-2)}</span>
            <span className="nsx-mock-grow">{r.name}</span>
            <span className="nsx-mock-muted">{r.spend}</span>
            <span className={cn("nsx-mock-pill", r.ok ? "is-ok" : "is-warn")}>{r.status}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function WalletMock({ m }: { m: Mock["wallet"] }) {
  const split = [
    { name: `${m.account} 01`, pct: 48 },
    { name: `${m.account} 02`, pct: 32 },
    { name: `${m.account} 03`, pct: 20 },
  ];
  return (
    <div className="nsx-mock-card">
      <div className="nsx-mock-balance">
        <span className="nsx-mock-muted">{m.balance}</span>
        <strong>USD 1,250.00</strong>
        <span className="nsx-mock-btn is-dark">{m.topup}</span>
      </div>
      <p className="nsx-mock-sub">{m.assigned}</p>
      <ul className="nsx-mock-bars">
        {split.map((s, i) => (
          <li key={s.name}>
            <span>{s.name}</span>
            <span className="nsx-mock-bar">
              <span style={{ width: `${s.pct}%`, animationDelay: `${i * 120}ms` }} />
            </span>
            <span className="nsx-mock-muted">{s.pct}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ProfitMock({ m }: { m: Mock["profit"] }) {
  const days = [38, 52, 45, 70, 62, 84, 76];
  return (
    <div className="nsx-mock-card">
      <div className="nsx-mock-kpis">
        <div><span>{m.spendToday}</span><strong>$ 186.40</strong></div>
        <div><span>{m.roas}</span><strong className="is-up">3.4x</strong></div>
        <div><span>{m.cpa}</span><strong>$ 4.12</strong></div>
      </div>
      <p className="nsx-mock-sub">{m.chart}</p>
      <div className="nsx-mock-chart" aria-hidden>
        {days.map((h, i) => (
          <span key={i} style={{ height: `${h}%`, animationDelay: `${i * 70}ms` }} />
        ))}
      </div>
      <p className="nsx-mock-alert">⚠ {m.alert}</p>
    </div>
  );
}

function CodMock({ m }: { m: Mock["cod"] }) {
  const steps = [
    { label: m.orders, value: 240, pct: 100 },
    { label: m.delivered, value: 188, pct: 78 },
    { label: m.collected, value: 171, pct: 71 },
  ];
  return (
    <div className="nsx-mock-card">
      <div className="nsx-mock-head">
        <strong>Shopify · COD</strong>
        <span className="nsx-mock-pill is-ok">{m.addon}</span>
      </div>
      <ul className="nsx-mock-funnel">
        {steps.map((s, i) => (
          <li key={s.label}>
            <span className="nsx-mock-funnel-bar" style={{ width: `${s.pct}%`, animationDelay: `${i * 120}ms` }}>
              <span>{s.label}</span>
              <strong>{s.value}</strong>
            </span>
          </li>
        ))}
      </ul>
      <div className="nsx-mock-kpis is-two">
        <div><span>{m.realRoas}</span><strong className="is-up">2.7x</strong></div>
        <div><span>{m.collected}</span><strong>71%</strong></div>
      </div>
    </div>
  );
}

function PixelMock({ m }: { m: Mock["pixel"] }) {
  const events = ["ViewContent", "AddToCart", "InitiateCheckout", "PlaceAnOrder", "CompletePayment"];
  return (
    <div className="nsx-mock-card">
      <div className="nsx-mock-head">
        <strong>{m.pixel}</strong>
        <span className="nsx-mock-muted">{m.linked}</span>
      </div>
      <ul className="nsx-mock-events">
        {events.map((e, i) => (
          <li key={e} style={{ animationDelay: `${i * 80}ms` }}>
            <span className="nsx-mock-check"><Check /></span>
            <code>{e}</code>
          </li>
        ))}
      </ul>
      <span className="nsx-mock-btn is-dark is-block">{m.test}</span>
    </div>
  );
}

function SupportMock({ m }: { m: Mock["support"] }) {
  return (
    <div className="nsx-mock-card">
      <div className="nsx-mock-chat">
        <span className="nsx-mock-avatar is-accent">H</span>
        <div>
          <strong>{m.chat}</strong>
          <p>{m.chatMsg}</p>
        </div>
      </div>
      <div className="nsx-mock-meeting">
        <span className="nsx-mock-cal" aria-hidden>📅</span>
        <div>
          <strong>{m.meeting}</strong>
          <span className="nsx-mock-muted">{m.when}</span>
        </div>
      </div>
      <p className="nsx-mock-sub">{m.academy}</p>
      <ul className="nsx-mock-list is-compact">
        {m.lessons.map((l, i) => (
          <li key={l} style={{ animationDelay: `${i * 90}ms` }}>
            <span className="nsx-mock-play" aria-hidden>▶</span>
            <span className="nsx-mock-grow">{l}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TabMock({ id, mock }: { id: ShowcaseTabId; mock: Mock }) {
  switch (id) {
    case "accounts":
      return <AccountsMock m={mock.accounts} />;
    case "wallet":
      return <WalletMock m={mock.wallet} />;
    case "profit":
      return <ProfitMock m={mock.profit} />;
    case "cod":
      return <CodMock m={mock.cod} />;
    case "pixel":
      return <PixelMock m={mock.pixel} />;
    default:
      return <SupportMock m={mock.support} />;
  }
}

/**
 * Recorrido interactivo del producto: pestañas que avanzan solas mientras la
 * sección está en pantalla; al tocar una pestaña se detiene el autoplay.
 */
export function NsxShowcase({ copy }: { copy: LandingCopy["showcase"] }) {
  const [active, setActive] = useState(0);
  // Sin autoplay si el usuario pidió menos movimiento (solo afecta al cliente).
  const [autoplay, setAutoplay] = useState(
    () => typeof window === "undefined" || !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [visible, setVisible] = useState(false);
  const rootRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    const io = new IntersectionObserver(([entry]) => setVisible(Boolean(entry?.isIntersecting)), {
      threshold: 0.35,
    });
    io.observe(node);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!autoplay || !visible) return;
    const id = window.setTimeout(() => {
      setActive((i) => (i + 1) % copy.tabs.length);
    }, AUTOPLAY_MS);
    return () => window.clearTimeout(id);
  }, [active, autoplay, visible, copy.tabs.length]);

  const tab = copy.tabs[active];
  const running = autoplay && visible;

  return (
    <section ref={rootRef} className="nsx-section nsx-showcase" id="producto">
      <div className="nsx-container">
        <div className="nsx-section-head">
          <span className="nsx-pill">{copy.pill}</span>
          <h2 className="nsx-h2">{copy.title}</h2>
          <p>{copy.lead}</p>
        </div>

        <div className="nsx-showcase-grid">
          <div className="nsx-showcase-tabs" role="tablist" aria-label={copy.pill}>
            {copy.tabs.map((t, i) => {
              const selected = i === active;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  id={`showcase-tab-${t.id}`}
                  aria-selected={selected}
                  aria-controls="showcase-panel"
                  tabIndex={selected ? 0 : -1}
                  className={cn("nsx-showcase-tab", selected && "is-active")}
                  onClick={() => {
                    setActive(i);
                    setAutoplay(false);
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "ArrowRight" && event.key !== "ArrowDown" && event.key !== "ArrowLeft" && event.key !== "ArrowUp") return;
                    event.preventDefault();
                    const dir = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
                    const next = (i + dir + copy.tabs.length) % copy.tabs.length;
                    setActive(next);
                    setAutoplay(false);
                    document.getElementById(`showcase-tab-${copy.tabs[next].id}`)?.focus();
                  }}
                >
                  <span className="nsx-showcase-tab-n">{String(i + 1).padStart(2, "0")}</span>
                  <span>{t.label}</span>
                  {selected && running ? (
                    <span key={active} className="nsx-showcase-progress" style={{ animationDuration: `${AUTOPLAY_MS}ms` }} aria-hidden />
                  ) : null}
                </button>
              );
            })}
          </div>

          <div
            id="showcase-panel"
            role="tabpanel"
            aria-labelledby={`showcase-tab-${tab.id}`}
            className="nsx-showcase-panel"
          >
            <div key={tab.id} className="nsx-showcase-copy">
              <h3>{tab.title}</h3>
              <p>{tab.body}</p>
              <ul>
                {tab.bullets.map((b) => (
                  <li key={b}>
                    <span className="nsx-mock-check"><Check /></span>
                    {b}
                  </li>
                ))}
              </ul>
            </div>
            <div key={`mock-${tab.id}`} className="nsx-showcase-mock">
              <TabMock id={tab.id} mock={copy.mock} />
              <span className="nsx-showcase-sample">{copy.sample}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
