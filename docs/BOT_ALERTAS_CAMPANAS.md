# Bot de alertas y análisis de campañas TikTok

**Estado:** Fase 0 en deploy · señales visibles en Profit (cliente + gerencia)
**Fecha:** 2026-09-15 · actualizado 2026-09-17
**Origen:** pedido de ops (Annie): *“lo que muestras son las métricas tal cual se ven
en Ads Manager, solo dentro de Ads Holistic. Lo que quiero es que el bot analice cada
campaña con las métricas de TikTok Ads.”*

Alerta insignia pedida por gerencia: **“se gastó todo el saldo de manera rápida”**.

---

## 0. Resumen

| Pregunta | Respuesta |
|----------|-----------|
| ¿Se puede? | **Sí.** La brecha es de integración, no de capacidades. |
| ¿Faltan datos de TikTok? | No para el MVP. Ya se traen métricas por campaña. |
| ¿Falta LLM? | No. Ya hay OpenAI en producción (creativos + vouchers). |
| ¿Qué falta de verdad? | Persistencia histórica, alerta de quema de saldo, panel ops, score. |
| **Fase 0 (listo)** | `buildSignals()` ya se **renderiza** en Profit. Cliente ve alertas; gerencia ve kind + badge y hint de crédito. |
| ¿Dónde se ve? | **Profit** (cliente) + vista gerencia más detallada (score / crédito). |

---

## 1. Qué ya existe (verificado)

### Métricas por campaña — existe, sin guardar

`lib/integrations/tiktok/campaign-performance.server.ts` ·
`fetchCampaignPerformanceForAdvertisers()`

- TikTok `/report/integrated/get/` con `data_level: AUCTION_CAMPAIGN`,
  `dimensions: ["campaign_id","campaign_name"]`.
- Métricas: `spend`, `impressions`, `clicks`, `ctr`, `cpc`, `cpm`, `conversion`,
  `cost_per_conversion`.
- **Solo caché en memoria, TTL 5 min.** No hay tabla histórica → hoy es imposible
  decir “esta campaña cayó respecto a la semana pasada”.
- No hay nivel `AUCTION_ADGROUP` / `AUCTION_AD`, ni ROAS real de TikTok
  (`complete_payment_roas`), ni métricas de video.

### Señales por campaña — existe y se descarta

`lib/realprofit/profit-snapshot.server.ts` · `buildSignals()` (líneas 187-277)

Motor determinista, sin LLM, devuelve hasta 8 `ProfitSignal`:

| `kind` | Regla actual |
|--------|--------------|
| `concentration` | campaña top con `spendShare >= 0.4` |
| `pacing` | ratio `>= 1.35` (acelerando) o `<= 0.5` (bajo) |
| `silent` | sin gasto hoy |
| `weak_roas` | `roasEstimated < 1` con share `>= 0.08` |
| `low_ctr` | `ctr < 0.5 %` con share `>= 0.05` |

El campo `signals` viaja hasta el cliente (`ProfitPageClient.client.tsx:89`) y
**no se renderiza en ningún lado**. El cálculo se tira a la basura.

### Saldo y gasto en vivo — existe

- `lib/ledger/ledger.server.ts` · `getAdAccountLedgerBalance()` /
  `getAdAccountLedgerBalances()` sobre la vista `v_ad_account_ledger_balances`
  (`availableBalanceCents`, `reservedBalanceCents`, `lifetimeSpendCents`).
- `lib/integrations/tiktok/advertiser-live.server.ts` · spend del día en vivo.
- `/api/ad-accounts/live-metrics` ya lo consume la UI.

### IA — existe, pero no ve métricas

Dos `fetch` a `api.openai.com/v1/chat/completions` con
`response_format: json_object`, modelo `serverEnv.openAiVisionModel`:

| Uso | Archivo |
|-----|---------|
| Análisis de creativos (scores, hooks, riesgo política) | `lib/creatives/analyze-creative.server.ts` |
| OCR de comprobantes de pago | `lib/payments/voucher-analysis.server.ts` |

