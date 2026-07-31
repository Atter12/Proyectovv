# Plan: acceso cliente por OTP (estilo Hecom Club)

**Idea:** los clientes que ya están en Hecom Club **no se registran** con formulario clásico (nombre + org + password). Entran **solo con OTP**: correo → **código de 6 dígitos** y/o **enlace mágico** → panel. Sin contraseña.

En Hecom Club el OTP ya se usa (p. ej. gerentes). Acá la misma lógica se aplica a **clientes jalados** (`hecom.clientes.emails[]`).

Stripe / Cobrana / wallet **no cambian** con este plan: solo cambia cómo el cliente entra.

---

## 1. Hoy vs objetivo

| Hoy (Proyectovv / Ecomdy) | Objetivo (clientes Hecom) |
|---|---|
| `/register` con password + org | **Sin registro abierto** para clientes Hecom |
| `/login` con password | Login: **solo email → código + magic link** |
| OTP solo confirma email post-signup / recovery | OTP / magic link = **única llave** (sin password) |
| Invite opcional (`organization_email_invites`) | Allowlist = **emails del cliente en Hecom** |

**Admin / staff:** se mantiene aparte (`/admin/login` + allowlist). No mezclar con OTP de cliente.

---

## 2. Principio de diseño (cuidado)

1. **Solo correos que existan en Hecom** (tabla clientes → `emails[]`).  
   Si el mail no está → mensaje genérico: “Si tu correo está habilitado, te enviamos un código” (no revelar si existe o no).
2. **No auto-crear clientes nuevos** por OTP. El cliente ya vive en Hecom; acá solo se le da acceso.
3. **Provisioning mínimo** al primer OTP OK:
   - crear/actualizar `auth.users` + `profiles`
   - vincular membership / org interna (o scope Hecom por cookie/cliente)
   - **no** exigir “Crear organización” en el registro
4. **Sin password** para clientes con flag on. Admin sigue en `/admin/login`.
5. **Rate limit** fuerte en envío de OTP (abuso / coste email).
6. Dos vías en el mismo email de Supabase: `{{ .Token }}` (código) + enlace → `/auth/callback?flow=hecom`.

---

## 3. Flujo UX (MVP)

```
/login (cliente)
  → solo Email
  → “Enviar código y enlace”  (Resend: código + magic link)
  → A) código 6 dígitos en /verify-otp
     B) enlace mágico → /auth/callback?flow=hecom
  → provision:
      1 cliente (ej. Adriana) → cookie scope + overview (solo SUS datos)
      N clientes mismo email → /clientes (lista filtrada a esos)
```

### Staff / gerentes (OTP + elegir cualquier cliente)

Correos ubicados en Hecom Club (`_wazappOpsDb` / asistencia):

| Persona | Email |
|---|---|
| Annie | `anniealejandrova6@gmail.com` |
| Gian | `gian.rojas.arcos@gmail.com` |
| Víctor | `victor.minas@unmsm.edu.pe` |
| Atter | `attermayerbasiliorengifo@gmail.com` |

**Vercel (recomendado):**
```
AUTH_HECOM_OTP_STAFF_EMAILS=anniealejandrova6@gmail.com,gian.rojas.arcos@gmail.com,victor.minas@unmsm.edu.pe,attermayerbasiliorengifo@gmail.com
```

(También hay defaults en código si falta el env.)

- Cliente real (Adriana, etc.): solo SUS datos.
- Staff/gerente: OTP igual → `/clientes` con **toda** la lista (como ops).
- Piloto cliente fake: `AUTH_HECOM_OTP_TEST_EMAILS=...`

**Email:** el OTP Hecom se envía por **Resend** (no el mail default de Supabase).  
En Vercel: `RESEND_API_KEY`, `RESEND_FROM` (o `EMAIL_FROM`), opcional `EMAIL_PROVIDER=resend`.  
El mail trae logo Holistic + código 6 dígitos + botón enlace mágico.

Textos:
- Login: “Solo correo. Te mandamos un código y un enlace mágico.”
- Sin “Crear cuenta” / sin campo contraseña cuando `AUTH_HECOM_OTP_LOGIN=true`.

---

## 4. Flujo técnico (alto nivel)

### 4.1 Enviar OTP
1. Cliente pide OTP con `email`.
2. Backend (server) normaliza email → busca en Hecom `clientes` donde `emails` contenga ese correo.
3. Si **no** hay match → respuesta OK genérica (no envía OTP real) *o* envía igual sin crear sesión útil; preferible: no enviar y misma UX.
4. Si hay match → `supabase.auth.signInWithOtp({ email })` (magiclink/OTP email).
5. Guardar audit: `otp_requested`, cliente_ids candidatos, IP.

### 4.2 Verificar OTP
1. `supabase.auth.verifyOtp({ type: "email", email, token })`.
2. Post-login: `provisionHecomClienteAccess(user, email)`:
   - profile
   - link `user_id` ↔ `hecom_cliente_id`(s)
   - set cookie/scope cliente si hay uno solo
3. Redirect overview / clientes.

### 4.3 Datos que ya tenemos a favor
- Hecom clientes con `emails: string[]` (`lib/hecom/clientes.server.ts`).
- UI OTP (`VerifyOtpForm`) reusable.
- Scope por cliente Hecom ya existe en dashboard/payments/ad-accounts.
- Invites (`organization_email_invites`) pueden quedar para casos edge, no como camino principal.

