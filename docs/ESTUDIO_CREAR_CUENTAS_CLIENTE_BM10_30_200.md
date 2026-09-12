# Estudio: que cada cliente pueda crear cuentas TikTok (BM 10 · 30 · 200)

**Tipo:** solo estudio / solución propuesta · **sin implementar**  
**Fecha:** 2026-09-11  
**Complementa:** `docs/ARQUITECTURA_CREAR_CUENTAS_TIKTOK.md`  
**Alcance:** productizar create desde Ads Holistic para **todos los BM operativos**, con camino a **self-serve del cliente**.

---

## 0. Resumen ejecutivo

| Pregunta | Respuesta |
|----------|-----------|
| ¿Se puede crear como Ecomdy? | **Sí.** Endpoint oficial `POST /bc/advertiser/create/`. |
| ¿Holistic lo hace hoy? | **No.** Solo linkea IDs ya creados a mano + mapa Hecom. |
| ¿BM200? | **Probado live** (2026-09-10) → advertiser `7684026882068758548`. |
| ¿BM30? | **Mismo path Agency.** Probe 2026-09-11: payload + qual aceptados; solo falló “Industry invalid” (validación, no permiso). Listo para smoke real. |
| ¿BM10? | **DIRECT distinto.** No admite `qualification_info`. Probe 2026-09-11: **BC al tope de cuota** (“maximum number of advertiser accounts”). Hay que liberar cupo o pedir aumento a TikTok AM **antes** de productizar BM10. |
| ¿Cliente crea hoy? | **No.** FAQ + Cuentas ads = solo lectura. |
| Solución | Transacción **3 stores** (TikTok → Hecom → Holistic org) + perfiles por BM + fases staff → cliente. |

---

## 1. Qué quiere el producto

Hoy el cliente (ej. Jair) ve en Pagos cuentas tipo:

```text
Jair Santiago 200.0 USD - Agencia · BM 200
```

Quiere poder **crear más** (también en BM 30 y BM 10) sin que ops las arme a mano en Manager.

Ecomdy lo resuelve con Business Center API bajo Agency BC + onboarding SaaS. Holistic ya tiene token **ADMIN** en los tres BMs y fondeo post-create (Asignar). Falta el **create + map Hecom + UI**.

---

## 2. Inventario live de Business Centers (2026-09-11)

Fuente: `GET /bc/get/` + `GET /bc/advertiser/qualification/get/` + `GET /payment_portfolio/get/` con `TIKTOK_ACCESS_TOKEN`.

| BM | BC ID | Tipo | Org | Razón social (BC) | Área | Timezone | Qual VERIFIED | Portfolio |
|----|-------|------|-----|-------------------|------|----------|---------------|-----------|
| **200** | `7575005779271614480` | **AGENCY** | ENTERPRISE | PROALBA GROUP E.I.R.L. | PE | America/Lima | `7577449402876198929` · PROALBA GROUP EIRL · 271+ ads | NON_SHARED |
| **30** | `7564426417577148433` | **AGENCY** | ENTERPRISE | HOLISTIC BUSINESS S.A.C | PE | America/Lima | `7566334805429485569` · HOLISTIC BUSINESS S.A.C. · 300 ads | SHARED |
| **10** | `7652451146933698576` | **DIRECT** | STANDARD | PANAMERICANA OUTSOURCING S A SUCURSAL MEDELLIN | **CO** | America/Bogota | **Ninguna** en `/qualification/get/` | SHARED |

Rol token: **ADMIN** en los tres · `verification_status: VERIFIED` · status ENABLE.

### Probes create (sin crear cuenta real)

