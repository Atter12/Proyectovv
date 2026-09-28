---
tipo: informe
tags: [informe, qa, pagos, cobrana]
fecha: 2026-09-10
apartado: Pagos en soles
rama: revisión sobre main
---

# Auditoría de Cobrana

## Alcance

Revisión del código de la integración Cobrana y de los datos reales de
producción: firma de webhooks, validación de montos, idempotencia del libro
contable, tipo de cambio, y las 14 intenciones de pago existentes.

Fuera de alcance: el panel de administración de Cobrana y sus términos
comerciales.

Se hizo en modo lectura. No se modificó código ni datos.

## Hallazgos

| # | Severidad | Hallazgo | Dónde |
|---|---|---|---|
| 1 | Alto | [[El código de Yape es el mismo para todos los cobros de un cliente]] | Cobrana (externo) |
| 2 | Alto | [[Un aviso de pago que falla queda muerto para siempre]] | `webhooks/payments/[provider]` |
| 3 | Medio | `cancelCobranaCharge` existe pero no la llama nadie | `cobrana/client.server.ts` |
| 4 | Medio | Si la API de Cobrana falla queda una intención huérfana | `create-intent.server.ts` |
| 5 | Bajo | El registro de auditoría cuenta depósitos de más | `ledger_confirm_deposit` |

## Lo que sí está bien

No es una lista de cortesía: cada punto se comprobó en el código o en los datos.

- **Nadie puede fingir un aviso de pago.** Firma HMAC-SHA256 con comparación a
  tiempo constante y ventana de 5 minutos contra reenvíos. Sin firma válida, 401.
- **Es imposible acreditar dos veces el mismo pago.** Tres candados encadenados:
  un solo asiento por `(source_table, source_id, journal_type)`, llave de
  idempotencia, y bloqueo de fila con `FOR UPDATE`. **Verificado en datos: 65
  depósitos, ninguno duplicado.**
- **El monto y la moneda se comparan antes de acreditar.**
- **El libro contable no deja acreditar más de lo cobrado.**
- **El tipo de cambio es serio.** Ver [[El tipo de cambio se congela en el cobro]].
- **No hay puerta trasera por comprobante.** A un cobro Cobrana no se le puede
  subir una captura: solo aceptan comprobante el pago manual y el cripto.

## Conclusión

No se encontró forma de acreditar saldo sin haber pagado, ni acreditación
duplicada. Las defensas están bien puestas.

Lo que faltaba era la prueba en vivo, que llegó al día siguiente:
[[Cobrana acreditó su primer pago real en 93 segundos]].

## Enlaces

- [[Operación y QA — MOC]]
- [[Cobrana es la vía principal en soles y el bot de correo queda en pausa]]