---

## 5. Decisiones a cerrar antes de codear

| # | Decisión | Recomendación |
|---|---|---|
| A | ¿Quién puede OTP? | Solo emails en Hecom clientes |
| B | ¿Un email en N clientes? | Selector post-login |
| C | ¿Registro público `/register`? | Desactivar o “solo invitación staff” |
| D | ¿Staff/admin? | Password (o OTP aparte), nunca el mismo flujo cliente |
| E | ¿Usuarios con password actuales? | Seguir aceptando password un tiempo **o** forzar migración OTP |
| F | ¿Org interna vs solo Hecom scope? | Preferir vincular al cliente Hecom; org holística interna si ya la usan staff |

---

## 6. Fases (orden cuidadoso)

### Fase 0 — Inventario (1 día)
- [ ] Listar cuántos clientes Hecom tienen ≥1 email válido.
- [ ] Detectar emails duplicados entre clientes.
- [ ] Confirmar template Supabase Auth: OTP 6 dígitos (`{{ .Token }}`), no solo magic link.
- [ ] Confirmar `NEXT_PUBLIC_APP_URL` / Site URL / Redirect URLs en Supabase.

### Fase 1 — Backend allowlist + OTP (2–3 días)
- [ ] API `POST /api/auth/otp/request` (valida Hecom, rate limit, signInWithOtp).
- [ ] API o reuse verify (cliente) con `flow=hecom`.
- [ ] Tabla o mapping `hecom_cliente_user_links` (user_id, hecom_cliente_id, email, created_at).
- [ ] Provisioning post-OTP sin formulario de org.
- [ ] Tests: email desconocido, email válido, OTP malo, OTP ok, rate limit.

### Fase 2 — UI login cliente (1–2 días)
- [ ] Login cliente = email only + CTA “Enviar código”.
- [ ] Verify OTP con copy Hecom.
- [ ] Ocultar/desviar `/register` en prod (feature flag).
- [ ] Si varios clientes: pantalla “Elegí tu cuenta”.

### Fase 3 — Soft launch (piloto)
- [ ] 5–10 clientes Hecom reales.
- [ ] Medir: entrega email, tiempo a código, fallos.
- [ ] Soporte: qué hacer si el correo no está en Hecom (actualizar en Hecom, no inventar registro).

### Fase 4 — Cierre
- [ ] Comunicar a base: “Entrá con OTP, sin contraseña”.
- [ ] (Opcional) Desactivar password login cliente.
- [ ] Admin sigue con su flujo.

---

## 7. Riesgos y mitigación

| Riesgo | Mitigación |
|---|---|
| Email no está en Hecom → “no puedo entrar” | Actualizar `emails[]` en Hecom; no abrir registro libre |
| Enumeración de correos | Respuesta genérica + rate limit |
| OTP no llega | Template Supabase + Resend/SMTP; reenvío con cooldown |
| Un correo en varios clientes | Selector obligatorio |
| Staff usa login cliente por error | Rutas separadas `/login` vs `/admin/login` |
| Romper sesiones password actuales | Flag `AUTH_CLIENT_OTP_ONLY=false` hasta piloto OK |

---

## 8. Fuera de alcance (ahora)

- OTP por WhatsApp/SMS (solo email MVP).  
- Registro self-service de clientes nuevos.  
- Mezclar OTP gerentes Hecom Club (otro sistema) con este Auth de Ecomdy más allá del patrón UX.  
- Cambiar Cobrana/Stripe por este trabajo.

---

## 9. Criterio “listo”

- Cliente Hecom con email en lista pide OTP y entra **sin password** (código o magic link).  
- Email desconocido no crea usuario útil.  
- Tras login ve su scope (cuentas / pagos Hecom).  
- Admin intacto.  
- Feature flag para rollback a login password.

---

## 10. Primer paso concreto de implementación

1. Feature flag `AUTH_HECOM_OTP_LOGIN=true` (Preview primero).  
2. `POST /api/auth/otp/request` + check Hecom emails.  
3. UI login email-only detrás del flag.  
4. Piloto con 1 cliente real.

### Fase 1 — hecho en código (anotar)

- [x] `findHecomClientesByEmail`
- [x] `AUTH_HECOM_OTP_LOGIN` en env
- [x] migración `013_hecom_otp_client_links.sql`
- [x] `POST /api/auth/otp/request`
- [x] `POST /api/auth/otp/provision` + verify OTP `flow=hecom`
- [x] Aplicar migración en Supabase *(vos)*
- [ ] `AUTH_HECOM_OTP_LOGIN=true` en Vercel
- [x] UI login **solo OTP** (sin password / sin `?password=1`)
- [x] `/register` redirige a login si OTP activo
- [x] Magic link → `/auth/callback?flow=hecom` + código 6 dígitos
- [ ] Redirect URL en Supabase: `https://<APP_URL>/auth/callback`
- [ ] Template email con `{{ .Token }}` + `{{ .ConfirmationURL }}`

Cuando digas “go”, arrancamos por Fase 1 (API allowlist + OTP) sin tocar Cobrana/Stripe.