| Prueba | Resultado | Interpretación |
|--------|-----------|----------------|
| BM200 + qual + industry inválida | `40002 Industry invalid` | Path OK; crearía con industry válida (ya demostrado). |
| BM30 + qual + industry inválida | `40002 Industry invalid` | **Mismo path Agency que BM200.** Smoke real pendiente. |
| BM10 sin `qualification_info` | `40002 The maximum number of advertiser accounts has been created…` | API **llega** al create; **bloqueado por cuota BC**. |
| BM10 + `qualification_info.promotion_link` | `40002 … Only allowed for AGENCY and SELF_SERVICE_AGENCY` | **No mandar** `qualification_info` en DIRECT. |

---

## 3. Perfiles de create por BM (solución técnica)

### 3.1 BM200 — Agency (cash) · listo

```json
{
  "bc_id": "7575005779271614480",
  "advertiser_info": {
    "name": "{Cliente} 200.0 USD - Agencia",
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
    "qualification_id": "7577449402876198929"
  }
}
```

- Post-create fondeo: `POST /bc/transfer/` + payment portfolio NON_SHARED.  
- UI Asignar: “Saldo TikTok” (cash).

### 3.2 BM30 — Agency (crédito SHARED) · listo para smoke

Misma forma que BM200, cambiando perfil:

| Campo | Valor |
|-------|--------|
| `bc_id` | `7564426417577148433` |
| `company` | `HOLISTIC BUSINESS S.A.C.` (match qual) |
| `qualification_id` | `7566334805429485569` |
| `timezone` | `America/Lima` |
| `registered_area` | `PE` |
| Nombre | `{Cliente} 30.0 USD - Agencia` |

- Post-create fondeo: `POST /advertiser/update/` INCREMENTAL_UPDATE (cupo).  
- UI Asignar: “Cupo presupuesto”.  
- **Antes de UI:** 1 create real de prueba + disable.

### 3.3 BM10 — DIRECT (crédito SHARED) · bloqueado por cuota + reglas distintas

| Campo | Valor / regla |
|-------|----------------|
| `bc_id` | `7652451146933698576` |
| `type` | Solo `AUCTION` |
| `qualification_info` | **Omitir siempre** (TikTok lo rechaza en DIRECT) |
| `company` | Alinear a PANAMERICANA / lo que acepte TikTok en smoke |
| `timezone` | BC usa `America/Bogota` — **confirmar** si advertiser debe heredar Bogota o Lima |
| `registered_area` | BC = **CO** — confirmar en smoke (no asumir PE) |
| Nombre | `{Cliente} 10.0 USD - Agencia` |

**Gate duro de producto:** hasta que TikTok AM suba cuota o se desactiven advertisers viejos (`/bc/advertiser/disable/`), **no abrir BM10 en UI**.

Post-create: cupo SHARED como BM30; preflight portfolio (hoy a menudo `$0` usable → no prometer gasto al crear).

### 3.4 Config sugerida (`tiktok_bc_create_profiles`)

```text
bm_bucket | bc_id | bc_type | company_legal_name | qualification_id | timezone | registered_area | funding_mode | enabled_in_ui
200 | …4480 | AGENCY | PROALBA GROUP EIRL | 7577449402876198929 | America/Lima | PE | cash_transfer | true (post-MVP staff)
30  | …8433 | AGENCY | HOLISTIC BUSINESS S.A.C. | 7566334805429485569 | America/Lima | PE | shared_budget | true tras smoke
10  | …8576 | DIRECT | PANAMERICANA… | null | America/Bogota? | CO? | shared_budget | false hasta cuota + smoke
```

**Nunca** reutilizar `qualification_id` / `company` entre BMs.

---

## 4. Transacción de 3 stores (igual para los 3 BM)

Sin el paso Hecom, la cuenta existe en Manager pero **no aparece en Asignar**.

