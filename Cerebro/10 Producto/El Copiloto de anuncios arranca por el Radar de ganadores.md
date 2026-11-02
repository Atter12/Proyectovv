---
tipo: decision
tags: [decision, producto, copiloto, ia, investigacion]
fecha: 2026-10-05
estado: abierto
---

# El Copiloto de anuncios arranca por el Radar de ganadores

## Decisión

El proyecto de investigación y mejora es el **Copiloto de anuncios con IA**, para
el cliente final (el vendedor que entra a Ads Holistic). Es un ciclo de cuatro
piezas que se alimentan entre sí:

1. **Radar de ganadores (descubrir).** Detecta qué anuncios ganan entre las
   cuentas de los clientes y extrae su receta: gancho de los primeros 3 s,
   duración, formato, texto en pantalla, llamado a la acción y rubro. Al cliente
   le muestra qué funciona en su rubro esta semana, siempre agregado y anónimo.
2. **Estudio creativo (replicar).** De una foto o una frase del producto, tres
   guiones basados en las recetas ganadoras de su rubro y, si es viable, la
   imagen o el video.
3. **Predictor antes de gastar (predecir).** Nota del creativo frente a las
   recetas ganadoras y referencias de costo por resultado del rubro.
4. **Piloto de campañas (optimizar).** Propone mover presupuesto entre anuncios
   y solo actúa si el cliente confirma. Los ganadores vuelven al Radar.

Se construye en este orden y **empieza por el Radar**, porque es la base del
ciclo y lo único que nadie más tiene: los resultados reales de cientos de
cuentas de TikTok de vendedores.

Complementa al proyecto del otro equipo (educación, referidos y calendario de
soporte): ellos enseñan y acompañan, esto le da resultados. Donde tenga sentido
se enlaza a sus piezas, por ejemplo un video de educación cuando el Predictor
detecta un error común.

## Qué se descartó y por qué

- **Estado de cuenta del cliente / "confianza en el saldo".** Ya se hizo algo
  parecido con Atter en el proyecto anterior y no tiene el impacto que se busca.
- **Empezar por el Estudio creativo.** Es la demo más vistosa, pero sin el Radar
  sería un generador genérico más, igual a los que ya existen.
- **Un Piloto que actúe solo.** Mueve presupuesto del cliente: siempre propone y
  el cliente confirma. Nunca toca cartera, ledger ni recargas.
- **Comparar entre países.** Hoy todas las cuentas se crean como Perú; no hay
  datos para comparar países todavía.

## El criterio de fondo

Cada pieza tiene que hacer que el cliente **venda más gastando lo mismo** y
apoyarse en datos propios de Holistic. Las reglas que no se negocian:

- No se tocan pagos, cartera, ledger ni recargas.
- El Piloto nunca cambia campañas ni mueve dinero sin confirmación del cliente.
- El Radar y las comparaciones son agregados y anónimos, con un **mínimo de 5
  cuentas por grupo** (propuesto) y con consentimiento del cliente.
- El impacto se mide desde el día 1: costo por resultado antes y después,
  adopción de cada pieza y si los clientes recargan más.

## Estado

- Fase 0 (relevamiento): hecha, ver [[Fase 0 del Copiloto - hoy no guardamos rendimiento por anuncio]].
- Pendiente de decidir: cómo se registra el rubro del cliente y el mínimo de
  cuentas por grupo.
- Bloqueado por: rubro del cliente (no existe) y métricas por anuncio (no se
  guardan).
- Propuesta para el equipo: `output/propuesta-copiloto/Propuesta-Copiloto-de-anuncios.pdf`.

## Enlaces

- [[Producto — MOC]]
- [[Fase 0 del Copiloto - hoy no guardamos rendimiento por anuncio]]
