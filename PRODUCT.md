# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Principal:** vendedores pequeños de Perú que anuncian en TikTok con las cuentas publicitarias que les presta Holistic. Venden suplementos, ropa, productos para el hogar y similares, sobre todo por WhatsApp o contra entrega (COD). Recargan su cartera, asignan saldo a sus cuentas y quieren saber si sus anuncios venden.
- **Secundario:** el staff de Holistic (gerentes y superadmins), que entra en modo "ver como cliente" para revisar, acompañar y cobrar.
- Entran **sobre todo desde la computadora**; el celular y la app de iOS (Capacitor) deben funcionar, pero no son la pantalla principal.

## Product Purpose

Ads Holistic es la plataforma donde el cliente maneja sus cuentas de TikTok, recarga su cartera y ve cuánto gasta y cuánto vende. Profit es la sección de estadísticas: gasto, rendimiento por campaña y producto, y señales de qué escalar o apagar. El Radar (en construcción, `docs/PLAN_PROFIT_RADAR.md`) vive dentro de Profit: conoce el gusto del cliente con rondas de videos que hoy funcionan en TikTok y le arma una receta única para que su próximo video sea original y siga lo que funciona.

Éxito: clientes que venden más gastando lo mismo, y por eso se quedan y recargan más.

## Positioning

Holistic maneja cientos de cuentas de TikTok de vendedores peruanos y ve su gasto y resultados reales. Ese conocimiento agregado (sin exponer a ningún cliente) es lo que ninguna herramienta genérica de anuncios tiene.

## Operating Context

- Los clientes reciben cuentas del Business Center de Holistic; no conectan su propio TikTok.
- Recargan en soles (Yape, transferencia, Cobrana) y en dólares; el gasto se mide en dólares.
- El staff trabaja en paralelo con WhatsApp y Ads Manager de TikTok.
- Next.js 16 + Supabase; textos en `messages/{es,en,pt-BR}.json`; el staff ve el panel forzado en español.

## Capabilities and Constraints

- El Radar **nunca** le dice al cliente que copie un video: analiza, junta rasgos y genera ideas propias (receta, no copia).
- Los videos de TikTok se muestran con el reproductor oficial insertado, sin descargarlos; si un video muere se reemplaza sin mostrar error.
- Nunca se muestran datos, videos o nombres de un cliente a otro; solo recetas agregadas con mínimo 5 cuentas por grupo.
- El Copiloto no toca pagos, cartera ni recargas; cualquier cambio de presupuesto lo confirma el cliente.
- Respetar los límites de la API de TikTok.
- Abierto: si un cliente sin consentimiento puede ver recetas; lista final de rubros.

## Brand Commitments

- **Ads Holistic** (con espacio) es el producto; **Holistic Marketing** es la empresa y dueña del logo (`Cerebro/10 Producto`).
- Voz: **tú**, cercano, español peruano neutro ("elige", "sube tu video"). Sin voseo en textos nuevos.
- Decisiones de marca vigentes en `Cerebro/20 Marca y Diseño/` y `docs/SISTEMA_DISENO_HOLISTIC.md`.

## Evidence on Hand

- Métricas reales de producción citadas en la propuesta del Copiloto (octubre 2026): 57 clientes, 337 cuentas de TikTok, 45–52 con gasto reciente, todas de Perú.
- No hay testimonios, casos de éxito ni benchmarks publicados: no inventarlos.

## Product Principles

1. El cliente debe entender qué hacer después, no solo ver números.
2. Lo que gana se enseña como receta propia, nunca como algo para copiar.
3. Nada de un cliente se le muestra a otro.
4. El cliente decide; la plataforma propone.
5. Menos soporte: que el cliente resuelva solo dentro de la plataforma.
