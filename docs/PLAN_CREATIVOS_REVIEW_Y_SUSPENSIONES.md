# Plan: Creativos — rechazo / bajada de video (menos soporte)

**Estado:** realineado 2026-09-17 · **A1 implementada** (review ads en Creativos)  
**Pedido aclarado:** cuando TikTok **rechaza o baja un video/anuncio**, el cliente debe poder **ver el motivo y actuar solo en Creativos** — sin ir a soporte ni a Ads Manager para enterarse.

### A1 entregada (código)

| Pieza | Dónde |
|-------|--------|
| `GET /ad/review_info/` + `/ad/get/` | `lib/integrations/tiktok/ad-review.server.ts` |
| Sync batch published drafts | `lib/creatives/sync-ad-reviews.server.ts` |
| Cron cada 15 min | `/api/jobs/creative-ad-review` + `vercel.json` |
| Migración | `030_creative_ad_review.sql` |
| UI motivos + CTA subir corregido | `AgentProDraftsPanel.client.tsx` |

> **Nota:** la UI de **cuentas Suspendida** (Cuentas ads) es otro epic (caso B). Este doc prioriza el flujo de **publicación → review TikTok → rechazo del material**.

---

## 0. Aclaración (qué es y qué no es)

| Lo que el cliente suele decir | Qué es en realidad | Dónde se resuelve en Holistic |
|------------------------------|--------------------|-------------------------------|
| “Me suspendieron el video / no me deja publicar / rechazo” | **Anuncio o material rechazado en review** | **Creativos** (Agent Pro drafts) |
| “Se me suspendió la cuenta / no puedo recargar” | Advertiser `STATUS_LIMIT` / castigo de cuenta | Cuentas ads (ya hay ayuda parcial) |
| “No puedo crear cuenta nueva” | BM en risk (`unusual activity`) | WhatsApp / ops BM |

**Tu captura de Ads Manager** (“Editar anuncio → Rechazo → Motivos… + lista de videos”) = **caso creativo**, no cuenta.

**Producto en una frase:**  
*En Creativos ves si TikTok rechazó tu video, por qué, y qué hacer (editar / subir otro / reenviar) sin abrir ticket.*

---

## 1. Flujo objetivo (solo Creativos)

```
Subir video → score IA (policy_risks) → brief → Enviar a TikTok
        ↓
   draft published (ad_id, video_id guardados)
        ↓
   Cron / refresh: GET /ad/review_info/ + /ad/get/
        ↓
   ┌─────────────────────────────────────────┐
   │ Creativos → draft “Rechazado por TikTok” │
   │ · Motivos (reject_info[])                 │
   │ · Qué video/material afectó               │
   │ · CTA: Subir nuevo / Reintentar publish   │
   │ · (Opcional) Apelar si Smart+             │
   └─────────────────────────────────────────┘
        ↓
   Cliente actúa en la plataforma → no escribe a soporte
```

---

## 2. Qué hay hoy vs qué falta (Creativos)

| Pieza | Hoy | Falta |
|-------|-----|--------|
| Upload + análisis IA (`policy_risks`) | ✅ | Gate duro antes de publish (opcional) |
| Publish → `publish_result.ad_id` / `video_id` | ✅ | — |
| Polling review TikTok | ❌ | Cron + snapshot |
| Badge “Rechazado por TikTok” en drafts | ❌ | UI Agent Pro |
| Texto de motivos (como Ads Manager) | ❌ | Mostrar `reject_info` |
| Acción: subir otro creativo / re-publish | Parcial (nuevo upload) | Wire al draft rechazado |
| Preview phone | ❌ | Nice-to-have, no bloquea |

Archivos ancla:

- `lib/integrations/tiktok/creative-publish.server.ts` — crea ad + guarda IDs  
- `lib/creatives/drafts.server.ts` — `publish_result`  
- `features/creative-analyzer/components/AgentProDraftsPanel.client.tsx` — UI drafts  
- `docs/TIKTOK_CREATIVES.md` — flujo actual  

---

## 3. APIs TikTok (caso creativo)

| Endpoint | Para qué |
|----------|----------|
| `GET /open_api/v1.3/ad/review_info/` | `is_approved` + `reject_info[]` (motivos de rechazo del anuncio) |
| `GET /open_api/v1.3/ad/get/` | `secondary_status` (ej. problema de revisión / no entrega) |
| `GET /adgroup/review_info/` | Si el rechazo viene a nivel ad group |
| Smart+ `…/review_info/` + `…/appeal/` | Solo si algún día publicamos Smart+ |

