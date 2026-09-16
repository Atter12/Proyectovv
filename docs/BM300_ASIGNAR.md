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

## 4. Mapa Hecom (resuelto 2026-09-15)

Sin fila Hecom:

1. Sync approved no mete la cuenta en la org del cliente.
2. Pagos → Asignar no la muestra (scope Hecom).
3. El cash del BM queda sin “dueño” en producto.

### Estado

```text
TikTok BM300 → 27 advertisers
Hecom cliente_tiktok_cuentas WHERE bm_bucket = '300' → 23 filas
```

| Cliente Hecom | Cuentas | Nota |
|---------------|---------|------|
| Jonatan Matildo José | 17 | TikTok escribe “Jhonatan” · 2 suspendidas |
| Ely Aguirre | 2 | |
| Piero Alexander Acasiete García | 2 | ficha unificada · ver abajo |
| Carla Juan de dios | 1 | |
| Yolmer Eugenio | 1 | |

Ignoradas (internas / smoke): `sebas prueba 303/304`, `Sebas LIBRE 300.O USD`,
`PROALBA GROUP E.I.R.L.`

### Unificación Piero Acasiete (2026-09-15)

Dos fichas OTP del mismo DNI/teléfono creadas con 3 min de diferencia. Se consolidó
en `0bd95ba9…` (`Piero Alexander Acasiete García`):

- 2 cuentas BM300 mapeadas ahí.
- Cobro `C-U3FL55ERFP` (S/ 55) movido desde la ficha duplicada.
- Ambos correos (`alexander.garciacasiete@`, `aacasiete17.2002@`) quedan en la ficha
  superviviente — el login busca por el array `emails`, así que migrarlos es obligatorio.
- Duplicada `0b45827e…` renombrada `[DUP] …`, `emails = []` y sin `hecom_cliente_user_links`,
  para que no aparezca en el picker de login. No se borró: conserva historial.

### Herramienta

```bash
node --env-file=.env.local scripts/map-bm300-advertisers.mjs          # audit
node --env-file=.env.local scripts/map-bm300-advertisers.mjs --apply  # inserta match único
```

Inserta `bm_bucket='300'`, `sync_enabled=true` y `fee=null`.
**`fee` es el % de comisión Hecom (5–10), no el tier del BM**: dejarlo en null hace
que `resolveFeePercentFromHecomCliente` caiga al fee del cliente (default 10%).

Escribir el tier en `fee` era un bug real: `linkTikTokCuentaToHecomCliente` usaba
`Number(bmBucket)`, así que una cuenta creada en BM300 quedaba con **300 % de comisión**
(`normalizeFeePercent` no tiene tope). Corregido en código + limpieza de 27 filas
históricas con `fee=30` en `bm_bucket=30` (afectaban a Jose Murillo, Marko Villaizan y
Renzo Solis, que no tienen `tiktok_default_fee` propio).

Luego en Holistic: sync approved + ensure org → aparece en Asignar (cache 5 min).

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

### Smoke Asignar (2026-09-15) — OK

Sobre cuenta interna `Sebas LIBRE 300.O USD` (`7680959274004234261`):

| Paso | Resultado |
|------|-----------|
| Resolver portfolio por advertiser | `Portfolio 4540` ✓ (no el del BM200 colgado en el mismo BC) |
| RECHARGE $1 | `40002 amountToTransfer is less than transferableAmount` — **mínimo TikTok** |
| RECHARGE $10 | `code 0` · advertiser 0 → 10 · BM cash 49753 → 49743 |
| REFUND $10 | `code 0` · advertiser → 0 · BM cash → 49753 |

El mínimo por operación ya tiene mensaje propio en `formatTransferError`
(“Prueba con $10 o más”), así que no requiere cambio.

Env producción verificado: `TIKTOK_ACCESS_TOKEN` (igual al local) y
`TIKTOK_BC_FUNDING_ENABLED=true`. Sin ese flag, Asignar acredita el ledger Holistic
pero no manda cash a TikTok.

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

### Naming (convención ops)

El serial arranca en el tier del BM y sube 1 por cada cuenta que el cliente ya
tiene **en ese BM**:

