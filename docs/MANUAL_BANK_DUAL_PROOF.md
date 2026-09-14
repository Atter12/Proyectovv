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
