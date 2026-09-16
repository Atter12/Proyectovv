# Pago manual BCP / Binance — auto-crédito con doble prueba

## Separación de canales

| Canal | Camino |
|-------|--------|
| **Yape** | Cobrana + bot chat (`recharge_chat_bot`) |
| **Pago manual** | BCP PEN + BCP USD + Binance (`source=dashboard`) |

No mezclar: el matcher de Yape solo cruza intents del bot; el de pago manual solo cruza intents del panel.

## Doble prueba (igual que Yape)

1. **Monto exacto único** al crear el intent (céntimos discriminadores).
2. **Mail de abono** en la casilla ops (BCP transferencia o Binance Pay).
3. **Comprobante** con IA coherente (mismo monto / beneficiario).

Sin mail → **nunca** auto-acredita solo con la foto.  
Sin comprobante → el mail marca `bank_confirmed_at` y espera.

## Flujo

1. Cliente crea pago manual → `gross_pen_cents` / `gross_usd_cents` con céntimos únicos.
2. Transfiere **exactamente** ese monto (BCP o Binance).
3. Cron `/api/jobs/yape-mailbox` (cada 2 min) lee IMAP y enruta:
   - texto Yape → matcher bot
   - transferencia BCP / Binance → matcher `manual-bank-match`
4. Cliente sube voucher → si el mail ya matcheó, se acredita; si no, espera el cron.
5. Al acreditar: `ensureHecomWalletCobroSyncedBestEffort` registra el cobro en Hecom.

## Registrar en Hecom (Lo pagado) — obligatorio

**Todo camino que deje un depósito en `succeeded` tiene que llamar a
`ensureHecomWalletCobroSynced`** (`lib/hecom/ensure-wallet-cobro.server.ts`), o
el pago acredita saldo en la cartera y nunca aparece en cobros de Hecom.

Esto se rompió: `completeYapeConfirmedDeposit` y
`completeManualBankConfirmedDeposit` acreditaban sin puentear (arreglado el
16/09). Solo los caminos con webhook y la aprobación manual de gerencia
registraban. Se notó recién porque los auto-abonos hasta ahora solo los habían
usado pagos de prueba del equipo.

Caminos que hoy puentean:

| Camino | Archivo |
|--------|---------|
| Webhook (Stripe / Cobrana / crypto) | `create-intent.server.ts` → `processSuccessfulPaymentIntent` |
| Aprobación manual de gerencia | `review-manual-payment.server.ts` |
| Auto-abono Yape (bot) | `yape/confirm-deposit.server.ts` |
| Auto-abono BCP / Binance | `manual-bank-match/confirm-deposit.server.ts` |
| Cobro de deuda crédito | `credit-lock/credit-lock.server.ts` |

Quedan fuera a propósito `allocate-with-tiktok` y `reclaim-with-tiktok`: son
importes/devoluciones de saldo TikTok, no pagos del cliente.

Curar faltantes: `node scripts/backfill-hecom-wallet-cobros.mjs --dry-run`
(cubre los 4 canales; es idempotente por `codigo`).

### `periodo_resumen`

El endpoint de Hecom lo calcula **del mes de `paid_at`** e ignora cualquier
período que le mandemos (probado el 16/09 contra el bridge en dry-run). Si un
cobro aparece en un mes distinto al del pago, fue movido a mano en el CRM
después — no lo hace la integración. Ojo al depurar: en el CRM las tablas
filtran por **período**, no por fecha de pago, así que un cobro re-asignado a
un mes anterior parece "no guardado" cuando en realidad está.

## Env

Ya usadas por Yape (misma casilla):

- `YAPE_MAIL_USER` / `YAPE_MAIL_PASSWORD` / `YAPE_MAIL_HOST`
- `YAPE_MAIL_FROM_FILTER` (opcional)
- `YAPE_UNIQUE_PEN_CENTS` (default true)
- `YAPE_MATCH_WINDOW_MINUTES` (default 180)

Nuevas / opcionales:

- `MANUAL_UNIQUE_USD_CENTS` (default = mismo que PEN)
- `MANUAL_MAIL_FROM_FILTER` (si vacío: viabcp, bcp.com.pe, binance.com)
- `MANUAL_PAYMENT_BINANCE_EMAIL`

## Fallbacks

Cualquier ambigüedad (0 o 2+ intents, monto distinto, foto fraudulento) → cola de gerente como hasta ahora.