```text
Abel Quispe 300.0 USD - Agencia   ← 1ra
Abel Quispe 301.0 USD - Agencia   ← 2da
Abel Quispe 302.0 USD - Agencia   ← 3ra
```

Verificado contra el BM: Jonatan Matildo tiene 300→316, el próximo sale 317.0.
En BM200 arranca en `200.0` y en BM30 en `30.0`.

El conteo es **por bm_bucket** (`countHecomTikTokAccountsForCliente(id, bucket)`).
Contar todas las cuentas del cliente saltaría seriales cuando tiene cuentas en
varios BM. El cap self-serve de 2, en cambio, sí cuenta todas.

### Smoke create (2026-09-12) — bloqueado

| Prueba | Resultado |
|--------|-----------|
| Payload + industry inválida | `40002 Industry invalid` → path/permisos **OK** |
| Create real | `40002 Unable to create… unusual activity in this Business Center` |

**Bloqueo TikTok en el BC** (compliance / risk), no Holistic.

### Recheck (2026-09-15) — DESBLOQUEADO

TikTok levantó la revisión de riesgo sin que hiciéramos gestión con el AM.

| Prueba | Resultado |
|--------|-----------|
| Probe industry inválida en BM 300 / 200 / 30 | los tres `Industry invalid` → create disponible |
| Create real BM300 (industry 291406) | `code 0` · advertiser `7685958996607909908` |

Ojo con el método: el probe de industry inválida **no** distingue el bloqueo de riesgo
(el 12/09 también devolvía `Industry invalid` mientras el create real fallaba). Para
saber si el BC está abierto hay que intentar un create real.

La cuenta `7685958996607909908` (`Holistic Probe 300.0 USD - Agencia`) quedó como
inventario interno sin mapear en Hecom. El regex `NOT_A_CLIENT` del script de mapeo la
ignora por contener “holistic”, así que no se va a auto-asignar a nadie.

Con esto se reactivó `TIKTOK_SELF_SERVE_CREATE_MAINTENANCE = false`.

---

## 8. Checklist “BM 300 listo para dar saldo”

- [x] OAuth → token nuevo
- [x] Token en `.env.local`
- [x] Token en **Vercel Production** + `TIKTOK_BC_FUNDING_ENABLED=true`
- [x] Mapa `"300"` en código + cash path + portfolio por advertiser
- [x] Mapear advertisers en **Hecom** (`bm_bucket=300`) — 23/27 · ver §4
- [x] Unificar fichas duplicadas de Piero Acasiete y mapear sus 2 cuentas
- [x] Sync → aparecen en Pagos (verificado en prod con Piero: 2 cuentas visibles)
- [x] Smoke Asignar en cuenta APPROVED — ver §5 (mínimo $10, no $1)
- [ ] Confirmar cash en Ads Manager en el primer Asignar real de cliente

**BM 300 operativo para Asignar y para crear cuentas.** El bloqueo de altas del
12/09 se levantó (ver §7 · recheck 2026-09-15) y el self-serve quedó reactivado.

---

## 9. “Liberar cuenta” — protocolo ops (2026-09-15)

Cuando Victor dice **“libera esa cuenta”**, significa dejarla disponible para que
otro cliente la use. Solo ops, nunca el cliente.

**Hacer:**

1. Borrar la fila de `cliente_tiktok_cuentas` (Hecom) del cliente actual.
2. Borrar / archivar la fila de `ad_accounts` de la org de ese cliente.
3. Dejar el advertiser **intacto y `STATUS_ENABLE`** en TikTok.

Guardas antes de tocar: saldo y gasto en `0`, y que no sea el
`tiktok_advertiser_id` principal de la ficha.

**NO hacer:** `POST /bc/advertiser/disable/`. Eso **mata la cuenta para siempre**
— no existe `/bc/advertiser/enable/` (404), `/advertiser/update/` con status es
no-op, y re-disable responde `has been DISABLED already`. Disable es solo para
retirar una cuenta de circulación de forma definitiva, nunca para liberar.

### Límites conocidos

