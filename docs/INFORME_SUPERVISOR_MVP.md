# Informe para supervisor — Proyecto Hecom / Proyectovv

**Fecha:** 17 de julio de 2026  
**Meta:** llegar a un **MVP** (versión mínima usable) de la plataforma para clientes.

---

## Situación actual

Estamos construyendo una plataforma donde cada cliente tendrá **su propio dashboard** para operar de forma autónoma: **recargar saldo, subir/gestionar sus campañas y ver sus recargas y gastos**. La idea es que el cliente maneje todo desde un solo lugar, ordenado y profesional.

Ya existe una base del sistema (web + base de datos + panel de administración). El siguiente paso es cerrar un MVP claro y usable con clientes reales.

Además, la empresa ya tiene una **API de TikTok for Business** aprobada (**Hecom Club Spend Sync**). Eso es un activo importante: permite leer cuentas y gastos de publicidad de forma automática.

---

## Qué será el MVP

El MVP estará compuesto de:

1. **Dashboard propio de cada cliente** — cada cliente entra a su cuenta y opera solo.
2. **Recargar saldo** — pago con tarjeta y también pago manual (transferencia u otro método) con aprobación del equipo.
3. **Subir / gestionar campañas** — el cliente sube y administra sus campañas desde su panel.
4. **Ver recargas y gastos** — historial de recargas y gasto reflejado de forma clara.
5. **Wallet (saldo)** — cada cliente tiene su saldo controlado y auditado.
6. **Gasto automático desde TikTok** — el sistema trae el gasto usando la API ya aprobada y lo refleja en el saldo.
7. **Panel admin** — el equipo interno aprueba pagos, ve movimientos y opera el día a día.

**No entra en el MVP (después):** crédito automático tipo x2/x3/x5 y recargas cripto totalmente automáticas.

---

## Roles del equipo

| Persona | Responsabilidad |
|---|---|
| **Atter** | Backend y sistema: que todo funcione de punta a punta (pagos, saldos, TikTok, admin, seguridad, despliegue). |
| **Daniel** | Frontend y diseño: maquillar la interfaz para que se vea **corporativa y profesional**, no genérica ni “hecha por IA”. |

Ambos avanzan hacia la misma meta: **MVP listo para piloto con clientes reales**.

---

## Por qué importa la API de TikTok

Con la API ya aprobada se puede:

- conectar las cuentas publicitarias del cliente, y  
- sincronizar el gasto de forma automática.

Eso es el núcleo para que el gasto se refleje solo en el dashboard del cliente, sin trabajo manual.

---

## Resultado esperado

Al cerrar el MVP:

- cada cliente tiene su propio dashboard para recargar, subir campañas y ver sus gastos;
- el gasto de TikTok se refleja solo;
- el equipo interno opera desde un panel, no a ciegas;
- se puede probar con un grupo pequeño de clientes antes de abrirlo al resto.

---

## Próximo paso

Arrancar por **recargas + saldo** (sin eso no hay producto) y en paralelo preparar la **sincronización de gasto con TikTok**, que es donde más se gana respecto al proceso manual actual.
