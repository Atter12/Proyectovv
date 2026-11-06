# NOWPayments: conciliación de pagos divididos

## Incidente del 5 de noviembre de 2026

La factura `5000861814`, intención `8b83d727-a72f-45d2-aacd-21e62edc1467`,
cobraba USD 66 para acreditar USD 60. Sus IPN verificados registraron dos pagos
independientes en USDT TRC20: `4600956943` por 56 y `5323306333` por 10.
Ambos alcanzaron `partially_paid`. El primer importe cotizado fue 65.941421 USDT.

El webhook anterior evaluaba cada pago por separado y sustituía
`crypto_actually_paid` por el último importe. Por eso mostró un faltante de
55.91 USDT después del segundo pago. El error estaba en la conciliación, no en
la fórmula de USD 60 + USD 6. Los IPN no permiten determinar qué escribió el
cliente en su billetera externa ni por qué hizo dos transferencias.

Esta intención ya fue acreditada manualmente, con autorización del titular del
sistema, mediante el ledger. No debe volver a acreditarse ni reasignarse a TikTok.

## Corrección

- Reconstruir el total desde los IPN verificados de la misma orden y factura.
- Contar una sola vez el importe acumulado de cada `payment_id`, únicamente en
  estados `partially_paid` o `finished`; excluir pagos fallidos o reembolsados.
- Comparar contra la primera cotización en el mismo activo/red. Conservar la
  política existente de absorber hasta 2 USDT; no aplicarla a otros activos.
- Dejar para revisión monedas mezcladas, pagos con padre y datos inconsistentes.
- Usar una única clave de idempotencia del ledger por intención, incluso cuando
  diferentes notificaciones se procesan concurrentemente.
- Permitir reintentar un IPN registrado si su procesamiento falló. No rebajar
  el estado ni sobrescribir el faltante de una recarga ya acreditada.
- Mostrar un faltante neutral basado en el total; no atribuirlo a Binance.

No se ejecuta una acreditación masiva de operaciones históricas con este cambio.
Las pruebas de webhook usan dependencias simuladas, sin cobrar ni enviar correos.
La reproducción de los siete IPN reales se realizó en lectura: total 66 USDT,
intención ya `succeeded`, sin un nuevo movimiento de saldo.

## Validación

```powershell
node --test lib/payments/providers/nowpayments-reconciliation.test.ts lib/payments/providers/nowpayments-webhook.test.mjs lib/payments/providers/nowpayments-flow.test.ts lib/payments/providers/nowpayments-ipn.test.ts lib/payments/my-recharges.test.ts
npm run typecheck
```
