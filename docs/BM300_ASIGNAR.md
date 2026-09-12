# BM 300 — Asignar saldo (prioridad)

**Estado:** token + mapa listos en código · **Hecom map pendiente** (0 filas `bm_bucket=300`)  
**Fecha:** 2026-09-12  
**Prioridad producto:** fondear / Asignar en BM 300 (más cuentas por dar) antes que create self-serve.

---

## 0. Resumen ejecutivo

| Pregunta | Respuesta |
|----------|-----------|
| ¿Tenemos acceso? | **Sí.** Token nuevo = `ADMIN` + `finance_role: MANAGER` en BM 300. |
| BC ID | `7680955666005196801` |
| Nombre TikTok | `Bm Enterprise 300.0 USD` |
| Tipo | **AGENCY** · `NON_SHARED` · **cash** (mismo path que BM 200) |
| Cash BM (live) | ~**$49 901 USD** (`valid_cash_balance`) |
| Advertisers en BC | **27** (API) |
| Hecom `bm_bucket=300` | **0** filas → Asignar en Holistic no lista nada hasta mapear |
| Fondeo Asignar | `POST /bc/transfer/` cash (no shared budget) |
| Portfolio correcto | `7680888215183688465` · **Portfolio 4540** (27 ads). No usar el portfolio “BM 200” colgado en el mismo BC. |

---

## 1. Inventario live (2026-09-12)

Fuente: `GET /bc/get/` + `/bc/balance/get/` + `/payment_portfolio/get/` + `/advertiser/balance/get/` con el token regenerado.

| Campo | Valor |
|-------|--------|
| `bc_id` | `7680955666005196801` |
| Compañía BC | PROALBA GROUP E.I.R.L. |
| Área | PE · `America/Lima` |
| Verificación BC | VERIFIED |
| Org type | STANDARD |
| User role | ADMIN |
| Finance | MANAGER |
| Portfolio type | NON_SHARED |
| Cash | ~49901 USD |
| Qual VERIFIED usable | `DISTRIBUCIONES EL CENTRO S.A.C.` · `qualification_id` `7683165994143449109` (25 ads) |

### Portfolios en el BC (ojo multi-PA)

| Portfolio ID (string) | Nombre | Ads linked |
|-----------------------|--------|------------|
| `7654590612498563857` | Portfolio for BM Entreprise 200.0 USD | 272 |
| `7680888215183688465` | **Portfolio 4540** | **27** ← cuentas BM 300 |

Holistic resuelve portfolio **por advertiser** (nombre / probe) para no mandar transfer al PA equivocado.

### Muestra de advertisers (TikTok)

Patrón de nombre: `{Cliente} 300.0…` / `301.0` / `316.0` · status APPROVED · cash 0 hasta Asignar · budget mode a menudo `UNLIMITED` hasta cap post-cash.

Ejemplos: Yolmer Eugenio, Carla Juan, Piero Acasiete, Jhonatan Matildo, …

---

## 2. Token (ops)

### Qué se hizo

1. OAuth `auth_code` desde callback Hecom →  
   `POST /oauth2/access_token/` con `TIKTOK_APP_ID` + `TIKTOK_CLIENT_SECRET`.
2. `access_token` escrito en **`.env.local`** (`TIKTOK_ACCESS_TOKEN`).
3. **Vos** pegás el mismo valor en **Vercel → proyectovv → Production** → Redeploy.

### Valor a poner en Vercel

Copiá de tu `.env.local` la línea:

```bash
TIKTOK_ACCESS_TOKEN=…
```

(No commitear el token. Si rotás de nuevo, repetí el exchange del `auth_code`.)

### Checklist Vercel

- [ ] `TIKTOK_ACCESS_TOKEN` = token nuevo (Production + Preview si aplica)
- [ ] Redeploy `proyectovv` / Ads Holistic
- [ ] Smoke: Asignar $1 a una cuenta BM 300 mapeada → cash sube en Ads Manager

**No hace falta** `TIKTOK_DEFAULT_BC_ID=300` si `external_business_id` / Hecom `bm_bucket` resuelven bien.

---

## 3. Código Holistic

| Pieza | Cambio |
|-------|--------|
| `lib/hecom/bm-bucket.shared.ts` | `"300" → 7680955666005196801` · allocatable · `isCashTransferBmBucket` |
| `lib/integrations/tiktok/bc-finance.server.ts` | Resolve `payment_portfolio_id` **por advertiser** (multi-PA BM300) |
| `lib/payments/allocate-with-tiktok.server.ts` | Path cash automático (no shared) si bucket `300` |
| `lib/payments/resolve-funding-bc.server.ts` | Probe ya itera `HECOM_BM_BUCKET_TO_BC` (incluye 300) |

BM 300 **no** usa `increaseSharedBmAdvertiserBudget`. Usa el mismo flujo cash que BM 200.

---

## 4. Gap crítico: mapa Hecom

Hoy:

