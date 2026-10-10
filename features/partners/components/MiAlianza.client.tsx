"use client";

import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import {
  saveMyPartnerAction,
  uploadMyPartnerImageAction,
  type MyPartnerImageKind,
  type MyPartnerInput,
} from "../my-partner-actions";
import {
  PARTNER_ACCENT_RE,
  PARTNER_LOGO_SIZE,
  PARTNER_THEME_COLORS,
  partnerLogoSize,
  partnerPalette,
  type Partner,
} from "@/lib/partners/partners.shared";
import type { PartnerPanelData } from "@/lib/partners/partner-panel.server";

const SITE = "https://www.adsholistic.com";
const DEFAULT_HEADLINE = "Lanza y escala tus campañas de TikTok";
const DEFAULT_SUB = "Cuentas de agencia, recarga desde cualquier país y saldo al instante. Todo en una sola app.";

const usd = (cents: number) =>
  `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString("es-PE", { day: "2-digit", month: "long", year: "numeric", timeZone: "America/Lima" });

type Props = {
  partner: Partner & { contractSignedAt: string };
  panel: PartnerPanelData | null;
};

export function MiAlianza({ partner, panel }: Props) {
  const [form, setForm] = useState<MyPartnerInput>({
    name: partner.name,
    companyName: partner.companyName ?? "",
    headline: partner.headline ?? "",
    subheadline: partner.subheadline ?? "",
    accentColor: partner.accentColor,
    theme: partner.theme,
    whatsapp: partner.whatsapp ?? "",
    secondaryColor: partner.secondaryColor ?? partner.accentColor,
    backgroundColor: partner.backgroundColor ?? PARTNER_THEME_COLORS[partner.theme].background,
    textColor: partner.textColor ?? PARTNER_THEME_COLORS[partner.theme].text,
    logoSize: partnerLogoSize(partner.logoSize),
    bannerLink: partner.bannerLink ?? "",
  });
  const [images, setImages] = useState<Record<MyPartnerImageKind, string | null>>({
    logo: partner.logoUrl,
    photo: partner.photoUrl,
    favicon: partner.faviconUrl,
    banner: partner.bannerUrl,
    banner_mobile: partner.bannerMobileUrl,
  });
  const [saved, setSaved] = useState<MyPartnerInput>(form);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState<MyPartnerImageKind | null>(null);

  const link = `${SITE}/a/${partner.slug}`;
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  const set = <K extends keyof MyPartnerInput>(key: K, value: MyPartnerInput[K]) => {
    setNotice(null);
    setForm((f) => ({ ...f, [key]: value }));
  };

  const save = () => {
    setError(null);
    startTransition(async () => {
      const r = await saveMyPartnerAction(form);
      if (!r.ok) return setError(r.error);
      setSaved(form);
      setNotice("Listo. Tu landing ya muestra los cambios.");
    });
  };

  const upload = async (kind: MyPartnerImageKind, file: File | null) => {
    setError(null);
    setNotice(null);
    setUploading(kind);
    const data = new FormData();
    data.set("kind", kind);
    if (file) data.set("file", file);
    const r = await uploadMyPartnerImageAction(data);
    setUploading(null);
    if (!r.ok) return setError(r.error);
    setImages((prev) => ({ ...prev, [kind]: r.url ?? null }));
    setNotice(file ? "Imagen actualizada." : "Imagen quitada.");
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      window.prompt("Copia tu link:", link);
    }
  };

  const signups = panel?.clients.length ?? 0;
  const paying = panel?.clients.filter((c) => c.payments > 0).length ?? 0;
  // Alianza sin comisión (p. ej. el aliado y sus clientes pagan fee preferencial).
  const earns = partner.commissionRate > 0;
  const imageField = (kind: MyPartnerImageKind) => ({
    url: images[kind],
    busy: uploading === kind,
    onPick: (f: File) => upload(kind, f),
    onRemove: () => upload(kind, null),
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9a6b4a]">Tu alianza</p>
        <h1 className="mt-0.5 text-[1.15rem] font-semibold tracking-[-0.02em] text-[#1a1714]">Alianzas</h1>
        <p className="mt-1 max-w-2xl text-[13px] leading-5 text-[#6b645c]">
          Comparte tu link. Quien se registre por ahí queda a tu nombre
          {earns ? (
            <>
              {" "}y ganas el <strong>{Math.round(partner.commissionRate * 100)}% del fee</strong> que le cobramos durante{" "}
              {partner.commissionDays} días desde que se registra
            </>
          ) : null}
          . Contrato firmado el {fecha(partner.contractSignedAt)}.
        </p>
      </header>

      {/* Link */}
      <section className="rounded-2xl border border-[#ece4da] bg-white p-4 sm:p-5">
        <p className="text-[12px] font-semibold text-[#6b645c]">Tu link para compartir</p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
          <code className="min-w-0 flex-1 truncate rounded-xl border border-[#efe7de] bg-[#fcfbf9] px-3 py-2.5 text-[14px] font-semibold text-[#1a1714]">
            {link.replace("https://", "")}
          </code>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={copy}
              className="h-10 flex-1 rounded-xl bg-[#1a1714] px-4 text-[13px] font-semibold text-white transition hover:bg-black sm:flex-none"
            >
              {copied ? "Copiado ✓" : "Copiar link"}
            </button>
            <a
              href={link}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 flex-1 items-center justify-center rounded-xl border border-[#e3dbd1] px-4 text-[13px] font-semibold text-[#3a332d] transition hover:bg-[#f7f5f2] sm:flex-none"
            >
              Ver mi landing
            </a>
          </div>
        </div>
      </section>

      {/* Números */}
      <section className={`grid grid-cols-2 gap-3 ${earns ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
        <Stat label="Visitas · 30 días" value={String(panel?.visits30d ?? 0)} hint={`${panel?.uniqueVisitors30d ?? 0} personas`} />
        <Stat label="Registros" value={String(signups)} hint="a tu nombre" />
        <Stat label="Clientes que pagan" value={String(paying)} hint={signups ? `${Math.round((paying / signups) * 100)}% de registros` : "—"} />
        {earns ? (
          <Stat
            label="Comisión por cobrar"
            value={usd(panel?.commissionPendingCents ?? 0)}
            hint={`Cobrado ${usd(panel?.commissionPaidCents ?? 0)}`}
            accent
          />
        ) : null}
      </section>

      {/* Editor + vista previa */}
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="flex flex-col gap-4 rounded-2xl border border-[#ece4da] bg-white p-4 sm:p-5">
          <div>
            <h2 className="text-[15px] font-semibold text-[#1a1714]">Diseña tu landing</h2>
            <p className="mt-0.5 text-[12.5px] text-[#6b645c]">Los cambios se ven al lado. Guarda para publicarlos.</p>
          </div>

          <Group title="Marca">
            <ImageField label="Logo de tu empresa" hint="PNG con fondo transparente se ve mejor. Máx. 2 MB." {...imageField("logo")} />
            <Field label="Tamaño del logo" counter={`${form.logoSize} px`}>
              <input
                type="range"
                min={PARTNER_LOGO_SIZE.min}
                max={PARTNER_LOGO_SIZE.max}
                step={2}
                value={form.logoSize}
                onChange={(e) => set("logoSize", Number(e.target.value))}
                className="w-full cursor-pointer"
                style={{ accentColor: "#1a1714" }}
              />
            </Field>
            <ImageField
              label="Favicon"
              hint="El iconito de la pestaña del navegador. Cuadrado (64 × 64), PNG o ICO, máx. 512 KB."
              small
              {...imageField("favicon")}
            />
            <Field label="Nombre de tu empresa">
              <input
                value={form.companyName}
                maxLength={80}
                placeholder="Ej. Autoecompro"
                onChange={(e) => set("companyName", e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Tu nombre">
              <input value={form.name} maxLength={80} onChange={(e) => set("name", e.target.value)} className={inputCls} />
            </Field>
            <ImageField
              label="Tu foto (opcional)"
              hint="Aparece como «Recomendado por». Cuadrada, máx. 2 MB."
              round
              {...imageField("photo")}
            />
          </Group>

          <Group title="Colores">
            <div className="grid gap-3 sm:grid-cols-2">
              <ColorField
                label="Color principal"
                hint="Botones de «Crear mi cuenta»."
                value={form.accentColor}
                onChange={(v) => set("accentColor", v)}
              />
              <ColorField
                label="Color secundario"
                hint="Detalles, pasos y franja final."
                value={form.secondaryColor}
                onChange={(v) => set("secondaryColor", v)}
              />
              <ColorField
                label="Color de fondo"
                hint="Fondo de toda la página."
                value={form.backgroundColor}
                onChange={(v) => set("backgroundColor", v)}
              />
              <ColorField
                label="Color del texto"
                hint="Títulos y textos."
                value={form.textColor}
                onChange={(v) => set("textColor", v)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[12px] text-[#9b928a]">Empezar desde:</span>
              {(["light", "dark"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setNotice(null);
                    setForm((f) => ({
                      ...f,
                      theme: t,
                      backgroundColor: PARTNER_THEME_COLORS[t].background,
                      textColor: PARTNER_THEME_COLORS[t].text,
                    }));
                  }}
                  className="inline-flex h-8 items-center gap-2 rounded-lg border border-[#e3dbd1] px-3 text-[12px] font-semibold text-[#3a332d] transition hover:bg-[#f7f5f2]"
                >
                  <span className="h-3.5 w-3.5 rounded-full border border-black/10" style={{ background: PARTNER_THEME_COLORS[t].background }} />
                  {t === "light" ? "Fondo claro" : "Fondo oscuro"}
                </button>
              ))}
            </div>
          </Group>

          <Group title="Banners">
            <p className="-mt-1 text-[12px] text-[#9b928a]">
              Van debajo del inicio de tu landing. En celular se ve el de celular; si subes uno solo, se usa en los dos.
            </p>
            <BannerField label="Banner para computadora" size="1224 × 270" {...imageField("banner")} />
            <BannerField label="Banner para celular" size="800 × 270" {...imageField("banner_mobile")} />
            <Field label="Link del banner (opcional)">
              <input
                value={form.bannerLink}
                maxLength={300}
                inputMode="url"
                placeholder="https://…"
                onChange={(e) => set("bannerLink", e.target.value)}
                className={inputCls}
              />
            </Field>
          </Group>

          <Group title="Textos">
            <Field label="Título" counter={`${form.headline.length}/120`}>
              <input
                value={form.headline}
                maxLength={120}
                placeholder={DEFAULT_HEADLINE}
                onChange={(e) => set("headline", e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Subtítulo" counter={`${form.subheadline.length}/240`}>
              <textarea
                value={form.subheadline}
                maxLength={240}
                rows={3}
                placeholder={DEFAULT_SUB}
                onChange={(e) => set("subheadline", e.target.value)}
                className={`${inputCls} h-auto resize-none py-2 leading-5`}
              />
            </Field>
            <Field label="Tu WhatsApp (con código de país)">
              <input
                value={form.whatsapp}
                inputMode="tel"
                placeholder="51987654321"
                onChange={(e) => set("whatsapp", e.target.value)}
                className={inputCls}
              />
            </Field>
          </Group>

          {error ? <p className="rounded-xl bg-[#fff1ee] px-3 py-2 text-[13px] text-[#a32e23]">{error}</p> : null}
          {notice ? <p className="rounded-xl bg-[#ecfdf3] px-3 py-2 text-[13px] text-[#15803d]">{notice}</p> : null}

          <div className="sticky bottom-0 -mx-4 -mb-4 flex items-center justify-end gap-2 rounded-b-2xl border-t border-[#f1ebe4] bg-white/95 px-4 py-3 backdrop-blur sm:-mx-5 sm:-mb-5 sm:px-5">
            {dirty ? <span className="mr-auto text-[12px] text-[#9a6b4a]">Tienes cambios sin guardar</span> : null}
            <button
              type="button"
              disabled={!dirty || pending}
              onClick={() => {
                setForm(saved);
                setError(null);
              }}
              className="h-10 rounded-xl px-4 text-[13px] font-semibold text-[#6b645c] disabled:opacity-40"
            >
              Deshacer
            </button>
            <button
              type="button"
              disabled={!dirty || pending}
              onClick={save}
              className="h-10 rounded-xl bg-[#1a1714] px-5 text-[13px] font-semibold text-white transition hover:bg-black disabled:opacity-40"
            >
              {pending ? "Guardando…" : "Guardar y publicar"}
            </button>
          </div>
        </div>

        <div className="lg:sticky lg:top-4 lg:self-start">
          <p className="mb-2 text-[12px] font-semibold text-[#6b645c]">Vista previa</p>
          <LandingPreview form={form} images={images} link={link} />
        </div>
      </section>
    </div>
  );
}

const inputCls =
  "h-10 w-full rounded-xl border border-[#e3dbd1] bg-[#fffdfb] px-3 text-[14px] text-[#1a1714] outline-none transition placeholder:text-[#b5ada5] focus:border-[#c9a78a] focus:ring-2 focus:ring-[#f3e3d3]";

function Stat({ label, value, hint, accent }: { label: string; value: string; hint: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${accent ? "border-[#f3dcc6] bg-[#fff8f1]" : "border-[#ece4da] bg-white"}`}>
      <p className="text-[12px] font-medium text-[#6b645c]">{label}</p>
      <p className="mt-1 text-[22px] font-semibold tabular-nums tracking-[-0.02em] text-[#1a1714]">{value}</p>
      <p className="mt-0.5 text-[12px] text-[#9b928a]">{hint}</p>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-3 border-t border-[#f1ebe4] pt-4 first-of-type:border-0 first-of-type:pt-0">
      <legend className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9a6b4a]">{title}</legend>
      {children}
    </fieldset>
  );
}

function Field({ label, counter, children }: { label: string; counter?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex justify-between text-[12.5px] font-medium text-[#3a332d]">
        {label}
        {counter ? <span className="font-normal tabular-nums text-[#b5ada5]">{counter}</span> : null}
      </span>
      {children}
    </label>
  );
}

function ImageField(props: {
  label: string;
  hint: string;
  url: string | null;
  round?: boolean;
  small?: boolean;
  busy: boolean;
  onPick: (file: File) => void;
  onRemove: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="flex items-center gap-3">
      <div
        className={`flex shrink-0 items-center justify-center overflow-hidden border border-[#efe7de] bg-[#fcfbf9] ${
          props.small ? "h-10 w-10" : "h-14 w-14"
        } ${props.round ? "rounded-full" : "rounded-xl"}`}
      >
        {props.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={props.url} alt="" className={`h-full w-full ${props.round ? "object-cover" : "object-contain p-1.5"}`} />
        ) : (
          <span className="text-[11px] text-[#b5ada5]">Sin imagen</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-medium text-[#3a332d]">{props.label}</p>
        <p className="text-[12px] text-[#9b928a]">{props.hint}</p>
        <div className="mt-1.5 flex gap-2">
          <button
            type="button"
            disabled={props.busy}
            onClick={() => input.current?.click()}
            className="h-8 rounded-lg border border-[#e3dbd1] px-3 text-[12px] font-semibold text-[#3a332d] transition hover:bg-[#f7f5f2] disabled:opacity-50"
          >
            {props.busy ? "Subiendo…" : props.url ? "Cambiar" : "Subir"}
          </button>
          {props.url && !props.busy ? (
            <button type="button" onClick={props.onRemove} className="h-8 px-2 text-[12px] font-semibold text-[#a32e23]">
              Quitar
            </button>
          ) : null}
        </div>
        <input
          ref={input}
          type="file"
          accept={props.small ? "image/png,image/x-icon,image/vnd.microsoft.icon,.ico" : "image/png,image/jpeg,image/webp"}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) props.onPick(f);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}

/** Muestra del color + su código, como en el panel de Ecomdy. */
function ColorField(props: { label: string; hint: string; value: string; onChange: (hex: string) => void }) {
  const valid = PARTNER_ACCENT_RE.test(props.value);
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[12.5px] font-medium text-[#3a332d]">{props.label}</span>
      <div className="flex items-center gap-2">
        <label
          className="relative h-10 w-12 shrink-0 cursor-pointer overflow-hidden rounded-xl border border-[#e3dbd1]"
          style={{ background: valid ? props.value : "#ffffff" }}
          title="Elegir color"
        >
          <input
            type="color"
            value={valid ? props.value.toLowerCase() : "#ffffff"}
            onChange={(e) => props.onChange(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </label>
        <input
          value={props.value.toUpperCase()}
          maxLength={7}
          spellCheck={false}
          aria-label={`${props.label} (código)`}
          onChange={(e) => {
            const raw = e.target.value.replace(/[^#0-9a-fA-F]/g, "").replace(/(?!^)#/g, "");
            props.onChange(raw.startsWith("#") ? raw : `#${raw}`);
          }}
          className={`${inputCls} font-mono uppercase ${valid ? "" : "border-[#f0b4ab] focus:border-[#e0786a] focus:ring-[#fde2dd]"}`}
        />
      </div>
      <span className="text-[11.5px] text-[#9b928a]">{valid ? props.hint : "Usa un código de 6 dígitos, ej. #FF5A2A."}</span>
    </div>
  );
}

/** Banner ancho con su medida recomendada (como «Tablet / Laptop Banner» de Ecomdy). */
function BannerField(props: {
  label: string;
  size: string;
  url: string | null;
  busy: boolean;
  onPick: (file: File) => void;
  onRemove: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col gap-1.5">
      <span className="flex justify-between text-[12.5px] font-medium text-[#3a332d]">
        {props.label}
        <span className="font-normal text-[#b5ada5]">{props.size} px</span>
      </span>
      <button
        type="button"
        disabled={props.busy}
        onClick={() => input.current?.click()}
        className="flex aspect-[1224/270] w-full items-center justify-center overflow-hidden rounded-xl border border-dashed border-[#dcd2c6] bg-[#fcfbf9] px-3 text-center text-[12px] font-semibold text-[#9b928a] transition hover:bg-[#f7f5f2] disabled:opacity-60"
      >
        {props.busy ? (
          "Subiendo…"
        ) : props.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={props.url} alt="" className="h-full w-full object-cover" />
        ) : (
          "Subir banner · PNG, JPG o WEBP, máx. 4 MB"
        )}
      </button>
      {props.url && !props.busy ? (
        <div className="flex gap-3">
          <button type="button" onClick={() => input.current?.click()} className="text-[12px] font-semibold text-[#3a332d]">
            Cambiar
          </button>
          <button type="button" onClick={props.onRemove} className="text-[12px] font-semibold text-[#a32e23]">
            Quitar
          </button>
        </div>
      ) : null}
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) props.onPick(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

/** Mini versión de /a/<link> con los cambios en vivo. */
function LandingPreview({
  form,
  images,
  link,
}: {
  form: MyPartnerInput;
  images: Record<MyPartnerImageKind, string | null>;
  link: string;
}) {
  const pal = partnerPalette(form);
  const person = form.name.trim() || "Tu nombre";
  const name = form.companyName.trim() || person;
  // La vista previa va a ~60 % del tamaño real.
  const logoH = Math.round(partnerLogoSize(form.logoSize) * 0.6);
  const banner = images.banner ?? images.banner_mobile;
  const sameTone = pal.secondary.toLowerCase() === pal.accent.toLowerCase();
  return (
    <div className="overflow-hidden rounded-2xl border border-[#e3dbd1] shadow-[0_24px_50px_-32px_rgb(60_35_15/0.45)]">
      <div className="flex items-center gap-1.5 border-b border-[#ece4da] bg-[#f4efe9] px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-[#e4dad0]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#e4dad0]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#e4dad0]" />
        <span className="ml-2 inline-flex min-w-0 items-center gap-1.5 truncate rounded-md bg-white px-2 py-0.5 text-[11px] text-[#8a8177]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {images.favicon ? <img src={images.favicon} alt="" className="h-3.5 w-3.5 shrink-0 object-contain" /> : null}
          {link.replace("https://", "")}
        </span>
      </div>
      <div style={{ background: pal.background, color: pal.text }}>
        <div className="flex items-center justify-center gap-2.5 px-5 py-4">
          <Image
            src="/brand/holistic-marketing-logo.png"
            alt="Holistic Marketing"
            width={506}
            height={187}
            className={`w-auto ${pal.dark ? "brightness-0 invert" : ""}`}
            style={{ height: Math.round(logoH * 0.9) }}
          />
          <span style={{ color: pal.faint }}>×</span>
          {images.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={images.logo} alt={name} className="w-auto max-w-[160px] object-contain" style={{ height: logoH }} />
          ) : (
            <span className="truncate text-[13px] font-bold">{name}</span>
          )}
        </div>
        <div className="px-5 pb-6 pt-2">
          <span
            className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10.5px] font-semibold"
            style={{ borderColor: pal.border, background: pal.card, color: pal.muted }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: pal.secondary }} />
            Alianza oficial · {name}
          </span>
          <p className="mt-3 text-[24px] font-bold leading-[1.1] tracking-[-0.035em]">{form.headline.trim() || DEFAULT_HEADLINE}</p>
          <p className="mt-2 text-[13px] leading-relaxed" style={{ color: pal.muted }}>
            {form.subheadline.trim() || DEFAULT_SUB}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="inline-flex h-9 items-center rounded-lg px-4 text-[12.5px] font-bold" style={{ background: pal.accent, color: pal.accentInk }}>
              Crear mi cuenta gratis →
            </span>
            <span className="inline-flex h-9 items-center rounded-lg border px-4 text-[12.5px] font-semibold" style={{ borderColor: pal.border }}>
              Hablar por WhatsApp
            </span>
          </div>
          {images.photo || form.name.trim() ? (
            <div className="mt-5 flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {images.photo ? <img src={images.photo} alt="" className="h-8 w-8 rounded-full object-cover" /> : null}
              <p className="text-[12px]" style={{ color: pal.muted }}>
                Recomendado por <strong style={{ color: pal.text }}>{person}</strong>
                {form.companyName.trim() ? ` · ${form.companyName.trim()}` : ""}
              </p>
            </div>
          ) : null}
        </div>
        {banner ? (
          <div className="px-5 pb-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={banner} alt="" className="block h-auto w-full rounded-xl border" style={{ borderColor: pal.border }} />
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-2 border-t px-5 py-4" style={{ borderColor: pal.border, background: pal.band }}>
          {["Cuentas de agencia", "Recarga como prefieras"].map((t) => (
            <div key={t} className="rounded-xl border p-3" style={{ borderColor: pal.border, background: pal.card }}>
              <span className="block h-1 w-6 rounded-full" style={{ background: pal.secondary }} />
              <p className="mt-2 text-[11.5px] font-bold">{t}</p>
            </div>
          ))}
        </div>
        <div className="px-5 pb-5 pt-1">
          <div className="flex items-center justify-between gap-3 rounded-xl px-4 py-3" style={{ background: pal.secondary, color: pal.secondaryInk }}>
            <p className="text-[12.5px] font-bold">¿Listo para anunciar?</p>
            <span
              className="rounded-lg px-3 py-1.5 text-[11px] font-bold"
              style={sameTone ? { background: pal.secondaryInk, color: pal.secondary } : { background: pal.accent, color: pal.accentInk }}
            >
              Crear mi cuenta →
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
