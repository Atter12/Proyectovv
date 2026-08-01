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

## Smoke test

1. `TIKTOK_BC_FUNDING_ENABLED=true` + token + `TIKTOK_DEFAULT_BC_ID`
2. Cuenta con `external_account_id` real
3. BC con saldo > monto de prueba
4. Recarga Stripe chica → Asignar $1–5 a esa cuenta
5. Verificar en TikTok Ads Manager que subió el saldo del advertiser
6. Logs Vercel: `[tiktok-bc] transfer_ok`
