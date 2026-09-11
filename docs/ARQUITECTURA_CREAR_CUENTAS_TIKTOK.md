# Arquitectura: crear cuentas TikTok desde Ads Holistic

**Estado:** investigación + prueba real OK · **producto aún no implementado**  
**Fecha:** 2026-09-10 · **actualizado enlace 2026-09-11**  
**Contexto:** mismo tipo de cuentas que se ven en Pagos → Asignar (ej. `Jair Santiago 200.0 USD - Agencia` · BM 200).

> **Estudio ampliado (cliente + BM10/30/200, probes 2026-09-11):**  
> ver [`ESTUDIO_CREAR_CUENTAS_CLIENTE_BM10_30_200.md`](./ESTUDIO_CREAR_CUENTAS_CLIENTE_BM10_30_200.md).

---

## 1. Veredicto

**Sí se puede.** No era un límite de TikTok ni de permisos: Ads Holistic simplemente nunca llamó al endpoint de create.

Ecomdy (partner TikTok) hace lo mismo vía **Business Center API** bajo un Agency BC: onboarding → create advertiser → fondeo.

### Prueba real (Holistic, mismo día)

| Campo | Valor |
|--------|--------|
| Endpoint | `POST /open_api/v1.3/bc/advertiser/create/` |
| BM | **BM200** (`7575005779271614480`) |
| Resultado | `code: 0` |
| Advertiser creado | `7684026882068758548` |
| Nombre | `Holistic API Probe …` (se puede desactivar con `/bc/advertiser/disable/`) |
| Qual reutilizada | PROALBA GROUP EIRL · `qualification_id` VERIFIED |

El token agency ya es **ADMIN** en BM10 / BM30 / BM200. Las fallas previas del probe fueron de **validación** (campos), no de “forbidden”.

**Idea fina:** el create debe funcionar en **todos los BM operativos** (10, 30 y 200), cada uno con su perfil legal / qualification / modelo de fondeo. MVP puede empezar por BM200, pero la arquitectura no debe quedar atada a un solo BM.

---

## 2. Qué son esas cuentas de la UI

No son un tipo especial de Holistic. Son advertisers **AUCTION** creados bajo el BC de Holistic, con naming ops:

```text
{Nombre corto del cliente} {bucket}.0 USD - Agencia
```

Ejemplos:

- `Jair Santiago 200.0 USD - Agencia` → BM 200 (cash)
- `… 30.0 USD - Agencia` → BM 30 (crédito SHARED)
- `… 10.0 USD - Agencia` → BM 10 (crédito SHARED)

El número en el nombre alinea con **`bm_bucket` / fee de paquete**, no con el saldo ledger.

**Ownership real = `advertiser_id` en Hecom**, nunca por nombre (evita leaks entre clientes homónimos).

---

## 3. Proceso correcto = transacción de 3 stores

Si solo creás en TikTok y no mapeás Hecom, la cuenta **existe en Manager pero no aparece en Asignar** para ese cliente.

| # | Store | Qué debe quedar | Si falta |
|---|--------|-----------------|----------|
| 1 | **TikTok BC** | `advertiser_id` real bajo el BM elegido | No hay cuenta ni saldo TikTok |
| 2 | **Hecom CRM** | Fila en `cliente_tiktok_cuentas` (`advertiser_id`, `bm_bucket`, `sync_enabled=true`, nombre) | Pagos no sabe de quién es → no lista en Asignar |
| 3 | **Holistic `ad_accounts`** | Fila en la **org del cliente** + `metadata.hecom_cliente_id` | Ledger / Asignar no tienen dónde postear |

### Secuencia recomendada