```text
TikTok BM300 → 27 advertisers
Hecom cliente_tiktok_cuentas WHERE bm_bucket = '300' → 0 filas
```

Sin fila Hecom:

1. Sync approved no mete la cuenta en la org del cliente.
2. Pagos → Asignar no la muestra (scope Hecom).
3. El cash del BM queda sin “dueño” en producto.

### Acción ops (antes de decir “listo clientes”)

Para cada advertiser BM 300 a operar:

```text
INSERT / upsert Hecom.cliente_tiktok_cuentas
  client_id, advertiser_id, advertiser_name,
  bm_bucket = '300', fee ≈ 300, sync_enabled = true
```

Luego en Holistic: sync approved + ensure org → aparece en Asignar.

---

## 5. Flujo Asignar (BM 300)

```text
Cliente / staff elige cuenta BM 300
  → resolve BC 7680955666005196801 (Hecom bucket o external_business_id)
  → payment_portfolio_id = Portfolio 4540 (por advertiser)
  → POST /bc/transfer/ cash_amount (RECHARGE)
  → ledger Holistic debita cartera / acredita ad_account
  → (opcional) enforce cash verify como BM200
```

Seguridad: el cliente **nunca** es Admin del BM. Solo el token agencia. Ver `ESTUDIO_CREAR_CUENTAS_CLIENTE_BM10_30_200.md` §5A.

---

## 6. Create cuentas en BM 300 (después de Asignar)

No es el foco de esta pasada. Cuando toque:

- Path Agency + `qualification_info` (qual VERIFIED: DISTRIBUCIONES EL CENTRO…).
- Naming: `{Cliente} 300.0 USD - Agencia`.
- Post-create: map Hecom `bm_bucket=300` + Asignar cash.

Detalle create multi-BM: `ARQUITECTURA_CREAR_CUENTAS_TIKTOK.md` + estudio 10/30/200.

---

## 7. Otros BC vistos con el mismo token

| Nombre | BC ID | Nota |
|--------|-------|------|
| BM 10.0 USD Nuevo | `7652451146933698576` | Ya en mapa |
| BM Entreprise 30.0 USD | `7564426417577148433` | Ya en mapa |
| BM Entreprise 200.0 USD | `7575005779271614480` | Ya en mapa |
| **Bm Enterprise 300.0 USD** | `7680955666005196801` | **Este doc** |
| BM 20.0 | `7672466837071347728` | DIRECT · fuera de alcance ahora |
| Holistic software | `7602368708324900872` | SELF_SERVICE PEN · no ops ads |

---

## 9. Crear cuentas (Cuentas ads) — BM 300 primero

**Producto (2026-09-12):**

- UI: **Cuentas ads** → “Crear cuenta TikTok” (no el modal demo Holistic).
- Default BM: **300**.
- Cap self-serve: **2** cuentas / cliente Hecom.
- Más de 2 → CTA **WhatsApp** `wa.me/51933484150`.
- Flujo: `POST /bc/advertiser/create/` → `cliente_tiktok_cuentas` → sync org → aparece en Asignar.

Código:

| Pieza | Path |
|-------|------|
| Perfiles | `lib/integrations/tiktok/bc-create-profiles.ts` |
| Create API TikTok | `lib/integrations/tiktok/bc-advertiser-create.server.ts` |
| Link Hecom | `lib/hecom/link-tiktok-cuenta.server.ts` |
| Orquestación | `lib/hecom/create-tiktok-account-for-cliente.server.ts` |
| Route | `POST /api/ad-accounts/tiktok/create` |
| Modal | `features/ad-accounts/components/CreateTikTokAccountModal.client.tsx` |

Qual create BM300: `DISTRIBUCIONES EL CENTRO S.A.C.` · `7683165994143449109` · industry `291406`.

### Smoke create (2026-09-12)

| Prueba | Resultado |
|--------|-----------|
| Payload + industry inválida | `40002 Industry invalid` → path/permisos **OK** |
| Create real | `40002 Unable to create… unusual activity in this Business Center` |

**Bloqueo TikTok en el BC** (compliance / risk), no Holistic. Pedir a AM TikTok desbloqueo de altas en BM 300. La UI/API ya está lista; cuando TikTok abra, create funciona sin redeploy de lógica.

---

## 8. Checklist “BM 300 listo para dar saldo”

- [x] OAuth → token nuevo
- [x] Token en `.env.local`
- [ ] Token en **Vercel Production** + redeploy ← **vos**
- [x] Mapa `"300"` en código + cash path + portfolio por advertiser
- [ ] Mapear advertisers en **Hecom** (`bm_bucket=300`)
- [ ] Sync → aparecen en Pagos
- [ ] Smoke Asignar $1–5 en una cuenta APPROVED
- [ ] Confirmar cash en Ads Manager

Cuando Vercel tenga el token y Hecom tenga al menos 1 cuenta mapeada: **sí, listo para Asignar en BM 300**.
