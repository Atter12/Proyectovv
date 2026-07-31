# Design tokens — Landing → Sistema (fuente de verdad)

Landing y login usan `.auth-canvas` + `AuthDotGridBackground` + **Plus Jakarta Sans**.

## Tipografía

| Token | Valor |
|---|---|
| Familia | **Plus Jakarta Sans** (`--font-jakarta`) |
| CSS global | `--font-sans` y `--font-display` = Jakarta |
| Pesos | 400 / 500 / 600 / 700 / 800 |
| Títulos | `font-bold` + `tracking-[-0.03em]` + `leading-[1.15]` |
| Eyebrow | `text-[var(--auth-accent)]` + `font-bold` + `tracking-[-0.02em]` |
| Body | `text-[15px]` + `font-medium` + `text-[var(--auth-text-muted)]` |

## Color

| Token | Hex / valor |
|---|---|
| `--auth-accent` | `#ff781f` |
| `--auth-accent-hover` | `#e8451a` |
| `--auth-accent-soft` | `#fff1e8` |
| `--auth-text` | `#0f172a` |
| `--auth-text-muted` | `#475569` |
| `--auth-text-soft` | `#94a3b8` |
| `--auth-bg` / canvas | `#f4f6f8` |
| `--auth-surface` | `#ffffff` |
| Gradiente fondo | `#f8fafc` → `#f4f6f8` → `#eef1f4` + glow naranja suave |
| Dot grid | `#c5cdd8` base, `#ff781f` activo |

## Superficie

- Cards: blanco, `border rgb(15 23 42 / 0.06)`, `rounded-[1.25rem]`
- Shadow CTA: `0 8px–10px 20px–24px rgb(255 120 31 / 0.28)`
- Topbar: `bg-[rgb(248_250_252_/_0.92)] backdrop-blur-xl` (igual landing nav)

## Panel

`.dashboard-canvas` copia tokens `--auth-*`, tipografía Jakarta, fondo landing + **mismo DotGrid** que la home.
