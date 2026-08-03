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

**Importante:** el token tiene que ser de un usuario con rol Finance/Admin del mismo BC que `TIKTOK_DEFAULT_BC_ID`. El permiso de app ya está OK (`/bc/transfer/`).

---

## Smoke test

1. `TIKTOK_BC_FUNDING_ENABLED=true` + token + `TIKTOK_DEFAULT_BC_ID`
2. Cuenta con `external_account_id` real
3. BC con saldo > monto de prueba
4. Recarga Stripe chica → Asignar $1–5 a esa cuenta
5. Verificar en TikTok Ads Manager que subió el saldo del advertiser
6. Logs Vercel: `[tiktok-bc] transfer_ok`
