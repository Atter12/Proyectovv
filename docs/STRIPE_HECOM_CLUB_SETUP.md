# Paso a paso: Stripe + app.hecom.club

Orden seguro. No saltees pasos.

## Paso 1 — Código (hecho)
En `/payments` quedó:
- **Arriba:** recarga de cartera Holistic (Stripe / manual)
- **Abajo:** historial Hecom del cliente (sin tocar)

Todavía **no** hace falta keys de Stripe para ver la UI. Sin keys, Stripe responde “no configurado” y Manual sigue andando.

---

## Paso 2 — Dominio `app.hecom.club` (humano / Vercel)

1. En el DNS de `hecom.club`, crear registro:
   - Tipo: `CNAME`
   - Nombre: `app`
   - Valor: `cname.vercel-dns.com` (o el que Vercel indique)
2. En Vercel → proyecto → **Domains** → Add `app.hecom.club`
3. Esperar SSL verde (minutos).
4. En Vercel → **Environment Variables** (Production):
   ```
   NEXT_PUBLIC_APP_URL=https://app.hecom.club
   ```
5. Redeploy.

### Supabase Auth (mismo día)
Dashboard Supabase → Authentication → URL Configuration:
- Site URL: `https://app.hecom.club`
- Redirect URLs: agregar `https://app.hecom.club/**`

### TikTok (si usan OAuth)
Agregar redirect:
`https://app.hecom.club/api/integrations/tiktok/callback`  
(no borrar el de hecom.club viejo hasta migrar).

---

## Paso 3 — Stripe TEST (pedir autorización)

Cuando el dominio ya abra (o al menos tengas URL Vercel estable):

1. Stripe Dashboard → **Developers → API keys** (modo **Test**)
   - Copiar `sk_test_…` y `pk_test_…`
2. **Developers → Webhooks → Add endpoint**
   - URL: `https://app.hecom.club/api/webhooks/payments/stripe`
   - Eventos:
     - `checkout.session.completed`
     - `payment_intent.succeeded`
     - `payment_intent.payment_failed`
     - `checkout.session.expired`
     - `payment_intent.canceled`
3. Copiar **Signing secret** `whsec_…`
4. Pegar en Vercel:
   ```
   STRIPE_SECRET_KEY=sk_test_…
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_…
   STRIPE_WEBHOOK_SECRET=whsec_…
   PAYMENTS_DEFAULT_PROVIDER=stripe
   PAYMENTS_MANUAL_ENABLED=true
   ```
5. Redeploy.

**No hace falta Stripe Connect** para este flujo.

---

## Paso 4 — Probar sandbox

1. Entrar a `https://app.hecom.club/payments`
2. Elegir cliente Hecom
3. En “Recargar saldo” → Stripe → monto chico
4. Tarjeta test: `4242 4242 4242 4242`
5. Volver a `/payments?status=success`
6. Confirmar en Stripe → Webhooks que el evento llegó 2xx
7. Ver saldo de cartera actualizado

Si el webhook falla: revisar `STRIPE_WEBHOOK_SECRET` y que la URL sea exactamente la de arriba.

---

## Cripto (USDT)

Sí es posible. Hoy el flujo es **voucher** (como transferencia): el cliente elige Cripto → envía USDT → sube captura/TxID → admin aprueba y acredita saldo.

1. Aplicar migración `013_payment_provider_crypto.sql` en Supabase (agrega enum `crypto`).
2. Mantener `PAYMENTS_MANUAL_ENABLED=true` (también habilita cripto en producción).
3. En Pagos → Recargar → método **Cripto (USDT)**.

Automatizar on-chain (NOWPayments / Binance Pay API) es un paso aparte, después.

---

## Paso 5 — Live (solo después del test OK)

1. Activar cuenta Stripe (negocio / banco) — humano
2. Keys **live** + webhook live (misma path)
3. Reemplazar env en Vercel (Production)
4. Una recarga real de monto mínimo

---

## Qué NO tocar todavía
- Culqi / Mercado Pago
- Stripe Connect
- Borrar hecom.club viejo