| Cosa | Estado |
|------|--------|
| Borrar un advertiser | ❌ No existe endpoint |
| Sacarlo del BM (`/bc/asset/admin/delete/`) | ❌ `40000 This action isn't supported` (el BM es `OWNER_BC`) |
| Renombrar por API | ✅ `POST /advertiser/update/` con `{advertiser_id, name}` — **solo si está `STATUS_ENABLE`** |
| Reasignar a otro cliente | ✅ Remapear en Hecom (+ renombrar al serial del nuevo dueño) |

**El rename es asíncrono y best-effort.** Devuelve `code: 0` al instante pero tarda
en propagarse; `/advertiser/info/` y `/bc/asset/admin/get/` siguen devolviendo el
nombre viejo. No concluir “no funcionó” por leerlo de inmediato. En cuentas
`STATUS_DISABLE` se acepta pero no se aplica nunca.

Ojo: de dos renames pedidos el 15/09 sobre la misma cuenta, el primero se aplicó y el
segundo seguía sin reflejarse 20 min después, ambos con `code: 0`. **Siempre verificar
el nombre después, no confiar en la respuesta.**

Importa porque `resolveDisplayName` (`lib/hecom/ad-accounts.server.ts`) prioriza el
nombre vivo de TikTok sobre el de Hecom: al reciclar hay que renombrar en TikTok, no
solo en Hecom, o el cliente verá el nombre de stock.

### Inventario real (2026-09-15)

| BM | total | asignadas | stock libre | cliente sin mapear | muertas/baneadas |
|----|-------|-----------|-------------|--------------------|------------------|
| BM300 | 31 | 23 | **6** | 1 | 1 |
| BM200 | 283 | 197 | **1** | 53 | 32 |
| BM30 | 304 | 149 | 0 | 88 | 67 |
| BM10 | 330 | 93 | **117** | 92 | 28 |
| **TOTAL** | 948 | 462 | **124** | 234 | 128 |

**Listas para dar: 124.** Los BM SHARED (10/30) también fondean — con línea de
crédito, no cash.

### Leer bien el balance de un BM (error cometido el 15/09)

`/bc/balance/get/` **sin `payment_portfolio_id`** devuelve ceros engañosos en BM
multi-PA. Y en BM SHARED el crédito **no está en `cash_balance` ni en
`grant_balance`, sino en `account_balance`**. Resolver el portfolio con
`/payment_portfolio/get/` antes de consultar.

| BM | portfolio | tipo | cash | grant | **account (crédito)** |
|----|-----------|------|------|-------|------------------------|
| BM300 | Portfolio 4540 | NON_SHARED | $49,753 | $0 | $49,753 |
| BM200 | BM Entreprise 200.0 | NON_SHARED | $21,073 | $5,136 | $26,210 |
| BM30 | BM Entreprise 30.0 | SHARED | $0 | $16,186 | **$80,046** |
| BM10 | PANAMERICANA OUTSOURCING | SHARED | $0 | $0 | **$42,868** |

Evidencia de que BM10 fondea de verdad: 227 de sus 312 cuentas tienen presupuesto
asignado, 75 con gasto real, **$43,810 asignados y $18,642 ya gastados**. La ruta es
`increaseSharedBmAdvertiserBudget` (`/advertiser/update/`), que consume la línea de
crédito — el cash es irrelevante ahí.

Límite real de BM10: el presupuesto asignado ($43,810) ya roza la línea disponible
($42,868), y el crédito es **compartido entre todas las cuentas**. Eso es lo que
estaba detrás del `bm10_no_spendable_balance` de Dominic: no que el BM no sirva, sino
que la línea estaba comprometida.

Stock BM300: `prueba 300`, `prueba 301`, `sebas prueba 303`, `sebas prueba 304`,
`Sebas LIBRE 300.O USD`, `Holistic Probe 300.0 USD - Agencia RENAME OK`.

Las **234 “cliente sin mapear”** son cuentas con nombre de cliente que no están en
`cliente_tiktok_cuentas` — no son stock, son backlog de mapeo (mismo caso que §4 con
BM300). Esos clientes probablemente no ven sus cuentas en la plataforma.

1 inservible: `Adriano Perez 300.0 USD - Agencia` (`7685982426154860565`) quedó en
`STATUS_DISABLE` por el test del 15/09. No reciclable.
