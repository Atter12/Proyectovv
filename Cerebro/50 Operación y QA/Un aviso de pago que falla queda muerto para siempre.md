---
tipo: nota
tags: [riesgo, pagos, webhooks, abierto]
fecha: 2026-09-10
severidad: alto
estado: sin resolver
---

# Un aviso de pago que falla queda muerto para siempre

El aviso de la pasarela se anota en la base **antes** de procesarse. Si el
procesamiento falla, queda marcado como fallido y le respondemos error.

La pasarela reintenta. Y el reintento choca con el índice único
`(provider, event_id)`, así que le contestamos `{ok: true, duplicate: true}` sin
volver a intentar nada.

```
avisos en la base       688 procesados
                         38 fallidos   (Stripe, agosto)

reintento del mismo aviso  ->  índice único
                           ->  {ok:true, duplicate:true}
                           ->  nunca se vuelve a procesar
```

## Qué falla

Cualquier tropiezo pasajero (la base lenta, un despliegue en ese segundo)
convierte un pago real en saldo que nunca llega. Y **no hay alarma**: para la
pasarela quedamos como que recibimos bien.

## Por qué es peor de lo que parece

Se combina con
[[El código de Yape es el mismo para todos los cobros de un cliente]]: si Cobrana
atribuye el pago al cobro equivocado, el monto no cuadra, el aviso se marca
fallido, y los reintentos rebotan. El cliente pagó y no hay forma automática de
recuperarlo.

## Arreglo propuesto

Que un aviso en estado `failed` se pueda reprocesar en vez de contarse como
duplicado. Hoy `recordWebhookEvent` devuelve duplicado sin mirar el estado
anterior.

Los 38 fallidos actuales son de agosto y de otro problema ya corregido, pero el
agujero sigue abierto.

## Enlaces

- [[Operación y QA — MOC]]
- [[Auditoría de Cobrana]]