```text
1. Actor elige cliente Hecom + BM (10|30|200)  [policy: quién puede]
2. Nombre auto: "{tokens} {bucket}.0 USD - Agencia"
3. Load perfil BM → POST /bc/advertiser/create/
4. INSERT Hecom.cliente_tiktok_cuentas
     (client_id, advertiser_id, advertiser_name, bm_bucket, fee≈bucket, sync_enabled=true)
   + opcional: clientes.tiktok_advertiser_id si vacío
5. syncApprovedAdAccountsForCliente({ forceRefresh: true })
6. ensureAdvertisersInOrganizationForAllocation({
     organizationId: resolveOrganizationIdForHecomCliente(cliente),
     …
   })
7. Aparece en Pagos → Asignar
8. Fondeo = Asignar existente (cash 200 / cupo 10·30)
9. Audit: request_id, advertiser_id, bm, actor_user_id, source=staff|cliente_request
```

### Código a reutilizar

| Pieza | Path |
|-------|------|
| BM ↔ BC | `lib/hecom/bm-bucket.shared.ts` |
| Sync | `lib/hecom/sync-approved-ad-accounts.server.ts` |
| Mirror org | `services/payments.service.ts` → `ensureAdvertisersInOrganizationForAllocation` |
| Org cliente | `lib/hecom/resolve-cliente-organization.server.ts` |
| Allocate | `lib/payments/allocate-with-tiktok.server.ts` |
| Hecom read | `lib/hecom/clientes.server.ts` → `loadTiktokAccountsByClient` |
| Import write (solo scripts hoy) | `scripts/import-hecom-tiktok-safe.mjs` |

### Código a construir (aún no existe en producto)

| Pieza | Sugerencia |
|-------|------------|
| Create TikTok | `lib/integrations/tiktok/bc-advertiser-create.server.ts` |
| Link Hecom | `lib/hecom/link-tiktok-cuenta.server.ts` |
| API | `POST /api/ad-accounts/tiktok/create` |
| UI | Pagos empty + Cuentas ads (no el modal demo) |
| Perfiles BM | env / tabla `tiktok_bc_create_profiles` |
| (v2) Cola solicitud | `tiktok_account_create_requests` |

**No reutilizar** `adAccounts:create` / `CreateAdAccountModal` (solo fila Holistic demo).

---

## 5. Quién puede crear: política de producto

### Hoy (realidad)

| Actor | Crear TikTok | Cuentas ads |
|-------|--------------|-------------|
| Cliente | No (FAQ `solo-lectura`) | Read-only Hecom-scoped |
| Gerente / staff | No en producto (sí a mano en Manager) | Mapea IDs + recarga BM |

Refs: `features/support/mocks/support.mock.ts`, `app/(dashboard)/ad-accounts/page.tsx` (`hideCreate`).

### Solución por fases

#### Fase A — Staff create (MVP implementación)

- Solo `isStaff` / gerente Holistic (cookie cliente activo).
- BM picker: **200 + 30** (30 tras 1 smoke).
- BM10: oculto o “Sin cupo TikTok” hasta liberar cuota.
- Auto-nombre + perfiles fijos.
- Resultado: cuenta en Asignar del cliente visto.

#### Fase B — Cliente solicita (self-serve controlado)

- Cliente: botón **“Solicitar cuenta TikTok”** (elige BM permitido para su paquete).
- Crea fila `pending` → notifica gerentes (email/WhatsApp).
- Staff aprueba → ejecuta misma transacción 3 stores.
- FAQ se actualiza solo al shippear.

#### Fase C — Cliente create directo (opcional, más riesgo)

- Create inmediato con rate limit (ej. N/día/cliente).
- Solo BMs `enabled_in_ui` + cuota OK.
- Cap por BC; errores TikTok claros (“sin cupo BM10”).
- Requiere cuotas sanas y monitoreo orphans.

**Recomendación:** A → B. Evitar C hasta tener cuotas y abuse controls.

### Default de BM

1. Si el cliente ya tiene cuentas: sugerir el **mismo `bm_bucket` / fee** dominante.  
2. Si no: default **BM200** (probado) o el paquete comercial del cliente.  
3. No default BM10 mientras haya cuota llena / portfolio $0.

---

## 5A. Seguridad — “¿hay que dar Admin al cliente?” (respuesta al supervisor)

