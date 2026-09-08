# Tipo de cambio USD→PEN (cobros en soles)

**Actualizado:** 2026-09-08

## ¿Dónde aplica?

Solo cuando el cliente **paga en PEN**:

| Canal | ¿Usa TC? |
|-------|----------|
| BCP / voucher manual (PEN) | Sí |
| Yape / Cobrana | Sí |
| Manual USD, Stripe, crypto | No |

La cartera acredita **USD**. El TC convierte el crédito deseado → soles a transferir.

## Fuente (cuidadosa)

1. **Preferida:** serie BCRP `PD04640PD` — *TC Sistema bancario SBS (S/ por US$) - Venta*  
   (republish oficial del promedio SBS venta; sin APIs de terceros de pago)
2. **Fallback:** `HOLISTIC_USD_PEN_RATE` si falla la red, no hay dato, o el valor es raro
3. **Congelado** en el intent: `metadata.fx_rate_usd_pen` (no cambia a mitad del pago)

## Env

```env
FX_RATE_SOURCE=sbs          # sbs | manual
HOLISTIC_USD_PEN_RATE=3.48  # fallback + ancla de tolerancia
# HOLISTIC_USD_PEN_SPREAD=0  # margen opcional sobre venta SBS
# HOLISTIC_USD_PEN_MIN=3.0
# HOLISTIC_USD_PEN_MAX=4.5
# HOLISTIC_USD_PEN_TOLERANCE_PCT=0.08  # ±8% vs fallback
```

`FX_RATE_SOURCE=manual` → nunca llama BCRP; solo env.

## Código

- `lib/payments/fx-rate.server.ts` — resolve + cache 6h + validación
- Cotización intents: `create-intent.server.ts` → `resolveUsdPenRateForQuote()`
- Preview UI: `GET /api/payments/manual/config`

## Criterio de seguridad

- Timeout corto; si falla → env
- Rango absoluto + tolerancia relativa al fallback
- No scrapear HTML frágil de sbs.gob.pe
- Spread default **0** (no encarecer en silencio); si gerencia quiere margen, setear `HOLISTIC_USD_PEN_SPREAD` a propósito