Con los `ad_id` que ya guardamos al publicar, el cron puede preguntar el veredicto **sin** que el cliente abra Ads Manager.

**Límite resuelto (descubrir):** al abrir Creativos sincronizamos `/ad/get/` + `/ad/review_info/` de las cuentas del cliente y upsertamos rechazos de Ads Manager (badge “Desde Ads Manager”).

---

## 4. Qué puede hacer el cliente en Creativos (después del rechazo)

Sin soporte:

1. **Leer el motivo** en lenguaje claro (más el texto legal TikTok).  
2. **Subir un video nuevo** corregido (mismo flujo Agent Pro).  
3. **Reenviar** (publish de un draft nuevo / reintento).  
4. Ver qué **policy_risks** había predicho la IA vs el rechazo real (aprendizaje).  

Con soporte solo si:

- No hay motivo (`reject_info` vacío) y no entiende qué cambiar.  
- Quiere apelar y el flujo no es self-serve (cuenta / BM / Smart+).  

---

## 5. Diseño técnico (implementación próxima)

### 5.1 Backend

```
lib/integrations/tiktok/ad-review.server.ts
  fetchAdReviewInfo({ advertiserId, adIds, lang: "es" })

Cron POST /api/jobs/creative-ad-review  (+ CRON_SECRET)
  → drafts status = published con publish_result.ad_id
  → upsert review en creative_publish_drafts

Columnas / jsonb (migración):
  review_status     text   -- pending | approved | rejected | unknown
  reject_reasons    jsonb  -- reject_info[]
  secondary_status  text
  review_checked_at timestamptz
```

### 5.2 Tipos UI

Extender `CreativeDraftListItem`:

- `tiktokReviewStatus`
- `tiktokRejectReasons: string[]`
- `tiktokSecondaryStatus`

### 5.3 UI Creativos (`AgentProDraftsPanel`)

Para drafts `published` + `review_status=rejected`:

```
[Rechazado por TikTok]
Motivos:
 · …
[ Subir creativo corregido ]  [ Ver brief ]
```

Copy: *“TikTok bajó / rechazó este anuncio. Corregí el video y volvé a enviarlo desde Creativos. No hace falta escribir a soporte.”*

### 5.4 Antes del publish (prevención)

Si `compliance_score` bajo o `policy_risks` graves → confirmar o bloquear “Enviar a TikTok”.  
Menos rechazos = menos tickets.

---

## 6. Fases (reordenadas)

| Fase | Entrega | Prioridad |
|------|---------|-----------|
| **A0** | Realineamiento (doc) | ✅ |
| **A1** | Cron `/ad/review_info/` + campos en drafts + badge/motivos en Creativos | ✅ |
| **A2** | CTA “Subir corregido” con `parent_draft_id` + prefill cuenta | ✅ |
| **A3** | Gate publish por compliance / policy_risks | Media |
| **B*** | Cuenta suspendida (parcial en Cuentas ads) | Secundario |

\*La UI de cuentas Suspendida **no se revierte**; queda como mejora aparte. El foco de producto pedido es **A1–A3**.

---

## 7. Relación con “cuentas suspendidas” (para no mezclar)

| | Creativo rechazado | Cuenta suspendida |
|--|--------------------|-------------------|
| ¿La cuenta sigue viva? | Sí | No (castigada) |
| ¿Se puede asignar saldo? | Sí | No |
| ¿Dónde mirar? | **Creativos** | Cuentas ads |
| ¿API principal? | `/ad/review_info/` | `/advertiser/info/` + `rejection_reason` |
| ¿Self-serve full? | Sí (subir otro video) | Parcial (apelar en Ads Manager) |

Si el cliente dice “me suspendieron” en el chat, el bot debería preguntar:  
*¿Te rechazaron un video/anuncio, o la cuenta entera no deja pautar?*  
→ Creativos vs Cuentas ads.

---

## 8. Métricas de éxito (caso creativo)

- % drafts published con `review_status` conocido a las 24 h  
- ↓ Tickets “no me aprueban el video / me lo bajaron”  
- ↑ Re-uploads desde Creativos tras un rechazo (sin ticket)  
- Correlación IA `policy_risks` vs `reject_info` real  

---

## 9. Decisión

**Siguiente implementación:** Fase **A1** (review de ads en Creativos), no más trabajo de cuentas suspendidas salvo bugs.

Cuando digas **dale** a A1, se implementa el cron + UI de motivos en `AgentProDraftsPanel`.
