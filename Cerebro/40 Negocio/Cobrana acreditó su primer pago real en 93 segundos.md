---
tipo: nota
tags: [pagos, pen, cobrana, hito]
fecha: 2026-09-10
---

# Cobrana acreditó su primer pago real en 93 segundos

La noche del **9 de septiembre de 2026** entró el primer pago de verdad por
Cobrana. Hasta ese momento se habían generado 14 cobros y **ninguno se había
pagado**, así que la mitad que acredita el saldo nunca había corrido.

| | |
|---|---|
| Cliente | Cliente B (nombre y DNI omitidos; ver panel de Cobrana) |
| Código | `HOL••••0646` |
| Pagó | S/ 352.80 |
| Recibió | $100.00 en cartera |
| Tipo de cambio | 3.36 · fee 5% |
| Cobro creado | 23:44:33 (Lima) |
| Saldo acreditado | 23:46:06 |

La cuenta cuadra exacta: 100 × 1.05 = 105, × 3.36 = **352.80**. Ni un céntimo de
diferencia.

Llegó un solo aviso `charge.paid`, se procesó sin error, y quedó **un solo
asiento** en el libro contable. Sin duplicados.

## Por qué importa

Cierra la duda que dejó la [[Auditoría de Cobrana]]: hasta ese pago, todo lo que
sabíamos del camino de vuelta salía de leer código, no de verlo funcionar. Ahora
está probado que Cobrana tiene registrada nuestra dirección de avisos y que manda
el monto como lo esperamos.

## Lo que este pago no probó

Funcionó porque ese cliente tenía **un solo cobro abierto**. Los dos hallazgos
graves de la auditoría siguen ahí sin dispararse:
[[El código de Yape es el mismo para todos los cobros de un cliente]] y
[[Un aviso de pago que falla queda muerto para siempre]].

## Enlaces

- [[Negocio — MOC]]
- [[Cobrana es la vía principal en soles y el bot de correo queda en pausa]]
