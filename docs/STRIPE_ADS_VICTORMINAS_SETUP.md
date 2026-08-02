# Stripe + holisticads.com

Orden seguro. **Primero TEST**, Live solo cuando el sandbox esté OK.

Dominio del panel: `https://holisticads.com`  
Alias legacy (temporal): `https://ads.victorminas28.com`

DNS / dominio: ver `docs/DOMAIN_HOLISTICADS.md`.

---

## Paso 1 — Código (hecho)

En `/payments`:
- Arriba: recarga de cartera Holistic (Stripe / manual / cripto)
- Abajo: historial Hecom del cliente

Sin keys, Stripe responde “no configurado”. Manual sigue andando.

---

## Paso 2 — App URL en Vercel

Vercel → `proyectovv` → **Settings → Environment Variables** (Production):

```
NEXT_PUBLIC_APP_URL=https://holisticads.com
```

Redeploy después de guardar. Solo cuando el dominio esté **Valid** en Vercel Domains.

---

## Paso 3 — Stripe TEST

1. [Stripe Dashboard](https://dashboard.stripe.com) → modo **Test** (toggle arriba a la derecha)
2. **Developers → API keys**
   - `pk_test_…` → `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   - `sk_test_…` → `STRIPE_SECRET_KEY`
3. **Developers → Webhooks → Add endpoint**
   - URL: `https://holisticads.com/api/webhooks/payments/stripe`
   - Eventos:
     - `checkout.session.completed`
     - `payment_intent.succeeded`
     - `payment_intent.payment_failed`
     - `checkout.session.expired`
     - `payment_intent.canceled`
4. Copiar **Signing secret** `whsec_…` → `STRIPE_WEBHOOK_SECRET`
5. En Vercel (Production) pegar:

```
STRIPE_SECRET_KEY=sk_test_…
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_…
STRIPE_WEBHOOK_SECRET=whsec_…
PAYMENTS_DEFAULT_PROVIDER=stripe
PAYMENTS_MANUAL_ENABLED=true
NEXT_PUBLIC_APP_URL=https://holisticads.com
```

6. **Redeploy** (Deployments → ⋯ → Redeploy, o push a `main`)

**No hace falta Stripe Connect.**

---

## Paso 4 — Probar sandbox

1. Entrar a `https://holisticads.com/payments`
2. Elegir cliente Hecom
3. Recargar → **Stripe** → monto chico
4. Tarjeta test: `4242 4242 4242 4242` · fecha futura · CVC cualquiera
5. Volver a `/payments?status=success`
6. Stripe → Webhooks → evento **2xx**
7. Ver saldo de cartera actualizado

Si el webhook falla: revisar `STRIPE_WEBHOOK_SECRET` y que la URL sea exacta.

---

## Paso 5 — Live (solo después del test OK)

1. Activar cuenta Stripe (negocio / banco)
2. Keys **live** + webhook live (misma path)
3. Reemplazar env en Vercel Production
4. Una recarga real de monto mínimo

---

## Qué NO pegar en el chat

Nunca mandes `sk_…` ni `whsec_…` por mensaje. Solo en Vercel.
