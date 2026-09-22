# Plan: Ads Holistic en App Store (iOS) — desde este repo

**Estado:** plan para ejecutar en chat/agente nuevo (este hilo de ops/clientes no sigue acá).  
**Repo:** trabajar **en `Proyectovv`** (no crear otra repo por ahora).  
**Enfoque:** cascarón nativo (Capacitor) que carga la web ya desplegada + sesión larga + push.  
**Objetivo de producto:** que el cliente abra el ícono en el iPhone y entre **de frente** (sin OTP cada vez), y que gerencia/cliente reciban **notificaciones** cuando alguien paga o pide/recarga.

---

## 1. Idea en una frase

No rehacer Ads Holistic en Swift/React Native. Empaquetar `adsholistic.com` (o el dominio de prod actual) en una app iOS con Capacitor, publicar por **TestFlight** y luego App Store. La lógica de negocio sigue en Next.js; la app es shell + push + “entrar fácil”.

---

## 2. Por qué desde este repo

| Opción | Veredicto |
|---|---|
| Nueva repo | No, por ahora. Duplica auth, env, deploys. |
| Carpeta en `Proyectovv` (ej. `mobile/` o `apps/ios/`) | **Sí.** Un solo código web; el shell apunta a prod/staging. |
| Expo/RN nativo full | Después, si el shell se queda corto. |

**Actualización de features:** al desplegar la web, la app WebView ya muestra lo nuevo (salvo cambios de plugins nativos / versión de store).

---

## 3. Objetivo UX (lo que pidió el negocio)

1. **App en el celular** (ícono Ads Holistic).
2. **Entrar fácil, de frente:** abrir app → panel, **sin pedir OTP/login cada vez**.
3. **Notificaciones push** cuando:
   - alguien **paga** / se acredita un depósito;
   - alguien **sube voucher** / pide recarga / cobro faltante;
   - (opcional fase 2) gerencia debe **aprobar** manual.
4. Beta rápida para clientes reales vía **TestFlight** (equivalente práctico al “link de prueba” de Play).

### Cómo interpretar “sin login”

**No** significa app abierta sin identidad (inseguro y Apple lo rechaza). Significa:

- **Primera vez:** OTP / magic link Hecom (flujo actual de clientes).
- **Después:** sesión **persistente** en el WebView (cookies / refresh) + opcional **Face ID / Touch ID** solo para desbloquear la app localmente.
- Abrir el ícono = ya estás dentro, como Instagram después del primer login.

Si la sesión expira (meses / logout / cambio de dispositivo): un OTP otra vez.

---

## 4. Stack propuesto

| Pieza | Elección |
|---|---|
| Shell iOS | **Capacitor 6/7** + Xcode |
| Contenido | URL de prod (y flag staging para builds internas) |
| Auth | Hecom OTP actual (`docs/PLAN_AUTH_OTP_HECOM_CLIENTES.md`) + cookies de larga duración en WebView |
| Push | Capacitor Push Notifications → **APNs** |
| Backend tokens | Nueva tabla `device_push_tokens` (user_id, org, platform, token, updated_at) |
| Envío push | Servicio server (Firebase HTTP v1 **o** APNs directo / OneSignal). Hoy solo hay filas en `notifications` in-app (`lib/notifications/create-notification.server.ts`) — **no hay push real aún**. |
| Distribución | Apple Developer → **TestFlight** → App Store |

---

## 5. Qué tocar en el código (mapa)

### Nuevo (carpeta sugerida `mobile/`)

```
mobile/
  package.json          # @capacitor/core, ios, push, app, browser, splash, status-bar
  capacitor.config.ts   # server.url = https://adsholistic.com (o env)
  ios/                  # proyecto Xcode generado
  README.md             # build, TestFlight, certificados
```

### Backend / web a extender

| Área | Qué hacer |
|---|---|
| Sesión cliente | Alargar vida de cookie/sesión OTP en app; detectar `Capacitor` / header `X-Holistic-App: ios` si hace falta. Revisar `lib/auth/*`, middleware, Supabase cookie options. |
| Deep link | Universal Links / custom scheme `adsholistic://` para magic link OTP y abrir pantallas (Pagos, Vouchers). |
| Push registro | API `POST /api/device/push-token` (auth required) guarda token APNs. |
| Push envío | Tras `ledger_confirm_deposit`, approve manual, missing-cobro proof, etc.: además de `createNotificationBestEffort`, llamar `sendPushToUser/Org(...)`. |
| Eventos mínimos v1 | (1) depósito acreditado, (2) voucher/recarga en revisión, (3) aprobado/rechazado. |
| UI permiso notif | Banner en app la primera vez: “Activar avisos de recargas”. |
| Pagos in-app | **Cuidado Apple:** recarga de saldo/ads puede exigir IAP o pelear excepción “bien digital externo”. v1: **no** meter botón de compra Stripe *dentro* del binario si review se complica; deeplink a Safari/web o flujo ya aprobado. Documentar defensa para review. |

### No tocar en v1

- Lógica TikTok BM, ledger, Hecom sync, Profit, creativos.
- Otra base de datos.
- Reescritura de pantallas a nativo.

---

## 6. Notificaciones — diseño concreto

### Hoy

`createNotificationBestEffort` → tabla `notifications` (campanita en dashboard). El cliente **no** se entera si no tiene la web abierta.

### Objetivo v1

```
evento pago/recarga
  → insert notifications (igual)
  → lookup device_push_tokens del user/org
  → APNs: título + body + data { url: "/payments" | "/cobros" | ... }
  → al tocar: app abre y navega a esa ruta
```

