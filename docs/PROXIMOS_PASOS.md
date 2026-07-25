# Qué probar / qué hacer ahora

Estado actual: TikTok OAuth conectado, cuentas advertiser importadas. Cartera en $0 → cuentas en Pendiente sin métricas.

---

## Prioridad 1 — Dinero (para que dejen de verse en $0)

- [ ] Configurar Stripe sandbox en Vercel (`STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`)
- [ ] O activar pago manual (`PAYMENTS_MANUAL_ENABLED=true` + `PAYMENTS_ALLOW_MANUAL_PROVIDER=true`)
- [ ] Agregar `ADMIN_ALLOWED_EMAILS` (Atter + Daniel)
- [ ] Probar: **Agregar saldo** → cartera > $0
- [ ] Probar: **Asignar saldo** a 1 cuenta (ej. Dominic Velame)
- [ ] Confirmar que esa cuenta deja de estar en $0

---

## Prioridad 2 — TikTok gasto (sync)

- [ ] Redeploy con los últimos fixes (banner OAuth, onboarding 500, `integration_status`)
- [ ] Reconectar o reimportar cuentas (botón **Conectar TikTok**) para actualizar estados Pendiente → Activa
- [ ] Correr sync de gasto:
  ```bash
  curl -X POST "https://proyectovv.vercel.app/api/jobs/tiktok/sync" ^
    -H "x-cron-secret: TU_CRON_SECRET"
  ```
- [ ] Verificar que el gasto se refleje en overview / cuentas

---

## Prioridad 3 — UX / operación

- [ ] Daniel: pulir login, overview y wallet (look corporativo)
- [ ] Confirmar que Redirect URLs en TikTok siguen con **ambas**:
  - `https://www.hecom.club/` (sistema viejo)
  - `https://proyectovv.vercel.app/api/integrations/tiktok/callback` (MVP)
- [ ] No borrar `hecom.club` al editar

---

## Checklist rápido “funciona el MVP”

| Paso | OK? |
|---|---|
| Login en proyectovv | |
| Conectar TikTok → status connected | |
| Cuentas visibles en Mis cuentas | |
| Recarga cartera | |
| Asignar saldo a 1 cuenta | |
| Sync gasto TikTok | |
| Overview muestra gasto/saldo | |

---

## No hacer todavía

- Recarga cripto 100% automática  
- Crear campañas desde la plataforma  
- Crédito x2/x3/x5 automático  
- Quitar redirect de `hecom.club`
