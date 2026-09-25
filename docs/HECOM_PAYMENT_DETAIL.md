# Lectura de pagos de AdsHolistic desde Finanzas Hecom

`GET /api/internal/hecom/payment-detail` consulta datos existentes. No registra,
sincroniza ni modifica pagos, saldos, comisiones o períodos.

La llamada servidor a servidor usa `Authorization: Bearer` con el secreto ya
configurado `HECOM_COBROS_BRIDGE_SECRET`. No requiere una sesión del navegador.
No devuelve credenciales, correos, nombres, metadatos completos ni enlaces de
checkout o comprobantes. Hecom mantiene su permiso y RLS antes de llamar.

## Parámetros

- `clientId`: UUID exacto de Hecom, cotejado con `metadata.hecom_cliente_id`.
- `receiptDate`: fecha real `YYYY-MM-DD`.
- `paymentId`: UUID opcional del payment intent identificado por la referencia
  original del cobro. No se busca por importe, nombre o correo.

Con `paymentId` devuelve únicamente ese pago del cliente. Un ID ausente y un ID
de otro cliente producen el mismo resultado vacío. Sin él devuelve hasta 100
pagos del cliente en el mes de `receiptDate`, por `succeeded_at` y, cuando esa
fecha está vacía, `created_at`. Los límites de mes usan Lima (UTC−05:00).

## Resultado

`{ok, source, checkedAt, coverage, payments}`. `coverage` informa modo
`exact_payment` o `client_month`, mes, límite, cantidad, `hasMore`, `complete`,
`journalsComplete`, `dateBasis` y `timezone`. `complete` describe únicamente la
lista de pagos y equivale a `!hasMore`. No certifica todo el historial del cliente.

Cada pago incluye ID, estado, importe y moneda originales del cargo, proveedor
y referencia, fechas, relación con la consulta, `funding`, `original` y
`wallet_credit`. `same_client_month` significa contexto del mismo cliente;
**no demuestra que sea la recarga de ese cobro**.

`funding` reutiliza `buildWalletFunding`, con importes USD de la cotización
congelada y tasas originales. Puede ser `null` o contener componentes sin
clasificar. Un FEE calculado cero con tasa `null` no significa FEE gratuito.
Los pagos de crédito conservan `credit_debt`; no se convierten en recargas.
`original.fx_rate_usd_pen` solamente expone el tipo de cambio guardado: jamás
el actual. `amount_cents/currency` pueden ser PEN aunque `funding` esté en USD.

`wallet_credit.verified` requiere un asiento de depósito publicado, sin
reversión, con `source_table=payment_intents`, `source_id` exacto y la misma
organización y cartera del pago exitoso. Devuelve el importe real del asiento,
moneda y fecha de publicación. Si difiere de la cotización, esta última queda
sin clasificar; el asiento sigue visible. No representa consumo ni asignación
a TikTok. Los demás estados son `not_found`, `source_mismatch` o `unavailable`.

Las respuestas son privadas, sin caché. Las consultas comparten un límite de
20 segundos. Un fallo de pagos responde 502; un fallo exclusivo del ledger
mantiene los pagos y declara `journalsComplete:false`.

## Validación

`node --test scripts/test-hecom-payment-detail.mjs scripts/test-hecom-wallet-funding.mjs`

Se cubren autorización antes de consultar, parámetros, cruce entre clientes,
límite y cobertura, integridad del asiento, reversión, moneda e importe,
ausencia de PII y fallos parciales. Los fixtures son sintéticos.
