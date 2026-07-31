# Design tokens — Landing / Login → Sistema

Fuente de verdad: landing (`features/landing/*`) + auth (`.auth-canvas` en `globals.css`).

## Tipografía

| Rol | Familia | CSS |
|---|---|---|
| UI / body | **Plus Jakarta Sans** | `--font-jakarta` → `--font-sans` |
| Títulos | **Plus Jakarta Sans** (bold) | `--font-display` (= Jakarta en landing) |
| Legacy (admin viejo) | Manrope + Newsreader | `--font-manrope`, `--font-newsreader` |

Pesos usados: **400 / 500 / 600 / 700 / 800**.

Patrón de título landing:
```
text-[1.65rem]–[2.35rem] font-bold leading-[1.2] tracking-[-0.03em]
```

Eyebrow / accent label:
```
text-[1.05rem]–[1.45rem] font-bold tracking-[-0.02em] text-[var(--auth-accent)]
```

Body:
```
text-[15px]–[16px] font-medium leading-6|7 text-[var(--auth-text-muted)]
```

## Color (activo — light SaaS)

| Token | Valor | Uso |
|---|---|---|
| `--auth-accent` / `--brand-primary` | `#ff781f` | CTA, links, acentos |
| `--auth-accent-hover` / `--brand-primary-deep` | `#e8451a` | hover |
| `--brand-accent` | `#ffa12c` | highlight secundario |
| `--auth-text` | `#0f172a` | texto principal |
| `--auth-text-muted` | `#475569` | subtítulos |
| `--auth-text-soft` | `#94a3b8` | meta / hints |
| `--auth-bg` | `#f4f6f8` | canvas |
| `--auth-surface` | `#ffffff` | cards / paneles |
| `--auth-accent-soft` | `#fff1e8` | chips / soft fills |
| Divider | `rgb(15 23 42 / 0.08)` | bordes suaves |

## Radios & sombra

- Controles / botones: `rounded-xl` (12px)
- Paneles: `rounded-[1.25rem]`–`1.5rem`
- CTA shadow: `0 8px 20px rgb(255 120 31 / 0.28)`
- Card: `0 1px 2px + 0 12px 32px` slate suave

## Fondo canvas

```css
background-color: #f4f6f8;
background-image:
  radial-gradient(... naranja 7% ...),
  radial-gradient(... amber 5% ...),
  linear-gradient(180deg, #f8fafc, #f4f6f8, #eef1f4);
```

## Aplicación en el panel

`.dashboard-canvas` hereda tipografía Jakarta + fondo/colores alineados a `.auth-canvas`.
Sidebar oscuro (`.dashboard-rail`) se mantiene como contraste de producto.