**Fecha nota:** 2026-09-12  
**Miedo:** *“Para crear cuentas hay que dar permiso Admin y eso es peligroso.”*  
**Veredicto:** el miedo es **parcialmente cierto sobre TikTok**, pero **falso sobre el cliente**. Admin lo necesita **Holistic (nuestro token / usuarios ops)**, **nunca** el anunciante final.

### Qué dice TikTok (oficial)

| Hecho | Fuente |
|-------|--------|
| Solo un **Admin del Business Center** puede **crear** ad accounts en ese BC | [Roles BC TikTok](https://ads.tiktok.com/resources/help/article/about-business-center-roles-and-permissions) · Create Ad Account = Admin Yes / Standard No |
| Una agencia puede **crear advertisers bajo su Agency BC** a nombre del cliente; el BC **dueño** es el de la agencia | [Create ad accounts in BC — Scenario agency](https://ads.tiktok.com/resources/help/article/create-ad-accounts-in-business-center) |
| Después se **asignan** miembros/partners al advertiser con rol acotado (Operator / Analyst), no hay que hacerlos Admin del BC | Misma guía TikTok |

Traducción: **sí hace falta Admin… pero del BC de Holistic**, que **ya tenemos** (`TIKTOK_ACCESS_TOKEN` = ADMIN en BM10/30/200). Eso no implica invitar al cliente como Admin.

### Modelo peligroso (el que el supervisor imagina) ❌

```text
Cliente → se une al BM Holistic como ADMIN
       → crea cuentas a mano / con sus permisos
```

Riesgos reales: ve **todas** las cuentas del BM, puede invitar gente, mover assets, tocar finance, filtrar datos de otros clientes. **Holistic no debe hacer esto nunca.**

### Modelo seguro Holistic (igual que agencia TikTok + lo que ya operamos) ✅

```text
Cliente (solo sesión Ads Holistic)
   → botón "Crear / Solicitar cuenta"
   → API Holistic (auth staff o cola + approve)
   → servidor usa token AGENCY de Holistic (ADMIN en NUESTRO BM)
   → POST /bc/advertiser/create/ bajo BC Holistic
   → mapa Hecom (solo ese advertiser_id ↔ ese cliente)
   → aparece en Asignar de ESA org
```

| Actor | ¿Admin del BM Holistic? | Qué puede hacer |
|-------|-------------------------|-----------------|
| Token / ops Holistic | **Sí** (ya hoy) | Create, fondeo, sync |
| Cliente en Holistic SaaS | **No** | Pedir/crear vía UI; ver **solo** sus advertisers mapeados |
| Cliente en TikTok Ads Manager | **No** (default) | Nada, o a lo sumo **Operator/Analyst en 1 advertiser** si ops lo invita a propósito |

El create **no requiere** OAuth del cliente al BM. El cliente **no** “acepta permisos Admin” sobre nuestro BC.

### Cómo lo hace Ecomdy (lo público, sin magia)

Fuentes: [help Ecomdy — create agency ad account](https://ecomdymedia.freshdesk.com/support/solutions/articles/72000625879-to-create-tiktok-agency-ad-account), [ecomdymedia.com/tiktok-ads](https://ecomdymedia.com/tiktok-ads).

1. Cliente se registra y **recarga wallet Ecomdy** (igual que cartera Holistic).  
2. En UI Ecomdy el cliente dispara **create ad account**.  
3. Por detrás es el **mismo endpoint** de agencia (`/bc/advertiser/create/`) u onboarding partner — **no** publican “haz Admin al cliente en nuestro BM”.  
4. Su help también muestra un flujo **“Connect your TikTok Business Account”** (OAuth): ahí el cliente autoriza la **app Ecomdy** sobre **su** TikTok, no al revés. Eso es **otro** producto (vincular BC del cliente).  

Para el caso “cuenta agency tipo `{Nombre} 200.0 USD - Agencia`” (lo que vendemos en Holistic), el patrón correcto es el **agency-owned**: cuenta nace en **nuestro** BM; el cliente opera desde el SaaS.

### Controles que debemos exigir en diseño (para el supervisor)

1. **Nunca** `bc/member/invite` con rol Admin al email del cliente.  
2. Create solo con **token server-side** (env Vercel); cero Access-Token en browser.  
3. API: solo staff (Fase A) o cola + approve (Fase B); rate limit por cliente.  
4. Ownership solo por `advertiser_id` en Hecom (sin listar todo el BM al cliente).  
5. Audit: `actor_user_id`, `request_id` TikTok, `bm_bucket`, `cliente_id`.  
6. Si el cliente pide Ads Manager: invitar **Standard/Operator solo a ese advertiser**, no al BC.  
7. BM nuevos (ej. **BM 300** cuando den acceso): mismo patrón — token ADMIN de Holistic en ese BC; cliente sigue sin Admin.

### Frase corta para el supervisor

> “TikTok exige Admin para crear cuentas, pero ese Admin es el de **nuestro** Business Center (token que ya usamos para Asignar). El cliente **nunca** se hace Admin del BM: solo usa Ads Holistic; nosotros creamos la cuenta bajo el BM de la agencia y se la mapeamos. Dar Admin al cliente sí sería peligroso — y **no** es el diseño.”

### BM 300 (activo — Asignar)

Ver doc dedicado: [`BM300_ASIGNAR.md`](./BM300_ASIGNAR.md).

| Campo | Valor |
|-------|--------|
| BC ID | `7680955666005196801` |
| Nombre | Bm Enterprise 300.0 USD |
| Fondeo | Cash NON_SHARED (como BM200) |
| Prioridad | Asignar / map Hecom antes que create |

Cuando den el BC / token de **BM 300** (TQ): sumar fila a `HECOM_BM_BUCKET_TO_BC` + perfil create (tipo AGENCY/DIRECT, qual, área) igual que 10/30/200. La seguridad **no cambia**: Admin queda en el token Holistic de ese BM.

---

## 6. UX propuesta (sin wireframes)

### Staff (Fase A)

1. Seleccionar cliente (rail actual).  
2. Pagos → Asignar (vacío o “+”) **o** Cuentas ads → **Crear cuenta TikTok**.  
3. Modal: BM (200/30[/10]) · preview nombre · confirmar.  
4. Spinner → toast “Lista en Asignar” · refresh.

### Cliente (Fase B)

1. Misma pantalla, CTA **Solicitar**.  
2. Elige BM permitido · opcional nota.  
3. Estado “En revisión” hasta approve staff.  
4. Email/push cuando esté lista.

### Empty state Pagos

Hoy: “No hay cuentas…”.  
Mejor: CTA create/solicitar según rol.

---

## 7. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| Create TikTok sin Hecom | Huérfana; no sale en Asignar | Transacción atómica + compensación disable |
| Qual/company cruzados | Reject / compliance | Perfil estricto por BM |
| Org gerente ≠ org cliente | Asignar vacío | Siempre `resolveOrganizationIdForHecomCliente` |
| BM10 cuota llena | Create falla | UI disabled + ops disable viejos / AM TikTok |
| BM10 DIRECT mal payload | Errors confusos | Omitir `qualification_info`; smoke CO/Bogota |
| Self-serve abuse | Cuotas / spam | Fase B approve; rate limits |
| Invitar cliente como Admin del BM | Leak multi-cliente / finance | **Prohibido por diseño** — ver §5A; solo Operator en 1 advertiser si hace falta |
| Portfolio $0 BM10/30 | Cliente cree que puede gastar | Copy: “Crear ≠ fondear”; Asignar después |
| `adAccounts:create` demo | Cuentas falsas | Gate nuevo; hide demo en Hecom scope |
| Cache sync 5 min | No aparece al toque | `forceRefresh: true` |
| Homónimos | Leak cross-cliente | Ownership solo por `advertiser_id` |

---

## 8. Checklist antes de codear

### Obligatorios

- [ ] Smoke **BM30** create real + map Hecom + Asignar + disable probe.  
- [ ] Confirmar industry `291406` (u otra) en BM30.  
- [ ] Decidir ship: BM200-only staff vs BM200+BM30 juntos.  
- [ ] Diseñar write runtime `cliente_tiktok_cuentas` (columnas = import script).  
- [ ] Gate API solo staff (Fase A).

### BM10 (bloqueantes)

- [ ] Liberar cuota BC10 (disable ads inactivos o AM TikTok).  
- [ ] Smoke create **sin** `qualification_info`.  
- [ ] Confirmar `registered_area` (CO vs PE) y timezone (Bogota vs Lima).  
- [ ] Preflight portfolio usable antes de prometer Asignar.  
- [ ] Solo entonces `enabled_in_ui=true` para BM10.

### Cliente self-serve

- [ ] Tabla/cola de solicitudes + notify gerentes.  
- [ ] Actualizar FAQ `solo-lectura` / `ver-cuentas`.  
- [ ] Límites N cuentas / cliente / BM.

### Limpieza

- [ ] Disable probe BM200 `7684026882068758548` si sigue activo.

---

## 9. Roadmap de solución (orden)

```text
1. Config perfiles BM200 + BM30 (+ BM10 disabled)
2. bc-advertiser-create.server.ts + link-tiktok-cuenta.server.ts
3. POST /api/ad-accounts/tiktok/create (staff)
4. UI staff en Pagos / Cuentas ads
5. Smoke BM30 → enable en picker
6. Ops: liberar cuota BM10 → smoke DIRECT → enable
7. Fase B: Solicitar cuenta (cliente) + approve
8. (Opcional) Fase C create directo + quotas dashboard
```

---

## 10. Open questions (producto / TikTok)

1. ¿Default comercial del cliente fija el BM (fee 10/30/200) o elige libre?  
2. ¿BM30 se shipea junto con BM200 en el primer PR staff?  
3. ¿Quién baja cuota BM10 (ops Holistic vs AM TikTok)?  
4. ¿Timezone/advertiser BM10 = Bogota del BC o Lima Holistic?  
5. ¿Cliente puede tener cuentas en **varios** BM a la vez? (hoy sí vía mapa multi-cuenta.)  
6. ¿Fee Hecom al crear = número del bucket siempre?  
7. ¿Notificar al cliente cuando staff le crea la cuenta?  
8. ¿Reusar email `[Acción]` a gerentes en solicitudes Fase B?

---

## 11. Referencias

| Doc / código | Uso |
|--------------|-----|
| `docs/ARQUITECTURA_CREAR_CUENTAS_TIKTOK.md` | Arquitectura base + payload BM200 |
| `docs/TIKTOK_BC_FUNDING.md` | Cash vs SHARED post-create |
| `lib/hecom/bm-bucket.shared.ts` | IDs BM |
| `scripts/_tmp-study-bm-create.mjs` | Probes estudio 2026-09-11 (no create real) |
| TikTok docs | `POST /bc/advertiser/create/` (Marketing API) |
| Case Ecomdy | Agency BC + BC API onboarding |

---

## 12. Conclusión

**Sí se puede en 10, 30 y 200**, pero no con el mismo payload:

- **200 y 30:** Agency + `qualification_id` propio · 200 ya OK · 30 listo para smoke.  
- **10:** DIRECT · sin qual object · **hoy sin cupo de advertisers** → ops/TikTok primero.  
- **Cliente:** no create directo de entrada; **staff create → solicitud con approve → (opcional) self-serve**.  
- **Siempre:** TikTok + Hecom map + sync org cliente, o no aparece en Asignar.

Cuando vuelvan a implementar, partir de este MD + smoke BM30; BM10 solo tras liberar cuota.