```text
1. Staff elige cliente Hecom + BM (10 | 30 | 200)
2. Sistema arma nombre: "{tokens} {bucket}.0 USD - Agencia"
3. POST /bc/advertiser/create/  (perfil del BM: bc_id, company, qualification_id, industry, PE)
4. INSERT Hecom.cliente_tiktok_cuentas
   (+ opcional: clientes.tiktok_advertiser_id si estaba vacío)
5. syncApprovedAdAccountsForCliente({ forceRefresh: true })
6. ensureAdvertisersInOrganizationForAllocation({ org wallet del cliente, … })
7. Cuenta aparece en Pagos → Asignar
8. Fondeo = flujo Asignar ya existente (cash BM200 o presupuesto BM10/30)
9. Audit: request_id TikTok, advertiser_id, bm, actor
```

### Funciones ya existentes a reutilizar

- `syncApprovedAdAccountsForCliente` — `lib/hecom/sync-approved-ad-accounts.server.ts`
- `ensureAdvertisersInOrganizationForAllocation` — `services/payments.service.ts`
- Allocate cash vs cupo — `lib/payments/allocate-with-tiktok.server.ts`
- Mapa BM → BC — `lib/hecom/bm-bucket.shared.ts`

### Lo que hoy **no** existe (hay que construir)

- Wrapper `POST /bc/advertiser/create/` en código de producto
- Write runtime a `cliente_tiktok_cuentas` (hoy solo scripts de import)
- API staff `POST /api/ad-accounts/tiktok/create`
- UI “Crear cuenta TikTok” (el modal actual de Cuentas ads es **demo/manual Holistic**, no TikTok)

---

## 4. Perfiles por BM (todos los BM)

| BM | BC ID | Tipo BC | Razón social / qual | Fondeo post-create | En arquitectura |
|----|-------|---------|---------------------|--------------------|-----------------|
| **200** | `7575005779271614480` | AGENCY | PROALBA GROUP EIRL (VERIFIED) | Cash `POST /bc/transfer/` + payment portfolio | **Obligatorio** · ya probado |
| **30** | `7564426417577148433` | AGENCY | HOLISTIC BUSINESS S.A.C. (VERIFIED) | Cupo SHARED `POST /advertiser/update/` | **Obligatorio** · mismo path Agency |
| **10** | `7652451146933698576` | DIRECT | PANAMERICANA (qual propia) | Cupo SHARED + preflight portfolio | **Obligatorio en diseño** · smoke DIRECT antes de UI |

### Reglas

- **No reutilizar** `qualification_id` / `company` entre BMs (riesgo reject / compliance).
- BM10 DIRECT: solo `type: AUCTION`; no mandar `qualification_info` como si fuera Agency sin validar docs TikTok.
- `budget_info` **no** es el camino principal en create: el cupo SHARED se sube después con Asignar (como hoy).
- Config sugerida (env o tabla `tiktok_bc_create_profiles`):

```text
bm_bucket, bc_id, bc_type, qualification_id, company_legal_name,
default_industry, default_timezone=America/Lima, registered_area=PE,
promotion_link?
```

Payload mínimo que ya funcionó (BM200):

```json
{
  "bc_id": "7575005779271614480",
  "advertiser_info": {
    "name": "… 200.0 USD - Agencia",
    "currency": "USD",
    "timezone": "America/Lima",
    "type": "AUCTION"
  },
  "customer_info": {
    "company": "PROALBA GROUP EIRL",
    "industry": 291406,
    "registered_area": "PE"
  },
  "qualification_info": {
    "qualification_id": "<PROALBA VERIFIED>"
  }
}
```

---

## 5. Quién puede crear

| Rol | MVP | v2 |
|-----|-----|-----|
| Staff / gerente Holistic | Sí | Sí |
| Cliente final | No (FAQ actual: no crea advertisers desde Holistic) | Cola “Solicitar cuenta” → approve staff |

Permiso: **no** reutilizar a ciegas `adAccounts:create` del modal demo; gate explícito staff (`isStaff` / funding caps).

---

