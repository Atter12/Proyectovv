---
tipo: nota
tags: [riesgo, pagos, cobrana, abierto]
fecha: 2026-09-10
severidad: alto
estado: sin resolver
---

# El código de Yape es el mismo para todos los cobros de un cliente

El código que el cliente escribe en Yape es `HOL` + su DNI. **No cambia por
cobro: cambia por persona.**

Un mismo cliente puede tener varios cobros abiertos compartiendo código, con
montos distintos:

```
Cliente A (nombre y DNI omitidos; ver panel de Cobrana)

  21:06  S/174.33   HOL••••7125   chg_2dc6b1ad
  21:05  S/174.33   HOL••••7125   chg_d6439c60
  19:49  S/185.46   HOL••••7125   chg_32fa17c4
  19:45  S/185.46   HOL••••7125   chg_fdcf7046
  16:39  S/174.33   HOL••••7125   chg_f62b19cb
  15:22  S/191.40   HOL••••7125   chg_ab53f720
```

Seis cobros, cuatro montos, un solo código.

## Qué falla

El cliente no puede elegir cuál cobro paga, y nosotros no controlamos a cuál lo
atribuye Cobrana. Si lo atribuye a uno con otro monto, el sistema compara contra
la intención, no cuadra y **rechaza la acreditación**. El cliente pagó y se queda
sin saldo.

La validación de monto está bien y no hay que quitarla. El problema es de arriba:
no debería haber seis cobros compitiendo por el mismo código.

## Arreglo propuesto

Un solo cobro Cobrana abierto por cliente. Si pide otro, se reusa el pendiente o
se cancela el anterior antes de crear el nuevo.

Existe `cancelCobranaCharge` en `lib/payments/cobrana/client.server.ts`, pero
**no la llama nadie**: los 14 cobros figuran cancelados por un `UPDATE` sin
usuario, hecho a mano.

## Por qué sigue abierto

El código es de Fernando. Se le pasó la auditoría el 9 de septiembre; a la fecha
de esta nota no hay cambios al respecto en `main`.

## Enlaces

- [[Operación y QA — MOC]]
- [[Auditoría de Cobrana]]
- [[Un aviso de pago que falla queda muerto para siempre]] (se combinan mal)