### Audiencias

| Quién | Qué recibe |
|---|---|
| **Cliente** | “Tu recarga de $X ya está en cartera” / “Tu voucher está en revisión” |
| **Gerencia / staff** | “Nuevo voucher de {cliente}” / “Pago manual por aprobar” |

Empezar por **cliente + gerentes allowlist**; no spamear a todos los members.

---

## 7. Fases de entrega

### Fase 0 — Prep (1–2 días)

- [ ] Apple Developer Team a nombre Holistic (si no existe).
- [ ] Bundle ID fijo, ej. `com.adsholistic.app`.
- [ ] Iconos 1024 + splash brand.
- [ ] Decidir URL prod exacta y staging.

### Fase 1 — Shell TestFlight (lo más rápido para “tener la app”)

- [ ] Scaffold Capacitor en `mobile/`.
- [ ] WebView a prod; safe areas; status bar; back gesture.
- [ ] Build iOS → TestFlight interno (staff).
- [ ] Invitar 2–3 clientes piloto (link TestFlight).
- [ ] Validar: abrir app, OTP **una vez**, siguientes aperturas **sin login**.

### Fase 2 — Sesión “de frente”

- [ ] Persistencia de sesión OK en WKWebView (cookies third-party / SameSite).
- [ ] Opcional: plugin Biometric al resume.
- [ ] Logout explícito en Ajustes.
- [ ] Magic link que abre la app (Universal Link), no solo Safari.

### Fase 3 — Push pagos / recargas

- [ ] Tabla + API de tokens.
- [ ] Capacitor Push + permiso iOS.
- [ ] Hooks en confirmación de depósito y flujo voucher/missing-cobro / approve.
- [ ] Probar en dispositivo real (simulador push limitado).

### Fase 4 — App Store público

- [ ] Privacy Nutrition Labels, cuenta demo reviewer, screenshots.
- [ ] Texto review: app es cliente de la plataforma web Ads Holistic; pagos ads fuera de IAP según política aplicable.
- [ ] Submit + responder rechazos.

### Fase 5 (opcional) — Android

- Mismo Capacitor → Play Store (ya hay más costumbre de “link de prueba”). Reusar push con FCM.

---

## 8. TestFlight vs “link como Play”

| | Play | Apple |
|---|---|---|
| Prueba rápida | Internal testing / APK | **TestFlight** (invite email o link público TestFlight) |
| Instalar | Play Store testing track | App **TestFlight** |
| Review previa | Ligera | TestFlight a veces pide review corta |

No hay “pasá este IPA por WhatsApp” para clientes normales. TestFlight **es** el camino.

---

## 9. Riesgos (leer antes de codear)

1. **Apple IAP / pagos digitales** — el mayor riesgo de rechazo. Plan: v1 prioriza **uso + notificaciones + ver saldos/vouchers**; flujo de pagar puede abrir web externa si legal/review lo exige. Coordinar con gerencia.
2. **Cookies en WebView** — si la sesión no pega, “otra vez OTP”. Probar temprano en dispositivo.
3. **OTP por mail en el celular** — el magic link debe abrir la **app**, no un Safari suelto sin cookies compartidas.
4. **Push sin app abierta** — requiere certificados APNs + backend; no alcanza la tabla `notifications`.
5. **Crédito agencia / BM** — la app no cambia reglas de cupo; solo superficie móvil.

---

## 10. Criterio de “listo” (MVP que importa al negocio)

- Cliente piloto instala por TestFlight.
- Abre el ícono → entra al panel **sin** pedir código (sesión previa).
- Al acreditarse una recarga de prueba → **push** en el iPhone.
- Al subir un voucher / pedir revisión → push a gerencia (o al cliente “en revisión”).
- Cero cambios rotos en la web desktop.

---

## 11. Orden de trabajo sugerido para el agente siguiente

1. Crear `mobile/` + Capacitor iOS apuntando a prod.
2. Documentar en `mobile/README.md` comandos Xcode / TestFlight.
3. Arreglar sesión persistente (“de frente”).
4. Implementar push tokens + 2–3 eventos de pago/recarga.
5. TestFlight a staff → luego clientes.
6. Solo después: store público y/o Android.

**No** empezar por App Store listing completo ni por reescribir UI nativa.

---

## 12. Contexto repo útil

- Auth cliente OTP: `docs/PLAN_AUTH_OTP_HECOM_CLIENTES.md`, `lib/auth/hecom-otp*.ts`, `features/auth/`
- Notificaciones in-app hoy: `lib/notifications/create-notification.server.ts`
- Pagos / vouchers: `lib/payments/*`, `app/api/payments/*`, Vouchers `/cobros`
- Dominio: `docs/DOMAIN_HOLISTICADS.md`

---

## 13. Decisión cerrada

| Pregunta | Respuesta |
|---|---|
| ¿Otra repo? | **No.** Todo desde `Proyectovv` / `mobile/`. |
| ¿Nativo from scratch? | **No** en v1. Capacitor + web. |
| ¿Sin login absoluto? | **No.** Sin login **repetido**; 1× OTP luego sesión larga. |
| ¿Push posible con esta idea? | **Sí**, con APNs + backend nuevo encima de los eventos de pago ya existentes. |
| ¿Beta tipo Play? | **TestFlight.** |

Cuando otro agente tome esto: implementar por fases 0→3; no mezclar con auditorías de clientes/ops de TikTok en el mismo hilo.
