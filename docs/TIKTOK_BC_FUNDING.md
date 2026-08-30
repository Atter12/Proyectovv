# Fondeo real TikTok BM (BC Transfer)

## Qué es `TIKTOK_DEFAULT_BC_ID`

Es el **ID del Business Center (BM) de la agencia** (Holistic / Hecom), **no** el App ID.

| Valor | Qué es | Ejemplo de tus capturas |
|---|---|---|
| App ID | App de desarrollador | `7648873933642399745` (Hecom Club Spend Sync) |
| **BC ID** | Business Center que tiene el cash y las cuentas ads | El número largo del BM en ads.tiktok.com (a veces watermark `7602368346924286994`) |
| Advertiser ID | Cada cuenta publicitaria del cliente | Va en `external_account_id` por cuenta |

**De quién es:** del BM de **ustedes (agencia)**, desde donde hoy recargan a mano las cuentas de clientes.  
Un cliente **no** pone su BC ahí (salvo que operen con BMs separados por cliente; ahí usamos `external_business_id` por cuenta).

### Cómo sacarlo en 30s
1. Entrá a [ads.tiktok.com](https://ads.tiktok.com) → Business Center  
2. Settings / Info del BM → **Business Center ID**  
3. O en la URL: a veces aparece `...bc_id=XXXXXXXX...`  
4. Pegalo en Vercel: `TIKTOK_DEFAULT_BC_ID=ese_número`

---

## Modelo de plata (importante)

```
Cliente paga Stripe → dinero a cuenta Holistic (banco)
                              ↓
               BC de TikTok ya debe tener cash
                              ↓
         Asignar → POST /bc/transfer/ RECHARGE
                              ↓
              cash BC → advertiser (cuenta ads)
                              ↓
                    ledger Holistic (contabilidad)
```

Stripe **no** deposita solo en TikTok. Holistic opera con saldo en el Business Center; al asignar, la API mueve ese cash al advertiser del cliente.

### BM SHARED (10 / 30) vs BM 200

| Campo API | BM 10 / 30 (SHARED) | BM 200 (NON_SHARED) |
|---|---|---|
| `payment_portfolio_type` | SHARED | NON_SHARED |
| `cash_balance` | **$0** (hoy) | ~$43k |
| `account_balance` | Línea de crédito (~106k BM30) | Igual al cash |
| ¿Asignar vía API? | **Sí → subir presupuesto** | **Sí → cash transfer** |

#### Cómo funciona cada uno

**BM 200:** `POST /bc/transfer/` con `cash_amount` (mueve efectivo BM → advertiser).

**BM 10 / 30 (crédito compartido):** no hay cash que mover. La cuenta **ya ve** la línea de crédito; lo que limita el gasto es el **presupuesto** de la cuenta (`CUSTOM_BUDGET` / diario / ilimitado).  
En Manager eso es “Editar presupuesto” / “Ajustar”. En API:

```http
POST /open_api/v1.3/advertiser/update/
{
  "bc_id": "<BM>",
  "budget_update_type": "INCREMENTAL_UPDATE",
  "advertiser_budgets": [{
    "advertiser_id": "<adv>",
    "budget": <monto_a_sumar>,
    "budget_mode": "CUSTOM_BUDGET"
  }]
}
```

Holistic ya enruta Asignar así: BM200 = cash, BM10/30 = presupuesto (`INCREMENTAL_UPDATE`).

`budget_update_type` válidos: `INCREMENTAL_UPDATE` | `UPDATE` | `ONE_CLICK_SET` | `RESET`.

**Permiso obligatorio (ops):** scope **Create Ad Account** (151) en la app → incluye `/advertiser/update/`.  
Tras aprobar, **regenerar** `TIKTOK_ACCESS_TOKEN` (el token viejo no hereda scopes nuevos).  
Smoke OK ago 2026: +$1 en Dominic BM30 → presupuesto 900→901.

`grant_amount` en `/bc/transfer/` = cupones/ad credit, **no** la línea de crédito mensual.

---

## Recuperar saldo (cuenta baneada / plata trabada)

Caso: cliente asignó $25 a BM 200 y la cuenta se suspendió → no debe quedar plata perdida.

```
Advertiser (cash sin gastar)  --DEDUCT-->  BC TikTok
                                              ↓
                         ledger Holistic: ad_account → wallet_available
```

| BM | Qué hace Holistic |
|----|-------------------|
| **200** | `POST /bc/transfer/` `transfer_type=DEDUCT` (cash advertiser → BC), luego `ledger_refund_from_ad_account_to_wallet` |
| **10 / 30** | Baja presupuesto (`UPDATE`) best-effort + refund ledger a cartera |

UI: **Pagos → misma tabla de Recargar/Asignar**.  
Si la cuenta se suspende **con saldo Holistic**, se queda en esa lista (badge Suspendida + botón **Recuperar a saldo disponible**).  
Al recuperar, el monto vuelve a **saldo disponible** y la cuenta **sale de Pagos**; la baneada solo se ve en **Cuentas ads**.  
Suspendidas en $0 no aparecen en Pagos.  
API: `POST /api/payments/reclaim` `{ adAccountId, amount?, forceLedgerOnly? }`.

- Solo se recupera lo **sin gastar** (capado por cash TikTok en BM200 y por saldo Holistic de la cuenta).
- `forceLedgerOnly` solo staff: si TikTok falla, igual mueve ledger (riesgo de desync con cash real).

---

## Qué falta activar (ops + env)

En Vercel Production:

```env
# Ya deberían existir (OAuth / app)
TIKTOK_APP_ID=…
TIKTOK_CLIENT_SECRET=…

# Token de agencia con permiso Finance / BC (si no usan OAuth por org)
TIKTOK_ACCESS_TOKEN=…

# BC desde el cual se recarga a advertisers
TIKTOK_DEFAULT_BC_ID=…          # o external_business_id por cuenta

# Flag para encender fondeo real
TIKTOK_BC_FUNDING_ENABLED=true
```

En el portal TikTok (app **Hecom Club Spend Sync** u otra):
- Permiso **Business Center / Finance** (BC Transfer) aprobado
- Usuario del token = Admin o Finance del BM
- El BM tiene **cash balance** suficiente

Por cuenta ads Holistic:
- `external_account_id` = advertiser TikTok
- `external_business_id` = bc_id (o usar `TIKTOK_DEFAULT_BC_ID`)

---

## Código

| Pieza | Archivo |
|---|---|
| API BC | `lib/integrations/tiktok/bc-finance.server.ts` |
| Orquestación | `lib/payments/allocate-with-tiktok.server.ts` |
| Endpoint | `POST /api/payments/allocations` |
| Flag | `TIKTOK_BC_FUNDING_ENABLED` |

Con flag **off** (default): solo ledger (como antes).  
Con flag **on**: transfer TikTok → si OK → ledger.

---

## Checklist Vercel (`proyectovv`)

| Variable | ¿Para qué? | Cómo chequear |
|---|---|---|
| `TIKTOK_APP_ID` | App “Hecom Club Spend Sync” | Ya suele estar |
| `TIKTOK_CLIENT_SECRET` | Secret de la misma app | Ya suele estar |
| `TIKTOK_ACCESS_TOKEN` | Token agencia para `/bc/transfer/` | **Obligatorio** si no hay OAuth org |
| `TIKTOK_DEFAULT_BC_ID` | BM de Holistic con el cash | Obligatorio (o `external_business_id` por cuenta) |
| `TIKTOK_BC_FUNDING_ENABLED` | Enciende fondeo real | Debe ser `true` |
| `TIKTOK_REDIRECT_URI` | Callback OAuth | `https://www.adsholistic.com/api/integrations/tiktok/callback` |
| `NEXT_PUBLIC_APP_URL` | URLs absolutas | `https://www.adsholistic.com` |

Orden de resolución del token en código:
1. OAuth guardado en la org (`integration_connections`)
2. Si no hay → `TIKTOK_ACCESS_TOKEN` de Vercel

---

## Si perdiste `TIKTOK_ACCESS_TOKEN` — dónde tomarlo

### Camino 1 (rápido): copiar de `hecom.club`
Ese proyecto ya lo tiene (mismo sync de gastos).
|
1. Vercel → proyecto **`hecom.club`** → Settings → Environment Variables  
2. Abrí `TIKTOK_ACCESS_TOKEN` → Reveal → copiar  
3. Pegalo en **`proyectovv`** → Production (+ Preview)  
4. También copiá `TIKTOK_DEFAULT_BC_ID` si falta  
5. Redeploy `proyectovv`

### Camino 2: OAuth desde el panel Holistic
1. En el portal TikTok de la app, Callback =  
   `https://www.adsholistic.com/api/integrations/tiktok/callback`
2. Entrá al panel con un admin → Cuentas / TikTok → **Conectar**  
   (`/api/integrations/tiktok/connect`)
3. Autorizá con un usuario **Admin o Finance** del BM
4. El token queda cifrado en DB de esa org (no hace falta env, pero el env de agencia sigue siendo útil para jobs)

### Camino 3: generar de nuevo en TikTok (si no está en ningún lado)
1. [TikTok Marketing API](https://business-api.tiktok.com/portal) → app **Hecom Club Spend Sync**  
2. **Auth** / Generate / Authorize (usuario Admin/Finance del BM)  
3. Te dan `auth_code` o un access token  
4. Si solo tenés `auth_code`, intercambialo con:  
   `POST https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/`  
   body: `{ "app_id", "secret", "auth_code" }`  
5. El `access_token` del response → Vercel `TIKTOK_ACCESS_TOKEN`  
6. Guardá también el `refresh_token` por si expira (ops)

**Importante:** el permiso de **app** (`/bc/transfer/`) ya está OK.  
Pero el **usuario del token** también necesita `finance_role` en el BM (Finance Manager / Analyst).  
Ser solo **Administrador** en Usuarios **no alcanza** para `/bc/transfer/` → error `40002` *finance permission*.

En BM → Usuarios → Editar miembro → asignar rol Finance (`ext_user_role.finance_role`), regenerar token, actualizar `TIKTOK_ACCESS_TOKEN`, redeploy.

---

## Smoke test

1. `TIKTOK_BC_FUNDING_ENABLED=true` + token + `TIKTOK_DEFAULT_BC_ID`
2. Cuenta con `external_account_id` real
3. BC con saldo > monto de prueba
4. Recarga Stripe chica → Asignar $1–5 a esa cuenta
5. Verificar en TikTok Ads Manager que subió el saldo del advertiser
6. Logs Vercel: `[tiktok-bc] transfer_ok`