**Ningún prompt recibe métricas de campaña.** Detalle: `buildAgentBriefWithOpenAi`
acepta `spendHintUsd` y `createAgentDraft()` nunca lo pasa — gancho muerto.

### Infra reutilizable

| Pieza | Para qué |
|-------|----------|
| `creative_analysis_jobs` + `processQueuedCreativeJobs` | molde de job asíncrono |
| `createNotificationBestEffort()` (`lib/notifications/`) | entregar la alerta |
| `crons` en `vercel.json` | ya hay 3 (`yape-mailbox` 2 min, `auto-recharge` diario, `creative-analysis` 5 min) |
| `CampaignSpendExplorer.client.tsx` | UI de campañas ya escrita, **sin importar en ningún archivo** |

---

## 2. Catálogo de alertas propuesto

### 2.1 Saldo quemado rápido — la que pidió gerencia

No depende de TikTok: sale del ledger + spend en vivo.

```text
burn_rate = gasto desde la última asignación / horas transcurridas
horas_para_vaciar = saldo_disponible / burn_rate
```

| Severidad | Condición |
|-----------|-----------|
| `warn` | gastó ≥ 50 % del último saldo asignado en < 6 h |
| `critical` | gastó ≥ 80 % en < 3 h, o `horas_para_vaciar < 2` |
| `info` | saldo se agotó (disponible = 0) y hay campañas activas |

Copy sugerido: *“La cuenta X quemó $180 de los $200 asignados en 2 h 40 min. Al ritmo
actual se queda sin saldo antes de las 11 p.m.”*

Requiere leer el momento de la última asignación desde el journal del ledger
(`allocate-with-tiktok.server.ts` ya deja el asiento).

### 2.2 Rendimiento por campaña

| Alerta | Regla base | Necesita historial |
|--------|-----------|--------------------|
| ROAS bajo break-even | `roasEstimated < breakEvenRoas` con share relevante | no |
| CTR desplomado | CTR de hoy < 50 % del CTR 7d de esa campaña | **sí** |
| CPA en subida | CPA hoy > 1.5× CPA 7d | **sí** |
| Campaña zombie | gasto > umbral y 0 conversiones en 48 h | **sí** |
| Concentración | una campaña se lleva > 40 % del budget | no |
| Campaña muda | tenía gasto ayer y hoy 0 | **sí** |

Las marcadas con historial son las que hacen valioso el bot, y son justo las que
hoy no se pueden calcular por falta de persistencia.

---

## 3. Arquitectura por fases

### Fase 0 — Quick win · **HECHO 2026-09-17**

Renderizar los `signals` que ya llegan al cliente en Profit
(`ProfitPageClient.client.tsx`). Cero migraciones, cero prompts.

- **Cliente:** bloque “Alertas de rendimiento” encima del ranking de campañas.
- **Gerencia (`isStaff`):** mismo bloque + badge de avisos + `kind` técnico + hint
  de que alimenta el criterio de crédito.

Siguiente: Fase 1 (historial) + alerta “saldo quemado rápido”.

### Fase 1 — Persistir métricas por campaña

```sql
-- tabla nueva
tiktok_campaign_metrics_daily (
  advertiser_id, campaign_id, stat_date,
  campaign_name, spend, impressions, clicks, ctr, cpc, cpm,
  conversions, cost_per_conversion,
  synced_at,
  unique (advertiser_id, campaign_id, stat_date)
)
```

Cron nuevo `/api/jobs/campaign-metrics` (sugerido: cada 30 min) que recorra los
advertisers mapeados en Hecom y haga upsert del día en curso. Sin esto no hay
tendencia, y sin tendencia el análisis es solo una foto.

### Fase 2 — Motor de alertas + entrega

- Extender `buildSignals()` (o un módulo hermano `lib/alerts/campaign-alerts.server.ts`)
  con las reglas de la §2, ahora con acceso al histórico.
- Tabla `campaign_alerts` con dedupe: no repetir la misma alerta de la misma
  campaña dentro de X horas.
- Entrega vía `createNotificationBestEffort()` + panel en Profit (§3.5).

