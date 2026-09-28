---
tipo: decision
tags: [decision, pagos, pen, cobrana]
fecha: 2026-09-10
estado: vigente
---

# Cobrana es la vía principal en soles y el bot de correo queda en pausa

## Decisión

Las recargas en soles se cobran por **Cobrana**, la pasarela peruana que emite un
código de pago de servicios bajo la marca 360Pay. El cliente lo paga desde Yape,
BCP o Interbank y el saldo entra solo.

El bot propio de validación por correo queda archivado en la rama
`feat/yape-validacion-automatica`, sin mergear. Se integra más adelante, no ahora.

## Qué se descartó y por qué

**El bot de validación por correo**, que ya estaba terminado. Lee el buzón de
Gmail, identifica el yapeo por céntimos únicos y acredita sin intervención
humana. Su ventaja es real: el yapeo directo cuesta **0%** contra el **0.75%**
de Cobrana.

Se descartó como vía principal porque tiene más piezas que se pueden romper:
depende de que Gmail entregue el correo a tiempo, de leer texto de un banco que
puede cambiar el formato, y de un OCR que se puede engañar con un comprobante
falso. Cobrana avisa por webhook firmado.

También pesó que el bot esperaba una cuenta Yape que todavía no existía, mientras
Cobrana ya estaba integrada.

## El criterio de fondo

Menos piezas móviles gana, salvo que la diferencia de costo sea grande. Si el
volumen en soles crece hasta que ese 0.75% duela, se retoma el bot.

## Estado

- Implementado en: `main`, desde el 8 de septiembre de 2026
- Primer pago real acreditado: ver [[Cobrana acreditó su primer pago real en 93 segundos]]
- Riesgos abiertos: [[El código de Yape es el mismo para todos los cobros de un cliente]]
- Bloquea a: nada

## Enlaces

- [[Negocio — MOC]]
- [[Auditoría de Cobrana]]
- El bot, si se retoma: no debe tocar la aprobación de comprobantes manuales, que
  es una regla deliberada del negocio