## 6. Riesgos (diseñar desde el día 1)

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| Create TikTok sin map Hecom | Cuenta huérfana; no sale en Asignar | Transacción create → Hecom → sync/ensure |
| Qual / company de otro BM | Reject o compliance | Perfil estricto por `bm_bucket` |
| Org gerente ≠ org cliente | Asignar vacío | `ensure…` en org wallet del cliente |
| Self-serve sin control | Cuotas BC / basura | MVP solo staff |
| Nombres duplicados | Confusión ops | Ownership por ID; sufijo `#2` si hace falta |
| Cuotas BC TikTok | Create falla | Superficie error; monitor; disable huérfanas |
| BM10 portfolio en $0 | Cliente cree que puede gastar | Preflight portfolio antes de prometer |
| Cache sync 5 min | No aparece al toque | `forceRefresh: true` post-create |

---

## 7. MVP vs v2

### MVP (implementar primero)

1. Staff-only en panel (cliente activo).
2. Selector BM: **200 y 30** (Agency path idéntico); UI puede mostrar 10 disabled con “próximamente” **o** incluir 10 solo tras smoke.
3. Auto-nombre `{Nombre} {BM}.0 USD - Agencia`.
4. Create TikTok + INSERT Hecom + sync/ensure.
5. Aparece en Pagos → Asignar; fondeo = flujo actual.
6. Audit log + mensaje claro si TikTok rechaza.

> Nota de producto: la **idea fina** es “también en los demás BM”. El MVP no debe hardcodear solo 200 en la arquitectura/config; como mínimo BM200+BM30 en la primera entrega usable, BM10 en cuanto pase smoke DIRECT.

### v2

- BM10 DIRECT completo + preflight portfolio.
- Cliente: “Solicitar cuenta” → approve.
- Wizard industry / website / promotion_link.
- Dashboard de cuotas BC + disable de probes/huérfanas.
- Retirar o esconder `CreateAdAccountModal` demo para usuarios Hecom-scoped.

---

## 8. Mapa de código (referencia)

| Concern | Path |
|---------|------|
| BM ↔ BC | `lib/hecom/bm-bucket.shared.ts` |
| Match nombre (solo legacy/ops) | `lib/hecom/advertiser-match.ts` |
| Hecom read cuentas | `lib/hecom/clientes.server.ts` → `loadTiktokAccountsByClient` |
| Sync → `ad_accounts` | `lib/hecom/sync-approved-ad-accounts.server.ts` |
| Mirror org Pagos | `services/payments.service.ts` → `ensureAdvertisersInOrganizationForAllocation` |
| Pagos wiring | `app/(dashboard)/payments/page.tsx`, `PaymentsGatewayPanel.tsx` |
| Funding docs | `docs/TIKTOK_BC_FUNDING.md` |
| Create demo (NO TikTok) | `CreateAdAccountModal.client.tsx`, `createAdAccount` |
| Import Hecom (scripts) | `scripts/import-hecom-tiktok-safe.mjs` |

**Gap actual:** cero callers de producción a `/bc/advertiser/create/` en el repo.

Módulos sugeridos al implementar:

```text
lib/integrations/tiktok/bc-advertiser-create.server.ts
lib/hecom/link-tiktok-cuenta.server.ts
app/api/ad-accounts/tiktok/create/route.ts
```

---

## 9. Canvas / handoff

- Canvas IDE: `tiktok-account-create-architecture.canvas.tsx` (misma arquitectura visual).
- Este MD es la fuente durable para retomar cuando terminen las correcciones en curso.

---

## 10. Próximo paso cuando vuelvan

1. Confirmar si MVP shippea **BM200+BM30** juntos o BM200-only con 30/10 en config lista.
2. Implementar create staff + Hecom write + sync.
3. Smoke BM30 (Agency) y BM10 (DIRECT) antes de abrirlos en UI.
4. Desactivar/limpiar advertiser probe `7684026882068758548` si sigue en BM200.