### Fase 3 — Capa LLM (la parte “bot”)

Nueva función `analyzeCampaignsWithOpenAi(rows, context)` siguiendo el molde exacto
de `analyze-creative.server.ts` (mismo cliente, mismo parseo defensivo, prompt
versionado, fallback si falta la API key).

Regla de diseño importante: **el LLM no detecta, explica.** Las reglas
deterministas eligen qué campañas están en problemas; el modelo recibe solo esas
filas y devuelve el diagnóstico y la acción recomendada en lenguaje natural. Eso
baja tokens, evita números inventados y hace la alerta auditable.

---

## 3.5 Dónde se ve · cliente vs gerencia (cerrado 2026-09-17)

**Superficie principal: Profit.** Ahí viven las métricas de campaña; el bot no
abre otra pantalla para el día a día.

### Cliente (su Profit)

Ve **sus** rendimientos y alertas, en lenguaje claro:

- saldo quemándose rápido
- campaña que concentra gasto
- ROAS / CTR flojos (cuando haya datos)
- campanita in-app para no perderse lo crítico

No ve el score interno ni el razonamiento de crédito. Solo lo que le sirve para
operar campañas y recargar a tiempo.

### Gerencia (más detallado)

El mismo Profit **viendo como** el cliente, **más** una capa ops:

| Capa | Para qué |
|------|----------|
| Profit “viendo como” | mismo contexto que el cliente, para hablarle con datos |
| Panel / listado gerencia | todas las alertas críticas del día (quién quema saldo, quién está zombie) |
| Campanita / inbox ops | aviso temprano sin entrar cliente por cliente |

**Detalle extra que solo ve gerencia** (y alimenta el **score de crédito**):

- ritmo de quema vs lo que recarga (¿pide crédito porque opera mal o porque escala?)
- historial de alertas críticas (reincidencia)
- concentración de gasto / campañas que no convierten
- ratio “presupuesto adelantado / pagado” (casos tipo Ximena)
- estabilidad de ROAS y pacing en ventanas 7d / 30d

Idea: cuando gerencia evalúa dar o ampliar crédito, no mira solo “debe / no debe”.
Mira un **resumen de riesgo operativo** sacado del mismo bot: si el cliente quema
saldo sin control o tiene campañas sanas, el score sube o baja y la decisión de
crédito es más fácil y defendible.

```text
cliente  →  Profit: alertas de rendimiento + campanita
gerente  →  Profit (viendo como) + panel ops + score/crédito enriquecido
```

---

## 4. Decisiones

### Cerrado

- **Quién ve qué:** cliente en Profit (rendimiento); gerencia con más detalle y
  enlace al score de crédito (§3.5).
- **Superficie:** Profit + campanita in-app; panel ops para gerencia.

### Sigue abierto

- **Canal extra:** ¿WhatsApp / correo además de in-app? (MVP = solo in-app)
- **Umbrales:** los de la §2 son propuestas; ops debería calibrarlos.
- **Alcance del MVP:** ¿arrancamos solo con la alerta de saldo (no necesita
  historial y es la que pidió gerencia) o esperamos la Fase 1 completa?
- **Profundidad:** si el análisis debe hablar de creativos o audiencias, hay que
  agregar ingesta a nivel adgroup/ad.

---

## 5. Riesgos

| Riesgo | Mitigación |
|--------|-----------|
| Cuota de la API de TikTok con cron cada 30 min | reusar el patrón de concurrencia 3 y tope de advertisers de `campaign-performance.server.ts` |
| Alert fatigue | dedupe por campaña + ventana de silencio + severidad |
| ROAS por campaña es **prorrateado**, no atribuido | no redactar alertas que afirmen ingresos por campaña como si fueran reales |
| LLM inventando cifras | el modelo solo explica filas que ya pasaron por reglas; nunca calcula |
| Costo OpenAI | pre-filtro determinista; solo campañas marcadas entran al prompt |
| Cliente ve demasiado / se asusta | cliente = copy operativo; score y riesgo de crédito **solo gerencia** |
